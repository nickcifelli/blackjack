import type { CSSProperties } from 'react';
import type { Card, Suit } from '../../engine/cards';

const SUIT_SYMBOLS: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

const RED_SUITS = new Set<Suit>(['diamonds', 'hearts']);

export function CardView({ card, style }: { card: Card; style?: CSSProperties }) {
  const isRed = RED_SUITS.has(card.suit);
  return (
    <div className={`card ${isRed ? 'card-red' : 'card-black'}`} style={style}>
      <span className="card-rank">{card.rank}</span>
      <span className="card-suit">{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  );
}

export function CardBackView({ style }: { style?: CSSProperties }) {
  return <div className="card card-back" aria-label="Hidden card" style={style} />;
}
