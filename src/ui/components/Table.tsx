import { HandView } from './HandView';
import type { Card } from '../../engine/cards';
import type { PlayerHand, RoundPhase, RoundSummary } from '../../engine/round';

interface TableProps {
  dealerCards: Card[];
  dealerHoleRevealed: boolean;
  hands: PlayerHand[];
  activeHandIndex: number;
  phase: RoundPhase;
  summary: RoundSummary | null;
}

const OUTCOME_LABELS: Record<string, string> = {
  win: 'Win',
  loss: 'Loss',
  push: 'Push',
  blackjack: 'Blackjack!',
  surrender: 'Surrendered',
};

export function Table({ dealerCards, dealerHoleRevealed, hands, activeHandIndex, phase, summary }: TableProps) {
  // Changes every new round (each fresh hand gets a new id), so cards animate back in on deal
  // instead of the same DOM nodes silently swapping content from the previous round.
  const roundKey = hands[0]?.id ?? 0;

  return (
    <div className="table">
      <HandView cards={dealerCards} hiddenCount={dealerHoleRevealed ? 0 : 1} label="Dealer" roundKey={roundKey} />

      <div className="player-hands">
        {hands.map((hand, i) => {
          const result = summary?.results.find((r) => r.handId === hand.id);
          const status = result ? OUTCOME_LABELS[result.outcome] : hand.surrendered ? 'Surrendered' : undefined;
          return (
            <HandView
              key={hand.id}
              cards={hand.cards}
              label={hands.length > 1 ? `Hand ${i + 1}` : 'You'}
              active={phase === 'player-turn' && i === activeHandIndex}
              bet={hand.bet}
              status={status}
              roundKey={roundKey}
            />
          );
        })}
      </div>
    </div>
  );
}
