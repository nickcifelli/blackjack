import { type BucketKey, bucketValue } from './cards';

export interface HandValue {
  total: number;
  /** True if an ace is still being counted as 11 in `total`. */
  soft: boolean;
  bust: boolean;
}

export function handValue(cards: BucketKey[]): HandValue {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += bucketValue(c);
    if (c === 'A') aces++;
  }
  let softAces = aces;
  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces--;
  }
  return { total, soft: softAces > 0, bust: total > 21 };
}

export function isPair(cards: BucketKey[]): boolean {
  return cards.length === 2 && cards[0] === cards[1];
}

/** A natural blackjack: 21 on the original two cards, and not the result of a split. */
export function isNaturalBlackjack(cards: BucketKey[], isFromSplit: boolean): boolean {
  return !isFromSplit && cards.length === 2 && handValue(cards).total === 21;
}
