import { type Card, type BucketKey, bucketOf } from './cards';
import { handValue, isPair, isNaturalBlackjack } from './hand';
import { playDealerHand } from './dealer';
import { Shoe } from './shoe';
import { DEFAULT_RULES, type RuleConfig } from './rules';
import type { Action } from './actions';

export interface PlayerHand {
  id: number;
  cards: Card[];
  /** In units of the original single-hand bet; 2 once doubled. */
  bet: number;
  isFromSplit: boolean;
  isSplitAces: boolean;
  doubled: boolean;
  surrendered: boolean;
  done: boolean;
}

export type HandOutcome = 'win' | 'loss' | 'push' | 'blackjack' | 'surrender';

export interface HandResult {
  handId: number;
  outcome: HandOutcome;
  /** Net result in units of the original single-hand bet. */
  evUnits: number;
}

export type RoundPhase = 'player-turn' | 'round-over';

export interface RoundSummary {
  dealerCards: Card[];
  dealerBlackjack: boolean;
  results: HandResult[];
}

let nextHandId = 1;

export function bucketsOf(hand: PlayerHand): BucketKey[] {
  return hand.cards.map((c) => bucketOf(c.rank));
}

function freshHand(): PlayerHand {
  return {
    id: nextHandId++,
    cards: [],
    bet: 1,
    isFromSplit: false,
    isSplitAces: false,
    doubled: false,
    surrendered: false,
    done: false,
  };
}

export class GameRound {
  readonly shoe: Shoe;
  readonly rules: RuleConfig;

  phase: RoundPhase = 'player-turn';
  dealerUpCard!: Card;
  private dealerHoleCard!: Card;
  /** Only the up card until the hole card is revealed at resolution. */
  dealerCards: Card[] = [];
  hands: PlayerHand[] = [];
  activeHandIndex = 0;
  summary: RoundSummary | null = null;

  constructor(rules: RuleConfig = DEFAULT_RULES, shoe?: Shoe) {
    this.rules = rules;
    this.shoe = shoe ?? new Shoe(rules);
    this.deal();
  }

  private dealCardToPlayer(hand: PlayerHand): Card {
    const card = this.shoe.deal();
    this.shoe.markRevealed(card.rank);
    hand.cards.push(card);
    return card;
  }

  /** A hand at 21 or bust has no further legal actions; hitting from 21 can only bust. */
  private finishIfComplete(hand: PlayerHand): void {
    if (handValue(bucketsOf(hand)).total >= 21) hand.done = true;
  }

  private revealHoleCard(): void {
    this.shoe.markRevealed(this.dealerHoleCard.rank);
    this.dealerCards.push(this.dealerHoleCard);
  }

  /** Deals a fresh round. Called by the constructor, and again for each subsequent hand. */
  deal(): void {
    if (this.shoe.needsReshuffle()) this.shoe.reshuffle();

    const playerHand = freshHand();
    this.hands = [playerHand];
    this.activeHandIndex = 0;
    this.summary = null;
    this.phase = 'player-turn';

    this.dealCardToPlayer(playerHand);
    const up = this.shoe.deal();
    this.shoe.markRevealed(up.rank);
    this.dealerUpCard = up;
    this.dealCardToPlayer(playerHand);
    this.dealerHoleCard = this.shoe.deal(); // not marked revealed until resolution
    this.dealerCards = [this.dealerUpCard];

    const dealerUpBucket = bucketOf(this.dealerUpCard.rank);
    const dealerMightHaveBlackjack = dealerUpBucket === 'A' || dealerUpBucket === 'T';

    if (this.rules.dealerPeeksForBlackjack && dealerMightHaveBlackjack) {
      const holeBucket = bucketOf(this.dealerHoleCard.rank);
      const dealerHasBlackjack =
        (dealerUpBucket === 'A' && holeBucket === 'T') || (dealerUpBucket === 'T' && holeBucket === 'A');
      if (dealerHasBlackjack) {
        this.revealHoleCard();
        this.resolveRound();
        return;
      }
    }

    if (isNaturalBlackjack(bucketsOf(playerHand), false)) {
      playerHand.done = true;
      this.revealHoleCard();
      this.resolveRound();
    }
  }

  /** Discards the current shoe, including any dealt-but-unseen cards, and deals a fresh round from a new one. */
  newShoe(): void {
    this.shoe.reshuffle();
    this.deal();
  }

  /** Changes whether the dealer hits or stands on soft 17, then starts a fresh shoe under the new rule. */
  setDealerStandsSoft17(standsSoft17: boolean): void {
    this.rules.dealerStandsSoft17 = standsSoft17;
    this.newShoe();
  }

  /** Changes whether doubling after a split is allowed, then starts a fresh shoe under the new rule. */
  setDasAllowed(dasAllowed: boolean): void {
    this.rules.dasAllowed = dasAllowed;
    this.newShoe();
  }

