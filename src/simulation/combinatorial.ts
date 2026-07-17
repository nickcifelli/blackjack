import {
  type BucketKey,
  type Composition,
  BUCKET_KEYS,
  bucketValue,
  cloneComposition,
  totalCount,
} from '../engine/cards';
import { handValue, isPair } from '../engine/hand';
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
}

export type DecisionResults = Partial<Record<Action, ActionResult>>;

/** payout (in bet units) -> exact probability. */
type PayoutDist = Map<number, number>;

interface DealerDist {
  bust: number;
  /** final total (17..21) -> probability */
  totals: Map<number, number>;
}

interface HandState {
  total: number;
  soft: boolean;
}

interface Caches {
  dealerTop: Map<string, DealerDist>;
  dealerFinish: Map<string, DealerDist>;
  solo: Map<string, PayoutDist>;
}

function newCaches(): Caches {
  return { dealerTop: new Map(), dealerFinish: new Map(), solo: new Map() };
}

function compKey(comp: Composition): string {
  let key = '';
  for (const b of BUCKET_KEYS) key += comp[b] + ',';
  return key;
}

/** Incremental version of handValue's ace-reduction logic: adds one card to an existing (total, soft) state. */
function addCard(hv: HandState, bucket: BucketKey): { total: number; soft: boolean; bust: boolean } {
  let total = hv.total + bucketValue(bucket);
  let softAces = (hv.soft ? 1 : 0) + (bucket === 'A' ? 1 : 0);
  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces--;
  }
  return { total, soft: softAces > 0, bust: total > 21 };
}

function evOf(dist: PayoutDist): number {
  let ev = 0;
  for (const [payout, p] of dist) ev += payout * p;
  return ev;
}

function addTo(dist: PayoutDist, payout: number, p: number): void {
  if (p === 0) return;
  dist.set(payout, (dist.get(payout) ?? 0) + p);
}

/**
 * Recursively resolves the dealer's hand from a known (total, soft) state, drawing from `comp`
 * until the dealer must stand or busts, mirroring playDealerHand's exact stopping rule. Memoized
 * on (total, soft, composition) since a hand's future is fully determined by that triple.
 */
function dealerFinish(total: number, soft: boolean, comp: Composition, rules: RuleConfig, cache: Caches): DealerDist {
  if (total > 21) return { bust: 1, totals: new Map() };

  const mustStand = total > 17 || (total === 17 && !(soft && !rules.dealerStandsSoft17));
  if (mustStand) return { bust: 0, totals: new Map([[total, 1]]) };

  const key = `${total}|${soft ? 1 : 0}|${compKey(comp)}`;
  const cached = cache.dealerFinish.get(key);
  if (cached) return cached;

  const tot = totalCount(comp);
  const result: DealerDist = { bust: 0, totals: new Map() };
  for (const b of BUCKET_KEYS) {
    const n = comp[b];
    if (n <= 0) continue;
    const p = n / tot;
    const nextComp = cloneComposition(comp);
    nextComp[b]--;
    const next = addCard({ total, soft }, b);
    const sub = dealerFinish(next.total, next.soft, nextComp, rules, cache);
    result.bust += p * sub.bust;
    for (const [t, pt] of sub.totals) result.totals.set(t, (result.totals.get(t) ?? 0) + p * pt);
  }

  cache.dealerFinish.set(key, result);
  return result;
}

/**
 * Exact distribution over the dealer's final outcome, starting from just the up card. Conditions
 * the hole card on the peek having already cleared via holeCardPool, exactly as the old Monte
 * Carlo engine did. Memoized on (dealerUp, composition).
 */
function dealerOutcomeDistribution(
  dealerUp: BucketKey,
  comp: Composition,
  rules: RuleConfig,
  cache: Caches,
): DealerDist {
  const key = `${dealerUp}|${compKey(comp)}`;
  const cached = cache.dealerTop.get(key);
  if (cached) return cached;

  const pool = holeCardPool(comp, dealerUp);
  const tot = totalCount(pool);
  const initial: HandState = { total: bucketValue(dealerUp), soft: dealerUp === 'A' };

  const result: DealerDist = { bust: 0, totals: new Map() };
  for (const b of BUCKET_KEYS) {
    const n = pool[b];
    if (n <= 0) continue;
    const p = n / tot;
    // The T-bucket exclusion in `pool` only conditions which hole card we drew (no blackjack);
    // once that's settled, every later hit draws from the true remaining composition, so the
    // continuation branches off `comp`, not the T-zeroed `pool`.
    const nextComp = cloneComposition(comp);
    nextComp[b]--;
    const hv = addCard(initial, b);
    const sub = dealerFinish(hv.total, hv.soft, nextComp, rules, cache);
    result.bust += p * sub.bust;
    for (const [t, pt] of sub.totals) result.totals.set(t, (result.totals.get(t) ?? 0) + p * pt);
  }

  cache.dealerTop.set(key, result);
  return result;
}

