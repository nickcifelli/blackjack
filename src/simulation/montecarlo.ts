import {
  type BucketKey,
  type Composition,
  BUCKET_KEYS,
  cloneComposition,
  totalCount,
} from '../engine/cards';
import { handValue, isPair, isNaturalBlackjack } from '../engine/hand';
import { playDealerHand } from '../engine/dealer';
import { basicStrategyAction } from '../engine/basicStrategy';
import type { RuleConfig } from '../engine/rules';
import type { Action } from '../engine/actions';
import { holeCardPool } from './unknownPool';

export interface ActionResult {
  ev: number;
  winPct: number;
  pushPct: number;
  lossPct: number;
}

export interface EvaluateDecisionRequest {
  legalActions: Action[];
  playerCards: BucketKey[];
  dealerUp: BucketKey;
  unknownComposition: Composition;
  rules: RuleConfig;
  trials?: number;
}

export type DecisionResults = Partial<Record<Action, ActionResult>>;

const DEFAULT_TRIALS = 25_000;

function sampleBucket(pool: Composition, rng: () => number): BucketKey {
  const total = totalCount(pool);
  if (total <= 0) throw new Error('Cannot sample from an empty composition');
  let r = rng() * total;
  for (const b of BUCKET_KEYS) {
    r -= pool[b];
    if (r < 0) return b;
  }
  for (const b of BUCKET_KEYS) if (pool[b] > 0) return b;
  throw new Error('sampleBucket: pool exhausted');
}

function draw(pool: Composition, rng: () => number): BucketKey {
  const b = sampleBucket(pool, rng);
  pool[b]--;
  return b;
}

/** The dealer's hole card, conditioned on the peek having already cleared. */
function drawHoleCard(pool: Composition, dealerUp: BucketKey, rng: () => number): BucketKey {
  const conditioned = holeCardPool(pool, dealerUp);
  const bucket = sampleBucket(conditioned, rng);
  pool[bucket]--;
  return bucket;
}

function playOutDealer(
  dealerUp: BucketKey,
  pool: Composition,
  rules: RuleConfig,
  rng: () => number,
): { total: number; bust: boolean } {
  const hole = drawHoleCard(pool, dealerUp, rng);
  const finalCards = playDealerHand([dealerUp, hole], () => draw(pool, rng), rules);
  const value = handValue(finalCards);
  return { total: value.total, bust: value.bust };
}

function scoreHand(playerCards: BucketKey[], bet: number, dealerTotal: number, dealerBust: boolean): number {
  const { total, bust } = handValue(playerCards);
  if (bust) return -bet;
  if (dealerBust) return bet;
  if (total > dealerTotal) return bet;
  if (total < dealerTotal) return -bet;
  return 0;
}

/** Plays a hand to completion via the basic-strategy continuation policy (no double/split from here). */
function rolloutContinue(
  cards: BucketKey[],
  dealerUp: BucketKey,
  pool: Composition,
  rng: () => number,
): BucketKey[] {
  let current = cards;
  for (;;) {
    const { bust, total } = handValue(current);
    if (bust || total >= 21) return current;
    const action = basicStrategyAction({ cards: current, dealerUp, canDouble: false, canSplit: false });
    if (action === 'S') return current;
    current = [...current, draw(pool, rng)];
  }
}

/**
 * Recursively resolves a split into its flat list of finished subhands
 * (further splits, doubles, hits/stands all chosen via basic strategy), WITHOUT
 * playing out the dealer — the dealer plays once, after every subhand is done.
 */
function resolveSplitHands(
  pairCards: BucketKey[],
  dealerUp: BucketKey,
  pool: Composition,
  rules: RuleConfig,
  rng: () => number,
  handCounter: { count: number },
): Array<{ cards: BucketKey[]; bet: number }> {
  const isAcePair = pairCards[0] === 'A';
  const results: Array<{ cards: BucketKey[]; bet: number }> = [];

  for (const singleCard of pairCards) {
    const cards: BucketKey[] = [singleCard, draw(pool, rng)];

    if (isAcePair && rules.splitAcesOneCardOnly) {
      results.push({ cards, bet: 1 });
      continue;
    }

    const canSplitAgain =
      handCounter.count < rules.maxSplitHands &&
      isPair(cards) &&
      (!isAcePair || rules.resplitAcesAllowed) &&
      (cards[0] !== 'T' || rules.allowSplitAnyTenValue);
    const canDouble = rules.dasAllowed;

    const action = basicStrategyAction({ cards, dealerUp, canDouble, canSplit: canSplitAgain });

    if (action === 'P' && canSplitAgain) {
      handCounter.count += 1;
      results.push(...resolveSplitHands(cards, dealerUp, pool, rules, rng, handCounter));
      continue;
    }

    if (action === 'D' && canDouble) {
      results.push({ cards: [...cards, draw(pool, rng)], bet: 2 });
      continue;
    }

    results.push({ cards: rolloutContinue(cards, dealerUp, pool, rng), bet: 1 });
  }

  return results;
}

