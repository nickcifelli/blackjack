import {
  type Card,
  type Composition,
  type Rank,
  RANKS,
  SUITS,
  BUCKET_KEYS,
  bucketOf,
  freshComposition,
  zeroComposition,
} from './cards';
import type { RuleConfig } from './rules';

function buildDeck(decks: number): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const rank of RANKS) {
      for (const suit of SUITS) {
        cards.push({ rank, suit });
      }
    }
  }
  return cards;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * The physical 6-deck shoe. Tracks the real dealt sequence plus a running
 * ledger of everything revealed to the player this shoe (`revealed`), which is
 * exactly the composition-dependent knowledge the Monte Carlo simulator draws
 * against. Cards dealt to the dealer's hole position are NOT marked revealed
 * until `markRevealed` is called for them explicitly at hand resolution.
 */
export class Shoe {
  private cards: Card[] = [];
  private nextIndex = 0;
  private rules: RuleConfig;
  revealed: Composition = zeroComposition();

  constructor(rules: RuleConfig) {
    this.rules = rules;
    this.reshuffle();
  }

  reshuffle(): void {
    this.cards = shuffle(buildDeck(this.rules.decks));
    this.nextIndex = 0;
    this.revealed = zeroComposition();
  }

  deal(): Card {
    if (this.nextIndex >= this.cards.length) {
      throw new Error('Shoe exhausted; should have reshuffled before dealing');
    }
    return this.cards[this.nextIndex++];
  }

  markRevealed(rank: Rank): void {
    this.revealed[bucketOf(rank)]++;
  }

  needsReshuffle(): boolean {
    const dealtFraction = this.nextIndex / this.cards.length;
    return dealtFraction >= this.rules.penetration;
  }

  remainingCount(): number {
    return this.cards.length - this.nextIndex;
  }

  totalSize(): number {
    return this.cards.length;
  }

  /** Fresh shoe composition minus everything revealed to the player so far this shoe. */
  unknownComposition(): Composition {
    const fresh = freshComposition(this.rules.decks);
    const result = {} as Composition;
    for (const b of BUCKET_KEYS) result[b] = fresh[b] - this.revealed[b];
    return result;
  }
}
