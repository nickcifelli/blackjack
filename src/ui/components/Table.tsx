import { HandView } from './HandView';
import type { Card } from '../../engine/cards';
import type { HandOutcome, HandResult, PlayerHand, RoundPhase, RoundSummary } from '../../engine/round';

interface TableProps {
  dealerCards: Card[];
  dealerHoleRevealed: boolean;
  hands: PlayerHand[];
  activeHandIndex: number;
  phase: RoundPhase;
  summary: RoundSummary | null;
}

/** Maps each outcome to its badge styling variant; blackjack scenarios get their own look. */
const OUTCOME_VARIANTS: Record<HandOutcome, string> = {
  win: 'win',
  loss: 'loss',
  push: 'push',
  blackjack: 'blackjack',
  surrender: 'push',
};

function outcomeStatus(result: HandResult, dealerBlackjack: boolean): { label: string; variant: string } {
  switch (result.outcome) {
    case 'blackjack':
      return { label: 'Blackjack! You Win', variant: 'blackjack' };
    case 'win':
      return { label: 'You Win', variant: 'win' };
    case 'loss':
      return { label: dealerBlackjack ? 'Dealer Blackjack — You Lose' : 'You Lose', variant: 'loss' };
    case 'push':
      return { label: dealerBlackjack ? 'Push — Both Blackjack' : 'Push', variant: 'push' };
    case 'surrender':
      return { label: 'Surrendered', variant: OUTCOME_VARIANTS.surrender };
  }
}

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
          const status = result
            ? outcomeStatus(result, summary!.dealerBlackjack)
            : hand.surrendered
              ? { label: 'Surrendered', variant: 'push' }
              : undefined;
          return (
            <HandView
              key={hand.id}
              cards={hand.cards}
              label={hands.length > 1 ? `Hand ${i + 1}` : 'You'}
              active={phase === 'player-turn' && i === activeHandIndex}
              bet={hand.bet}
              status={status?.label}
              statusVariant={status?.variant}
              roundKey={roundKey}
            />
          );
        })}
      </div>
    </div>
  );
}
