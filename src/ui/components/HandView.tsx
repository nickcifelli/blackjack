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
}

export function HandView({ cards, hiddenCount = 0, label, active, bet, status }: HandViewProps) {
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
          <CardView key={i} card={c} />
        ))}
        {Array.from({ length: hiddenCount }).map((_, i) => (
          <CardBackView key={`hidden-${i}`} />
        ))}
      </div>
      <div className="hand-total">
        {showTotal ? (value.bust ? 'Bust' : `${value.total}${value.soft ? ' (soft)' : ''}`) : ''}
        {status && <span className="hand-status"> {status}</span>}
      </div>
    </div>
  );
}
