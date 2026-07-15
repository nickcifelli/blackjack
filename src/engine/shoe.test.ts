import { describe, it, expect } from 'vitest';
import { Shoe } from './shoe';
import { DEFAULT_RULES } from './rules';
import { totalCount } from './cards';

describe('Shoe', () => {
  it('starts with a full 6-deck composition unknown to the player', () => {
    const shoe = new Shoe(DEFAULT_RULES);
    expect(totalCount(shoe.unknownComposition())).toBe(312);
    expect(shoe.remainingCount()).toBe(312);
  });

  it('removes a card from the unknown pool once marked revealed', () => {
    const shoe = new Shoe(DEFAULT_RULES);
    const card = shoe.deal();
    shoe.markRevealed(card.rank);
    expect(totalCount(shoe.unknownComposition())).toBe(311);
    expect(shoe.remainingCount()).toBe(311);
  });

  it('keeps a dealt-but-unrevealed card (the dealer hole card) in the unknown pool', () => {
    const shoe = new Shoe(DEFAULT_RULES);
    shoe.deal(); // dealt, but never marked revealed
    expect(totalCount(shoe.unknownComposition())).toBe(312);
    expect(shoe.remainingCount()).toBe(311);
  });

  it('signals a reshuffle once the penetration threshold is crossed', () => {
    const rules = { ...DEFAULT_RULES, penetration: 0.5 };
    const shoe = new Shoe(rules);
    const total = shoe.totalSize();
    for (let i = 0; i < total * 0.5 - 1; i++) shoe.deal();
    expect(shoe.needsReshuffle()).toBe(false);
    shoe.deal();
    expect(shoe.needsReshuffle()).toBe(true);
  });

  it('resets composition tracking on reshuffle', () => {
    const shoe = new Shoe(DEFAULT_RULES);
    const card = shoe.deal();
    shoe.markRevealed(card.rank);
    shoe.reshuffle();
    expect(totalCount(shoe.unknownComposition())).toBe(312);
    expect(shoe.remainingCount()).toBe(312);
  });
});
