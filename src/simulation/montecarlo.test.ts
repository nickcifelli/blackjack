import { describe, it, expect } from 'vitest';
import { evaluateDecision, pickBestAction } from './montecarlo';
import { freshComposition, type BucketKey, type Composition } from '../engine/cards';
import { DEFAULT_RULES } from '../engine/rules';
import type { Action } from '../engine/actions';

// Small seeded PRNG so these Monte Carlo sanity checks are deterministic.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poolExcluding(cards: BucketKey[]): Composition {
  const comp = freshComposition(6);
  for (const c of cards) comp[c]--;
  return comp;
}

const TRIALS = 30_000;

// These assert the simulator's highest-EV action matches published 6-deck,
// dealer-stands-soft-17 basic strategy for a few canonical hands. Composition
// is a near-full shoe (only the dealt cards removed) so results should track
// the static basic-strategy numbers closely.
describe('evaluateDecision (Monte Carlo sanity checks)', () => {
  it('favors surrender on hard 16 vs dealer 10', () => {
    const playerCards: BucketKey[] = ['9', '7'];
    const dealerUp: BucketKey = 'T';
    const results = evaluateDecision(
      {
        legalActions: ['stand', 'hit', 'surrender'] as Action[],
        playerCards,
        dealerUp,
        unknownComposition: poolExcluding([...playerCards, dealerUp]),
        rules: DEFAULT_RULES,
        trials: TRIALS,
      },
      mulberry32(42),
    );
    // hit vs. stand for this hand is famously a razor-thin margin (a few
    // thousandths of an EV) -- too noisy to assert reliably at this trial
    // count, so we only assert the much clearer fact that surrender wins.
    expect(pickBestAction(results)).toBe('surrender');
    expect(results.surrender!.ev).toBe(-0.5);
  });

  it('favors standing on soft 19 (A,8) vs dealer 6', () => {
    const playerCards: BucketKey[] = ['A', '8'];
    const dealerUp: BucketKey = '6';
    const results = evaluateDecision(
      {
        legalActions: ['stand', 'hit', 'double'] as Action[],
        playerCards,
        dealerUp,
        unknownComposition: poolExcluding([...playerCards, dealerUp]),
        rules: DEFAULT_RULES,
        trials: TRIALS,
      },
      mulberry32(7),
    );
    expect(pickBestAction(results)).toBe('stand');
    expect(results.stand!.ev).toBeGreaterThan(0.4);
  });

  it('favors doubling on hard 11 vs dealer 6', () => {
    const playerCards: BucketKey[] = ['6', '5'];
    const dealerUp: BucketKey = '6';
    const results = evaluateDecision(
      {
        legalActions: ['stand', 'hit', 'double'] as Action[],
        playerCards,
        dealerUp,
        unknownComposition: poolExcluding([...playerCards, dealerUp]),
        rules: DEFAULT_RULES,
        trials: TRIALS,
      },
      mulberry32(123),
    );
    expect(pickBestAction(results)).toBe('double');
    expect(results.double!.ev).toBeGreaterThan(results.hit!.ev);
  });

  it('favors splitting 8,8 vs dealer 10 ("always split 8s")', () => {
    const playerCards: BucketKey[] = ['8', '8'];
    const dealerUp: BucketKey = 'T';
    const results = evaluateDecision(
      {
        legalActions: ['stand', 'hit', 'split'] as Action[],
        playerCards,
        dealerUp,
        unknownComposition: poolExcluding([...playerCards, dealerUp]),
        rules: DEFAULT_RULES,
        trials: TRIALS,
      },
      mulberry32(99),
    );
    expect(pickBestAction(results)).toBe('split');
  });
});
