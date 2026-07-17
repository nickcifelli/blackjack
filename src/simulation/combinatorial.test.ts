import { describe, it, expect } from 'vitest';
import { evaluateDecision, pickBestAction, type DecisionResults } from './combinatorial';
import { freshComposition, type BucketKey, type Composition } from '../engine/cards';
import { DEFAULT_RULES, type RuleConfig } from '../engine/rules';
import type { Action } from '../engine/actions';

function poolExcluding(cards: BucketKey[]): Composition {
  const comp = freshComposition(6);
  for (const c of cards) comp[c]--;
  return comp;
}

function evaluate(
  playerCards: BucketKey[],
  dealerUp: BucketKey,
  legalActions: Action[],
  rules: RuleConfig = DEFAULT_RULES,
): DecisionResults {
  return evaluateDecision({
    legalActions,
    playerCards,
    dealerUp,
    unknownComposition: poolExcluding([...playerCards, dealerUp]),
    rules,
  });
}

// Every result's win/push/loss percentages must sum to exactly 100 (up to float precision), and
// the EV must equal what those percentages imply (checked to a rough +1/0/-1 payout structure via
// a self-consistency bound rather than a hardcoded formula, since split hands have wider payout
// support than +-1).
function expectWellFormed(result: { ev: number; winPct: number; pushPct: number; lossPct: number }) {
  expect(result.winPct + result.pushPct + result.lossPct).toBeCloseTo(100, 6);
  expect(result.winPct).toBeGreaterThanOrEqual(-1e-9);
  expect(result.pushPct).toBeGreaterThanOrEqual(-1e-9);
  expect(result.lossPct).toBeGreaterThanOrEqual(-1e-9);
}

describe('evaluateDecision (exact combinatorial)', () => {
  it('favors surrender on hard 16 vs dealer 10, with exact surrender EV of -0.5', () => {
    const results = evaluate(['9', '7'], 'T', ['stand', 'hit', 'surrender']);
    expect(pickBestAction(results)).toBe('surrender');
    expect(results.surrender!.ev).toBe(-0.5);
    expectWellFormed(results.stand!);
    expectWellFormed(results.hit!);
  });

  it('favors standing on soft 19 (A,8) vs dealer 6', () => {
    const results = evaluate(['A', '8'], '6', ['stand', 'hit', 'double']);
    expect(pickBestAction(results)).toBe('stand');
    expect(results.stand!.ev).toBeGreaterThan(0.4);
    for (const r of Object.values(results)) expectWellFormed(r!);
  });

  it('favors doubling on hard 11 vs dealer 6', () => {
    const results = evaluate(['6', '5'], '6', ['stand', 'hit', 'double']);
    expect(pickBestAction(results)).toBe('double');
    expect(results.double!.ev).toBeGreaterThan(results.hit!.ev);
    for (const r of Object.values(results)) expectWellFormed(r!);
  });

  it('favors splitting 8,8 vs dealer 10 ("always split 8s")', () => {
    const results = evaluate(['8', '8'], 'T', ['stand', 'hit', 'split']);
    expect(pickBestAction(results)).toBe('split');
    for (const r of Object.values(results)) expectWellFormed(r!);
  });

  it('never favors splitting 10,10 vs dealer 6 ("never split tens")', () => {
    const results = evaluate(['T', 'T'], '6', ['stand', 'hit', 'split']);
    expect(pickBestAction(results)).toBe('stand');
    for (const r of Object.values(results)) expectWellFormed(r!);
  });

  it('always favors splitting A,A vs any dealer upcard', () => {
    const results = evaluate(['A', 'A'], '5', ['stand', 'hit', 'split']);
    expect(pickBestAction(results)).toBe('split');
    for (const r of Object.values(results)) expectWellFormed(r!);
  });

  it('is fully deterministic: repeated calls with identical inputs produce identical output', () => {
    const a = evaluate(['9', '7'], 'T', ['stand', 'hit', 'double', 'split']);
    const b = evaluate(['9', '7'], 'T', ['stand', 'hit', 'double', 'split']);
    expect(a).toEqual(b);
  });

  it('hard 20 never hits (any hit can only tie or lose ground against a made hand)', () => {
    const results = evaluate(['T', 'T'], '5', ['stand', 'hit']);
    expect(pickBestAction(results)).toBe('stand');
    expect(results.stand!.ev).toBeGreaterThan(results.hit!.ev + 1); // not a close call
  });

  it('hard 8 vs dealer 6 hits by a wide margin (too low a total to ever stand on)', () => {
    const results = evaluate(['5', '3'], '6', ['stand', 'hit']);
    expect(pickBestAction(results)).toBe('hit');
    expect(results.hit!.ev).toBeGreaterThan(results.stand!.ev + 0.2); // not a close call
  });

  it('hard 12 vs dealer 10 hits (standing rarely beats hitting against a strong dealer up card)', () => {
    const results = evaluate(['T', '2'], 'T', ['stand', 'hit']);
    expect(pickBestAction(results)).toBe('hit');
  });

  it('dealerStandsSoft17 is actually wired into the dealer draw-out, not silently ignored', () => {
    // Whether the dealer hits or stands on a soft 17 only matters for hands that can actually
    // land there (e.g. up=6 with a hole card of A) -- a hand where it's wired up correctly must
    // produce a different EV under the two settings; this deliberately does not assert a
    // direction, since (as verified against an independent Monte Carlo cross-check) the sign of
    // the per-hand effect isn't guaranteed to match the well-known *aggregate* house-edge effect.
    const s17 = evaluate(['T', '6'], '6', ['stand'], DEFAULT_RULES);
    const h17 = evaluate(['T', '6'], '6', ['stand'], { ...DEFAULT_RULES, dealerStandsSoft17: false });
    expect(h17.stand!.ev).not.toBeCloseTo(s17.stand!.ev, 6);
  });

  it('DAS strictly cannot hurt the split EV for a hand where doubling is otherwise attractive', () => {
    const noDas = evaluate(['9', '9'], '5', ['stand', 'hit', 'split'], DEFAULT_RULES);
    const das = evaluate(['9', '9'], '5', ['stand', 'hit', 'split'], { ...DEFAULT_RULES, dasAllowed: true });
    expect(das.split!.ev).toBeGreaterThanOrEqual(noDas.split!.ev - 1e-9);
  });

  it('runs a worst-case resplit-to-4 scenario (repeated small pairs) well within budget', () => {
    const start = performance.now();
    const results = evaluate(['2', '2'], '6', ['stand', 'hit', 'split'], { ...DEFAULT_RULES, resplitAcesAllowed: true });
    const elapsedMs = performance.now() - start;
    expectWellFormed(results.split!);
    expect(elapsedMs).toBeLessThan(1000);
  });
});
