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

  const shoeDealtPct = game.shoeTotal > 0 ? ((game.shoeTotal - game.shoeRemaining) / game.shoeTotal) * 100 : 0;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>Blackjack Trainer</h1>
        </div>
        <div className="app-header-right">
          <ProfileSwitcher
            activeProfile={profile.activeProfile}
            profiles={profile.profiles}
            stats={profile.stats}
            onSwitch={profile.switchProfile}
          />
          <SessionStats correct={game.sessionStats.correct} total={game.sessionStats.total} />

          <span className="toolbar-divider" aria-hidden="true" />

          <div className="toolbar-group">
            <button
              type="button"
              className={`btn btn-icon btn-check-count${showCount ? ' btn-check-count-active' : ''}`}
              aria-pressed={showCount}
              onClick={() => setShowCount((v) => !v)}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {showCount ? 'Hide Count' : 'Check Count'}
            </button>
            <button
              type="button"
              className="btn btn-icon btn-new-shoe"
              onClick={() => {
                game.newShoe();
                setShowCount(false);
              }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 0 1 15.3-6.4L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.3 6.4L3 16M3 21v-5h5" />
              </svg>
              New Shoe
            </button>
          </div>

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

      <div className="shoe-panel">
        <div className="shoe-info">
          <span>
            Shoe: {game.shoeRemaining}/{game.shoeTotal} cards remaining
          </span>
          <span className="shoe-info-sep">·</span>
          <span>{game.cardsUntilCutCard} until cut card</span>
        </div>
        <div className="shoe-progress-track">
          <div className="shoe-progress-fill" style={{ width: `${shoeDealtPct}%` }} />
        </div>

        {showCount && (
          <div className="count-reveal">
            <span className="count-chip">
              Running <strong>{game.runningCount >= 0 ? `+${game.runningCount}` : game.runningCount}</strong>
            </span>
            <span className="count-chip">
              True <strong>{game.trueCount >= 0 ? `+${game.trueCount.toFixed(1)}` : game.trueCount.toFixed(1)}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
