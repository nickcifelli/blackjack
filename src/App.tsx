import { useState } from 'react';
import { useGame } from './ui/state/useGame';
import { useProfile } from './ui/state/useProfile';
import { Table } from './ui/components/Table';
import { DecisionButtons } from './ui/components/DecisionButtons';
import { ResultsPanel } from './ui/components/ResultsPanel';
import { SessionStats } from './ui/components/SessionStats';
import { SettingsPanel } from './ui/components/SettingsPanel';
import { ProfileSwitcher } from './ui/components/ProfileSwitcher';
import './App.css';

function App() {
  const profile = useProfile();
  const game = useGame(undefined, profile.recordDecision);
  const [showCount, setShowCount] = useState(false);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Blackjack Trainer</h1>
        <div className="app-header-right">
          <ProfileSwitcher
            activeProfile={profile.activeProfile}
            profiles={profile.profiles}
            stats={profile.stats}
            onSwitch={profile.switchProfile}
          />
          <SessionStats correct={game.sessionStats.correct} total={game.sessionStats.total} />
          <button
            type="button"
            className="btn btn-check-count"
            onClick={() => setShowCount((v) => !v)}
          >
            {showCount ? 'Hide Count' : 'Check Count'}
          </button>
          <button
            type="button"
            className="btn btn-new-shoe"
            onClick={() => {
              game.newShoe();
              setShowCount(false);
            }}
          >
            New Shoe
          </button>
          <SettingsPanel
            dealerStandsSoft17={game.dealerStandsSoft17}
            onDealerStandsSoft17Change={game.setDealerStandsSoft17}
            dasAllowed={game.dasAllowed}
            onDasAllowedChange={game.setDasAllowed}
            lateSurrenderAllowed={game.lateSurrenderAllowed}
            onLateSurrenderAllowedChange={game.setLateSurrenderAllowed}
          />
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

      {game.canDealNext && (
        <button type="button" className="btn btn-deal" onClick={game.dealNext}>
          Deal Next Hand
        </button>
      )}

      <div className="shoe-info">
        Shoe: {game.shoeRemaining}/{game.shoeTotal} cards remaining · {game.cardsUntilCutCard} until cut card
      </div>

      {showCount && (
        <div className="count-reveal">
          Running count: <strong>{game.runningCount}</strong> · True count: <strong>{game.trueCount.toFixed(1)}</strong>
        </div>
      )}
    </div>
  );
}

export default App;
