import { type BucketKey, bucketValue } from './cards';
import { handValue, isPair } from './hand';

/**
 * Standard 6-deck, dealer-stands-soft-17, DAS-allowed basic strategy. Used only
 * as the continuation policy for hypothetical FUTURE decisions inside a Monte
 * Carlo rollout (e.g. what to do after this hit, or how to play out a split
 * hand) — never for the real decision point being evaluated, which is scored
 * directly via simulation. Surrender is intentionally not part of this table:
 * surrender is only ever legal as the very first action on an original
 * two-card hand, which is never a position a rollout continues from.
 */
export type BasicAction = 'H' | 'S' | 'D' | 'P';

export interface DecisionContext {
  cards: BucketKey[];
  dealerUp: BucketKey;
  canDouble: boolean;
  canSplit: boolean;
}

function dealerIndex(dealerUp: BucketKey): number {
  return bucketValue(dealerUp); // 2..10, or 11 for an Ace
}

const HARD_TABLE: Record<number, (dv: number) => BasicAction> = {
  9: (dv) => (dv >= 3 && dv <= 6 ? 'D' : 'H'),
  10: (dv) => (dv >= 2 && dv <= 9 ? 'D' : 'H'),
  11: (dv) => (dv <= 10 ? 'D' : 'H'),
  12: (dv) => (dv >= 4 && dv <= 6 ? 'S' : 'H'),
  13: (dv) => (dv >= 2 && dv <= 6 ? 'S' : 'H'),
  14: (dv) => (dv >= 2 && dv <= 6 ? 'S' : 'H'),
  15: (dv) => (dv >= 2 && dv <= 6 ? 'S' : 'H'),
  16: (dv) => (dv >= 2 && dv <= 6 ? 'S' : 'H'),
};

const SOFT_TABLE: Record<number, (dv: number) => BasicAction> = {
  13: (dv) => (dv >= 5 && dv <= 6 ? 'D' : 'H'), // A,2
  14: (dv) => (dv >= 5 && dv <= 6 ? 'D' : 'H'), // A,3
  15: (dv) => (dv >= 4 && dv <= 6 ? 'D' : 'H'), // A,4
  16: (dv) => (dv >= 4 && dv <= 6 ? 'D' : 'H'), // A,5
  17: (dv) => (dv >= 3 && dv <= 6 ? 'D' : 'H'), // A,6
  18: (dv) => {
    if (dv >= 3 && dv <= 6) return 'D';
    if (dv === 2 || dv === 7 || dv === 8) return 'S';
    return 'H'; // 9, 10, A
  },
  19: () => 'S',
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
  const { cards, canDouble, canSplit } = ctx;
  const dv = dealerIndex(ctx.dealerUp);

  if (canSplit && isPair(cards)) {
    const shouldSplit = PAIR_SPLIT[cards[0]]?.(dv) ?? false;
    if (shouldSplit) return 'P';
  }

  const { total, soft } = handValue(cards);

  if (soft && total >= 13 && total <= 20) {
    const action = SOFT_TABLE[total]?.(dv) ?? 'S';
    return action === 'D' && !canDouble ? 'H' : action;
  }

  if (total >= 17) return 'S';
  if (total <= 8) return 'H';
  const action = HARD_TABLE[total]?.(dv) ?? 'H';
  return action === 'D' && !canDouble ? 'H' : action;
}
