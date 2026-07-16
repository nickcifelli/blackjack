import { type BucketKey, bucketValue } from './cards';
import { handValue, isPair } from './hand';

/**
 * Standard 6-deck, DAS-allowed basic strategy. Used only as the continuation
 * policy for hypothetical FUTURE decisions inside a Monte Carlo rollout (e.g.
 * what to do after this hit, or how to play out a split hand) — never for the
 * real decision point being evaluated, which is scored directly via
 * simulation. Surrender is intentionally not part of this table: surrender is
 * only ever legal as the very first action on an original two-card hand,
 * which is never a position a rollout continues from.
 */
export type BasicAction = 'H' | 'S' | 'D' | 'P';

export interface DecisionContext {
  cards: BucketKey[];
  dealerUp: BucketKey;
  canDouble: boolean;
  canSplit: boolean;
  /** Whether the dealer hits (rather than stands) on a soft 17; shifts a handful of table entries. */
  dealerHitsSoft17: boolean;
}

function dealerIndex(dealerUp: BucketKey): number {
  return bucketValue(dealerUp); // 2..10, or 11 for an Ace
}

const HARD_TABLE: Record<number, (dv: number, h17: boolean) => BasicAction> = {
  9: (dv) => (dv >= 3 && dv <= 6 ? 'D' : 'H'),
  10: (dv) => (dv >= 2 && dv <= 9 ? 'D' : 'H'),
  // 11 vs dealer A: hit under S17, double under H17 (6-deck basic strategy).
  11: (dv, h17) => (dv <= 10 || h17 ? 'D' : 'H'),
  12: (dv) => (dv >= 4 && dv <= 6 ? 'S' : 'H'),
  13: (dv) => (dv >= 2 && dv <= 6 ? 'S' : 'H'),
  14: (dv) => (dv >= 2 && dv <= 6 ? 'S' : 'H'),
  15: (dv) => (dv >= 2 && dv <= 6 ? 'S' : 'H'),
  16: (dv) => (dv >= 2 && dv <= 6 ? 'S' : 'H'),
};

const SOFT_TABLE: Record<number, (dv: number, h17: boolean) => BasicAction> = {
  13: (dv) => (dv >= 5 && dv <= 6 ? 'D' : 'H'), // A,2
  14: (dv) => (dv >= 5 && dv <= 6 ? 'D' : 'H'), // A,3
  15: (dv) => (dv >= 4 && dv <= 6 ? 'D' : 'H'), // A,4
  16: (dv) => (dv >= 4 && dv <= 6 ? 'D' : 'H'), // A,5
  17: (dv) => (dv >= 3 && dv <= 6 ? 'D' : 'H'), // A,6
  18: (dv, h17) => {
    // A,7 vs 2: stand under S17, double under H17.
    if (dv === 2) return h17 ? 'D' : 'S';
    if (dv >= 3 && dv <= 6) return 'D';
    if (dv === 7 || dv === 8) return 'S';
    return 'H'; // 9, 10, A
  },
  // A,8 vs 6: stand under S17, double under H17.
  19: (dv, h17) => (dv === 6 && h17 ? 'D' : 'S'),
  20: () => 'S',
};

// 5,5 and 10,10 deliberately have no entry: they're never split (played as
// hard 10 / stood on respectively), which falls out of the table below.
const PAIR_SPLIT: Partial<Record<BucketKey, (dv: number) => boolean>> = {
  '2': (dv) => dv >= 2 && dv <= 7,
  '3': (dv) => dv >= 2 && dv <= 7,
  '4': (dv) => dv === 5 || dv === 6,
  '6': (dv) => dv >= 2 && dv <= 6,
  '7': (dv) => dv >= 2 && dv <= 7,
  '8': () => true,
  '9': (dv) => (dv >= 2 && dv <= 6) || dv === 8 || dv === 9,
  A: () => true,
};

export function basicStrategyAction(ctx: DecisionContext): BasicAction {
  const { cards, canDouble, canSplit, dealerHitsSoft17 } = ctx;
  const dv = dealerIndex(ctx.dealerUp);

  if (canSplit && isPair(cards)) {
    const shouldSplit = PAIR_SPLIT[cards[0]]?.(dv) ?? false;
    if (shouldSplit) return 'P';
  }

  const { total, soft } = handValue(cards);

  if (soft && total >= 13 && total <= 20) {
    const action = SOFT_TABLE[total]?.(dv, dealerHitsSoft17) ?? 'S';
    return action === 'D' && !canDouble ? 'H' : action;
  }

  if (total >= 17) return 'S';
  if (total <= 8) return 'H';
  const action = HARD_TABLE[total]?.(dv, dealerHitsSoft17) ?? 'H';
  return action === 'D' && !canDouble ? 'H' : action;
}