/** Payout distribution (bet = 1) for standing on `total` against a known dealer outcome distribution. */
function standDist(total: number, dealerDist: DealerDist): PayoutDist {
  const dist: PayoutDist = new Map();
  addTo(dist, 1, dealerDist.bust);
  for (const [dTotal, p] of dealerDist.totals) {
    if (total > dTotal) addTo(dist, 1, p);
    else if (total < dTotal) addTo(dist, -1, p);
    else addTo(dist, 0, p);
  }
  return dist;
}

/** Draws exactly one more card, then continues via the optimal hit/stand policy (bestSoloDist). */
function hitOnceDist(
  hand: HandState,
  comp: Composition,
  dealerUp: BucketKey,
  rules: RuleConfig,
  cache: Caches,
): PayoutDist {
  const dist: PayoutDist = new Map();
  const tot = totalCount(comp);
  for (const b of BUCKET_KEYS) {
    const n = comp[b];
    if (n <= 0) continue;
    const p = n / tot;
    const next = addCard(hand, b);
    if (next.bust) {
      addTo(dist, -1, p);
      continue;
    }
    const nextComp = cloneComposition(comp);
    nextComp[b]--;
    const sub = bestSoloDist({ total: next.total, soft: next.soft }, nextComp, dealerUp, rules, cache);
    for (const [payout, pp] of sub) addTo(dist, payout, p * pp);
  }
  return dist;
}

/**
 * The exact optimal continuation for a hand that can no longer double or split (i.e. every
 * decision point reachable after the first hit): max(stand, hit) by EV, computed exactly and
 * recursively. This is the exact replacement for the old engine's static basic-strategy
 * continuation table. Memoized on (total, soft, composition).
 */
function bestSoloDist(
  hand: HandState,
  comp: Composition,
  dealerUp: BucketKey,
  rules: RuleConfig,
  cache: Caches,
): PayoutDist {
  const key = `${hand.total}|${hand.soft ? 1 : 0}|${compKey(comp)}`;
  const cached = cache.solo.get(key);
  if (cached) return cached;

  const dealerDist = dealerOutcomeDistribution(dealerUp, comp, rules, cache);
  const stand = standDist(hand.total, dealerDist);
  const hit = hitOnceDist(hand, comp, dealerUp, rules, cache);
  const best = evOf(hit) > evOf(stand) ? hit : stand;

  cache.solo.set(key, best);
  return best;
}

/** Forces exactly one card then a stand, at double the bet. */
function doubleDist(
  hand: HandState,
  comp: Composition,
  dealerUp: BucketKey,
  rules: RuleConfig,
  cache: Caches,
): PayoutDist {
  const dist: PayoutDist = new Map();
  const tot = totalCount(comp);
  for (const b of BUCKET_KEYS) {
    const n = comp[b];
    if (n <= 0) continue;
    const p = n / tot;
    const next = addCard(hand, b);
    if (next.bust) {
      addTo(dist, -2, p);
      continue;
    }
    const nextComp = cloneComposition(comp);
    nextComp[b]--;
    const dealerDist = dealerOutcomeDistribution(dealerUp, nextComp, rules, cache);
    const stand = standDist(next.total, dealerDist);
    for (const [payout, pp] of stand) addTo(dist, payout * 2, p * pp);
  }
  return dist;
}

function convolve(a: PayoutDist, b: PayoutDist): PayoutDist {
  const out: PayoutDist = new Map();
  for (const [pa, qa] of a) {
    for (const [pb, qb] of b) addTo(out, pa + pb, qa * qb);
  }
  return out;
}

/**
 * One new hand from a split: draws its second card from `comp`, then picks whichever of
 * stand/hit/double/split-again is exactly best. Per the standard combinatorial convention (matching
 * every published reference table), both hands created by a split draw from the SAME `comp` rather
 * than each other's realized depletion, so the two hands are identically distributed — splitDist
 * below computes this once and convolves it with itself instead of computing it twice.
 */
