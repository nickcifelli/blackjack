export interface RuleConfig {
  decks: number;
  dealerStandsSoft17: boolean;
  blackjackPayout: number;
  dealerPeeksForBlackjack: boolean;
  /** Double after split allowed. */
  dasAllowed: boolean;
  maxSplitHands: number;
  resplitAcesAllowed: boolean;
  splitAcesOneCardOnly: boolean;
  /** Allow splitting any two 10-value cards (e.g. K+Q), not just exact rank matches. */
  allowSplitAnyTenValue: boolean;
  /** Only legal as the very first action on an original, unsplit two-card hand. */
  lateSurrenderAllowed: boolean;
  /** Cards left in the shoe when the cut card is reached; a reshuffle is triggered once this few (or fewer) cards remain. */
  cutCardDepth: number;
}

export const DEFAULT_RULES: RuleConfig = {
  decks: 6,
  dealerStandsSoft17: true,
  blackjackPayout: 1.5,
  dealerPeeksForBlackjack: true,
  dasAllowed: false,
  maxSplitHands: 4,
  resplitAcesAllowed: false,
  splitAcesOneCardOnly: true,
  allowSplitAnyTenValue: true,
  lateSurrenderAllowed: false,
  cutCardDepth: 50,
};
