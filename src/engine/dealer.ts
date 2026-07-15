import type { BucketKey } from './cards';
import { handValue } from './hand';
import type { RuleConfig } from './rules';

/**
 * Plays out a dealer hand starting from `initialCards`, drawing via `drawCard`
 * until the dealer must stand or busts. Shared by the real game (drawCard pulls
 * from the physical shoe) and Monte Carlo rollouts (drawCard samples a composition).
 */
export function playDealerHand(
  initialCards: BucketKey[],
  drawCard: () => BucketKey,
  rules: RuleConfig,
): BucketKey[] {
  const cards = [...initialCards];
  for (;;) {
    const { total, soft, bust } = handValue(cards);
    if (bust) break;
    if (total > 17) break;
    if (total === 17) {
      if (soft && !rules.dealerStandsSoft17) {
        cards.push(drawCard());
        continue;
      }
      break;
    }
    cards.push(drawCard());
  }
  return cards;
}
