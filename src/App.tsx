import { useGame } from './ui/state/useGame';
import { Table } from './ui/components/Table';
import { DecisionButtons } from './ui/components/DecisionButtons';
import { ResultsPanel } from './ui/components/ResultsPanel';
import { SessionStats } from './ui/components/SessionStats';
import './App.css';

function App() {
  const game = useGame();

  return (
    <div className="app">
      <header className="app-header">
        <h1>Blackjack Trainer</h1>
        <div className="app-header-right">
          <SessionStats correct={game.sessionStats.correct} total={game.sessionStats.total} />
          <button type="button" className="btn btn-new-shoe" onClick={game.newShoe}>
            New Shoe
          </button>
        </div>
      </header>

      <Table
        dealerCards={game.dealerCards}
        dealerHoleRevealed={game.dealerHoleRevealed}
        hands={game.hands}
        activeHandIndex={game.activeHandIndex}
        phase={game.phase}
        summary={game.summary}
      />

      {game.phase === 'player-turn' && (
        <div className="decision-area">
          <DecisionButtons legalActions={game.legalActions} disabled={!game.canChoose} onChoose={game.choose} />
          {game.evaluating && <div className="evaluating">Calculating optimal play…</div>}
        </div>
      )}

      <ResultsPanel feedback={game.feedback} />

      {game.phase === 'round-over' && (
        <button type="button" className="btn btn-deal" onClick={game.dealNext}>
          Deal Next Hand
        </button>
      )}

      <div className="shoe-info">
        Shoe: {game.shoeRemaining}/{game.shoeTotal} cards remaining · {game.cardsUntilCutCard} until cut card
      </div>
    </div>
  );
}

export default App;