function simulateOneTrial(
  action: Exclude<Action, 'surrender'>,
  playerCards: BucketKey[],
  dealerUp: BucketKey,
  pool: Composition,
  rules: RuleConfig,
  rng: () => number,
): number {
  if (action === 'stand') {
    const dealer = playOutDealer(dealerUp, pool, rules, rng);
    return scoreHand(playerCards, 1, dealer.total, dealer.bust);
  }

  if (action === 'hit') {
    const cards = [...playerCards, draw(pool, rng)];
    if (handValue(cards).bust) return -1;
    const finalCards = rolloutContinue(cards, dealerUp, pool, rng);
    const dealer = playOutDealer(dealerUp, pool, rules, rng);
    return scoreHand(finalCards, 1, dealer.total, dealer.bust);
  }

  if (action === 'double') {
    const cards = [...playerCards, draw(pool, rng)];
    if (handValue(cards).bust) return -2;
    const dealer = playOutDealer(dealerUp, pool, rules, rng);
    return scoreHand(cards, 2, dealer.total, dealer.bust);
  }

  // split
  const subhands = resolveSplitHands(playerCards, dealerUp, pool, rules, rng, { count: 2 });
  const dealer = playOutDealer(dealerUp, pool, rules, rng);
  return subhands.reduce((sum, h) => sum + scoreHand(h.cards, h.bet, dealer.total, dealer.bust), 0);
}

function simulateAction(
  action: Action,
  playerCards: BucketKey[],
  dealerUp: BucketKey,
  unknownComposition: Composition,
  rules: RuleConfig,
  trials: number,
  rng: () => number,
): ActionResult {
  if (action === 'surrender') {
    return { ev: -0.5, winPct: 0, pushPct: 0, lossPct: 100 };
  }

  let evSum = 0;
  let wins = 0;
  let pushes = 0;
  let losses = 0;

  for (let i = 0; i < trials; i++) {
    const pool = cloneComposition(unknownComposition);
    const outcome = simulateOneTrial(action, playerCards, dealerUp, pool, rules, rng);
    evSum += outcome;
    if (outcome > 0) wins++;
    else if (outcome < 0) losses++;
    else pushes++;
  }

  return {
    ev: evSum / trials,
    winPct: (wins / trials) * 100,
    pushPct: (pushes / trials) * 100,
    lossPct: (losses / trials) * 100,
  };
}

/**
 * Evaluates every legal action at a decision point via Monte Carlo simulation
 * against the actual remaining shoe composition. This is the real decision
 * point being scored directly — any FURTHER decisions needed inside a rollout
 * (what to do after a hit, how to play out split hands) use the hardcoded
 * basic-strategy continuation policy rather than another layer of simulation.
 */
export function evaluateDecision(req: EvaluateDecisionRequest, rng: () => number = Math.random): DecisionResults {
  const trials = req.trials ?? DEFAULT_TRIALS;
  const results: DecisionResults = {};
  for (const action of req.legalActions) {
    results[action] = simulateAction(
      action,
      req.playerCards,
      req.dealerUp,
      req.unknownComposition,
      req.rules,
      trials,
      rng,
    );
  }
  return results;
}

export function pickBestAction(results: DecisionResults): Action {
  let best: Action | null = null;
  let bestEv = -Infinity;
  for (const action of Object.keys(results) as Action[]) {
    const ev = results[action]!.ev;
    if (ev > bestEv) {
      bestEv = ev;
      best = action;
    }
  }
  if (!best) throw new Error('pickBestAction: no actions to choose from');
  return best;
}

// Exported for unit testing only.
export const __internal = {
  isNaturalBlackjack,
  resolveSplitHands,
  rolloutContinue,
  simulateOneTrial,
};
