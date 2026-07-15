import { describe, it, expect } from 'vitest';
import { handValue, isPair, isNaturalBlackjack } from './hand';

describe('handValue', () => {
  it('sums simple hard hands', () => {
    const v = handValue(['7', '8']);
    expect(v.total).toBe(15);
    expect(v.soft).toBe(false);
    expect(v.bust).toBe(false);
  });

  it('treats a single ace as 11 when possible', () => {
    const v = handValue(['A', '6']);
    expect(v.total).toBe(17);
    expect(v.soft).toBe(true);
  });

  it('demotes an ace to 1 when counting it as 11 would bust', () => {
    const v = handValue(['A', '6', '9']);
    expect(v.total).toBe(16);
    expect(v.soft).toBe(false);
  });

  it('handles multiple aces, counting only one as 11', () => {
    const v = handValue(['A', 'A', '9']);
    expect(v.total).toBe(21);
    expect(v.soft).toBe(true);
  });

  it('demotes both aces when needed', () => {
    // 11 + 11 + 9 + 9 = 40 -> demote both aces -> 1 + 1 + 9 + 9 = 20
    const v = handValue(['A', 'A', '9', '9']);
    expect(v.total).toBe(20);
    expect(v.soft).toBe(false);
  });

  it('flags a bust', () => {
    const v = handValue(['T', 'T', '5']);
    expect(v.total).toBe(25);
    expect(v.bust).toBe(true);
  });
});

describe('isPair', () => {
  it('detects two-card pairs, including any two 10-value cards', () => {
    expect(isPair(['8', '8'])).toBe(true);
    expect(isPair(['T', 'T'])).toBe(true);
  });

  it('rejects non-pairs and non-two-card hands', () => {
    expect(isPair(['8', '9'])).toBe(false);
    expect(isPair(['8', '8', '8'])).toBe(false);
  });
});

describe('isNaturalBlackjack', () => {
  it('recognizes a natural 21 on the original two cards', () => {
    expect(isNaturalBlackjack(['A', 'T'], false)).toBe(true);
  });

  it('does not count a split hand as a natural, even at 21 with two cards', () => {
    expect(isNaturalBlackjack(['A', 'T'], true)).toBe(false);
  });

  it('does not count a multi-card 21 as a natural', () => {
    expect(isNaturalBlackjack(['7', '7', '7'], false)).toBe(false);
  });
});
