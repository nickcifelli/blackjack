import type { CSSProperties } from 'react';
import { CardView, CardBackView } from './CardView';
import type { Card } from '../../engine/cards';
import { bucketOf } from '../../engine/cards';
import { handValue } from '../../engine/hand';

interface HandViewProps {
  cards: Card[];
  hiddenCount?: number;
  label?: string;
  active?: boolean;
  bet?: number;
  status?: string;
  statusVariant?: string;
  /** Identifies the current round; changing it forces cards to remount and re-play their deal-in animation. */
  roundKey?: number;
}

// Cards that arrive together (the opening deal) fan in with a slight stagger; capped low so cards
// that arrive one at a time in real time (hits, dealer draws) don't pick up extra artificial delay.
const DEAL_STAGGER_MS = 90;
const MAX_STAGGER_STEPS = 2;

function dealDelay(index: number): CSSProperties {
  return { animationDelay: `${Math.min(index, MAX_STAGGER_STEPS) * DEAL_STAGGER_MS}ms` };
}

export function HandView({
  cards,
  hiddenCount = 0,
  label,
  active,
  bet,
  status,
  statusVariant,
  roundKey = 0,
}: HandViewProps) {
  const buckets = cards.map((c) => bucketOf(c.rank));
  const value = buckets.length > 0 ? handValue(buckets) : null;
  const showTotal = value && hiddenCount === 0;

  return (
    <div className={`hand ${active ? 'hand-active' : ''}`}>
      {label && (
        <div className="hand-label">
          {label}
          {bet && bet > 1 ? ` (bet ×${bet})` : ''}
        </div>
      )}
      <div className="hand-cards">
        {cards.map((c, i) => (
          <CardView key={`${roundKey}-${i}`} card={c} style={dealDelay(i)} />
        ))}
        {Array.from({ length: hiddenCount }).map((_, i) => (
          <CardBackView key={`${roundKey}-hidden-${i}`} style={dealDelay(cards.length + i)} />
        ))}
      </div>
      <div className="hand-total">{showTotal ? (value.bust ? 'Bust' : `${value.total}${value.soft ? ' (soft)' : ''}`) : ''}</div>
      {status && (
        // key forces remount each round so the pop animation replays instead of a static swap.
        <span key={`${roundKey}-status`} className={`hand-status hand-status-${statusVariant}`}>
          {status}
        </span>
      )}
    </div>
  );
}
