import { type BucketKey, type Composition, cloneComposition } from '../engine/cards';

/**
 * Builds the composition the dealer's hidden hole card is sampled from.
 * `baseUnknown` (typically `shoe.unknownComposition()`) already nets out
 * every card visible to the player this shoe — their own hands, the dealer's
 * up card, and any sibling split hands. This layer adds one more condition:
 * decisions are only ever offered after the dealer's peek clears, so the hole
 * card can never be the rank that would have completed a blackjack.
 */
export function holeCardPool(baseUnknown: Composition, dealerUp: BucketKey): Composition {
  const pool = cloneComposition(baseUnknown);
  if (dealerUp === 'A') pool['T'] = 0;
  if (dealerUp === 'T') pool['A'] = 0;
  return pool;
}