function splitSubhandDist(
  pairBucket: BucketKey,
  comp: Composition,
  dealerUp: BucketKey,
  rules: RuleConfig,
  handCount: number,
  isAcePair: boolean,
  cache: Caches,
): PayoutDist {
  const dist: PayoutDist = new Map();
  const tot = totalCount(comp);

  for (const b of BUCKET_KEYS) {
    const n = comp[b];
    if (n <= 0) continue;
    const p = n / tot;
    const cards: BucketKey[] = [pairBucket, b];
    const hv = handValue(cards); // two fresh cards can never bust
    const nextComp = cloneComposition(comp);
    nextComp[b]--;
    const hand: HandState = { total: hv.total, soft: hv.soft };

    if (isAcePair && rules.splitAcesOneCardOnly) {
      const dealerDist = dealerOutcomeDistribution(dealerUp, nextComp, rules, cache);
      const stand = standDist(hand.total, dealerDist);
      for (const [payout, pp] of stand) addTo(dist, payout, p * pp);
      continue;
    }

    const canSplitAgain =
      handCount < rules.maxSplitHands &&
      isPair(cards) &&
      (!isAcePair || rules.resplitAcesAllowed) &&
      (cards[0] !== 'T' || rules.allowSplitAnyTenValue);
    const canDouble = rules.dasAllowed;

    const dealerDist = dealerOutcomeDistribution(dealerUp, nextComp, rules, cache);
    let best = standDist(hand.total, dealerDist);
    let bestEv = evOf(best);

    if (hand.total < 21) {
      const hit = hitOnceDist(hand, nextComp, dealerUp, rules, cache);
      const hitEv = evOf(hit);
      if (hitEv > bestEv) {
        best = hit;
        bestEv = hitEv;
      }
    }

    if (canDouble) {
      const dbl = doubleDist(hand, nextComp, dealerUp, rules, cache);
      const dblEv = evOf(dbl);
      if (dblEv > bestEv) {
        best = dbl;
        bestEv = dblEv;
      }
    }

    if (canSplitAgain) {
      const split = splitDist(b, nextComp, dealerUp, rules, handCount + 1, cache);
      const splitEv = evOf(split);
      if (splitEv > bestEv) {
        best = split;
        bestEv = splitEv;
      }
    }

    for (const [payout, pp] of best) addTo(dist, payout, p * pp);
  }

  return dist;
}

/** Exact payout distribution for splitting `pairBucket`, per the standard independent-hands convention. */
function splitDist(
  pairBucket: BucketKey,
  comp: Composition,
  dealerUp: BucketKey,
  rules: RuleConfig,
  handCount: number,
  cache: Caches,
): PayoutDist {
  const isAcePair = pairBucket === 'A';
  const oneHand = splitSubhandDist(pairBucket, comp, dealerUp, rules, handCount, isAcePair, cache);
  return convolve(oneHand, oneHand);
}

function distToResult(dist: PayoutDist): ActionResult {
  let ev = 0;
  let win = 0;
  let push = 0;
  let loss = 0;
  for (const [payout, p] of dist) {
    ev += payout * p;
    if (payout > 0) win += p;
    else if (payout < 0) loss += p;
    else push += p;
  }
  return { ev, winPct: win * 100, pushPct: push * 100, lossPct: loss * 100 };
}

/**
 * Evaluates every legal action at a decision point via exact combinatorial analysis (backward
 * induction / dynamic programming over the shoe's exact remaining composition) rather than
 * sampling — deterministic, zero-variance EV and win/push/loss probabilities. Split hands follow
 * the standard exact-combinatorial convention used by published reference tables: each new hand
 * is solved exactly against the composition right after the split, independent of what the
 * sibling hand actually draws.
 */
export function evaluateDecision(req: EvaluateDecisionRequest): DecisionResults {
  const cache = newCaches();
  const { playerCards, dealerUp, unknownComposition, rules } = req;
  const hv = handValue(playerCards);
  const hand: HandState = { total: hv.total, soft: hv.soft };

  const results: DecisionResults = {};
  for (const action of req.legalActions) {
    let dist: PayoutDist;
    switch (action) {
      case 'surrender':
        results.surrender = { ev: -0.5, winPct: 0, pushPct: 0, lossPct: 100 };
        continue;
      case 'stand':
        dist = standDist(hand.total, dealerOutcomeDistribution(dealerUp, unknownComposition, rules, cache));
        break;
      case 'hit':
        dist = hitOnceDist(hand, unknownComposition, dealerUp, rules, cache);
        break;
      case 'double':
        dist = doubleDist(hand, unknownComposition, dealerUp, rules, cache);
        break;
      case 'split':
        dist = splitDist(playerCards[0], unknownComposition, dealerUp, rules, 2, cache);
        break;
    }
    results[action] = distToResult(dist);
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
