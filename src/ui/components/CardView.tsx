import type { Card, Suit } from '../../engine/cards';

const SUIT_SYMBOLS: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

const RED_SUITS = new Set<Suit>(['diamonds', 'hearts']);

export function CardView({ card }: { card: Card }) {
  const isRed = RED_SUITS.has(card.suit);
  return (
    <div className={`card ${isRed ? 'card-red' : 'card-black'}`}>
      <span className="card-rank">{card.rank}</span>
      <span className="card-suit">{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  );
}

export function CardBackView() {
  return <div className="card card-back" aria-label="Hidden card" />;
}
