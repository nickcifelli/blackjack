export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];

// Blackjack math never cares about exact 10/J/Q/K distinction or suit, so all
// simulation and hand-value logic works over these 10 value buckets instead.
export type BucketKey = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'A';
export const BUCKET_KEYS: BucketKey[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'A'];

export function bucketOf(rank: Rank): BucketKey {
  if (rank === 'A') return 'A';
  if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return 'T';
  return rank;
}

export function bucketValue(bucket: BucketKey): number {
  if (bucket === 'A') return 11;
  if (bucket === 'T') return 10;
  return Number(bucket);
}

export type Composition = Record<BucketKey, number>;

export function freshComposition(decks: number): Composition {
  const comp = {} as Composition;
  for (const b of BUCKET_KEYS) comp[b] = (b === 'T' ? 16 : 4) * decks;
  return comp;
}

export function zeroComposition(): Composition {
  const comp = {} as Composition;
  for (const b of BUCKET_KEYS) comp[b] = 0;
  return comp;
}

export function cloneComposition(c: Composition): Composition {
  return { ...c };
}

export function totalCount(c: Composition): number {
  return BUCKET_KEYS.reduce((sum, b) => sum + c[b], 0);
}
