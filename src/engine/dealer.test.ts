import { describe, it, expect } from 'vitest';
import { playDealerHand } from './dealer';
import { DEFAULT_RULES } from './rules';
import type { BucketKey } from './cards';

describe('playDealerHand', () => {
  it('stands on soft 17 under S17 rules, never drawing another card', () => {
    let calls = 0;
    const result = playDealerHand(
      ['A', '6'],
      () => {
        calls++;
        return '9';
      },
      DEFAULT_RULES,
    );
    expect(result).toEqual<BucketKey[]>(['A', '6']);
    expect(calls).toBe(0);
  });

  it('hits soft 17 under H17 rules', () => {
    let calls = 0;
    const rules = { ...DEFAULT_RULES, dealerStandsSoft17: false };
    const result = playDealerHand(
      ['A', '6'],
      () => {
        calls++;
        return '2';
      },
      rules,
    );
    expect(calls).toBe(1);
    expect(result).toEqual<BucketKey[]>(['A', '6', '2']);
  });

  it('hits hard totals below 17 and stands once at or above 17', () => {
    const result = playDealerHand(['5', '6'], () => '5', DEFAULT_RULES);
    // 5,6 = 11 -> hit -> 5,6,5 = 16 -> hit -> 5,6,5,5 = 21 -> stand
    expect(result).toEqual<BucketKey[]>(['5', '6', '5', '5']);
  });

  it('stops drawing once busted', () => {
    const result = playDealerHand(['T', '6'], () => 'T', DEFAULT_RULES);
    // T,6 = 16 -> hit -> T,6,T = 26 -> bust, stop
    expect(result).toEqual<BucketKey[]>(['T', '6', 'T']);
  });
});