  /** Changes whether late surrender is allowed, then starts a fresh shoe under the new rule. */
  setLateSurrenderAllowed(lateSurrenderAllowed: boolean): void {
    this.rules.lateSurrenderAllowed = lateSurrenderAllowed;
    this.newShoe();
  }

  legalActions(handIndex: number = this.activeHandIndex): Action[] {
    const hand = this.hands[handIndex];
    if (!hand || hand.done) return [];
    const buckets = bucketsOf(hand);
    const isFirstAction = hand.cards.length === 2 && !hand.doubled;

    const actions: Action[] = ['stand', 'hit'];

    if (isFirstAction && (!hand.isFromSplit || this.rules.dasAllowed)) {
      actions.push('double');
    }

    if (
      isFirstAction &&
      this.hands.length < this.rules.maxSplitHands &&
      isPair(buckets) &&
      (buckets[0] !== 'T' || this.rules.allowSplitAnyTenValue || hand.cards[0].rank === hand.cards[1].rank)
    ) {
      actions.push('split');
    }

    if (this.rules.lateSurrenderAllowed && isFirstAction && this.hands.length === 1 && !hand.isFromSplit) {
      actions.push('surrender');
    }

    return actions;
  }

  applyAction(action: Action): void {
    const hand = this.hands[this.activeHandIndex];
    if (!hand || hand.done) throw new Error('No active hand to act on');
    if (!this.legalActions().includes(action)) {
      throw new Error(`Illegal action "${action}" for the current hand`);
    }

    switch (action) {
      case 'stand':
        hand.done = true;
        break;

      case 'hit': {
        this.dealCardToPlayer(hand);
        this.finishIfComplete(hand);
        break;
      }

      case 'double': {
        hand.bet = 2;
        hand.doubled = true;
        this.dealCardToPlayer(hand);
        hand.done = true;
        break;
      }

      case 'split': {
        const [cardA, cardB] = hand.cards;
        const wasAces = bucketOf(cardA.rank) === 'A';

        hand.cards = [cardA];
        hand.isFromSplit = true;
        hand.isSplitAces = wasAces;
        this.dealCardToPlayer(hand);
        if (wasAces && this.rules.splitAcesOneCardOnly) hand.done = true;
        else this.finishIfComplete(hand);

        const newHand = freshHand();
        newHand.cards = [cardB];
        newHand.isFromSplit = true;
        newHand.isSplitAces = wasAces;
        this.dealCardToPlayer(newHand);
        if (wasAces && this.rules.splitAcesOneCardOnly) newHand.done = true;
        else this.finishIfComplete(newHand);

        this.hands.splice(this.activeHandIndex + 1, 0, newHand);
        break;
      }

      case 'surrender':
        hand.surrendered = true;
        hand.done = true;
        break;
    }

    this.advance();
  }

  private advance(): void {
    let idx = this.activeHandIndex;
    while (idx < this.hands.length && this.hands[idx].done) idx++;

    if (idx < this.hands.length) {
      this.activeHandIndex = idx;
      return;
    }

    const anyLiveHand = this.hands.some((h) => !h.surrendered && !handValue(bucketsOf(h)).bust);
    this.revealHoleCard();

    if (anyLiveHand) {
      playDealerHand(
        this.dealerCards.map((c) => bucketOf(c.rank)),
        () => {
          const card = this.shoe.deal();
          this.shoe.markRevealed(card.rank);
          this.dealerCards.push(card);
          return bucketOf(card.rank);
        },
        this.rules,
      );
    }

    this.resolveRound();
  }

  private resolveRound(): void {
    const dealerBuckets = this.dealerCards.map((c) => bucketOf(c.rank));
    const dealerValue = handValue(dealerBuckets);
    const dealerBlackjack = isNaturalBlackjack(dealerBuckets, false);

    const results: HandResult[] = this.hands.map((hand) => {
      if (hand.surrendered) {
        return { handId: hand.id, outcome: 'surrender', evUnits: -0.5 };
      }

      const buckets = bucketsOf(hand);
      const playerValue = handValue(buckets);
      const playerBlackjack = isNaturalBlackjack(buckets, hand.isFromSplit);

      if (playerValue.bust) {
        return { handId: hand.id, outcome: 'loss', evUnits: -hand.bet };
      }
      if (playerBlackjack && dealerBlackjack) {
        return { handId: hand.id, outcome: 'push', evUnits: 0 };
      }
      if (playerBlackjack) {
        return { handId: hand.id, outcome: 'blackjack', evUnits: this.rules.blackjackPayout * hand.bet };
      }
      if (dealerBlackjack || (!dealerValue.bust && playerValue.total < dealerValue.total)) {
        return { handId: hand.id, outcome: 'loss', evUnits: -hand.bet };
      }
      if (dealerValue.bust || playerValue.total > dealerValue.total) {
        return { handId: hand.id, outcome: 'win', evUnits: hand.bet };
      }
      return { handId: hand.id, outcome: 'push', evUnits: 0 };
    });

    this.summary = { dealerCards: [...this.dealerCards], dealerBlackjack, results };
    this.phase = 'round-over';
  }
}
