import { useEffect } from 'react';
import type { BucketKey } from '../../engine/cards';
import { ACTION_LABELS, type Action } from '../../engine/actions';
import {
  accuracyPct,
  DEALER_UPCARDS,
  HAND_CATEGORIES,
  RECENT_TREND_WINDOW,
  type ProfileStats,
  type Tally,
} from '../state/profileStore';

interface AdvancedStatsModalProps {
  profileName: string;
  stats: ProfileStats;
  onClose: () => void;
}

const ACTIONS_IN_ORDER: Action[] = ['stand', 'hit', 'double', 'split', 'surrender'];
const HAND_CATEGORY_LABELS: Record<(typeof HAND_CATEGORIES)[number], string> = {
  hard: 'Hard totals',
  soft: 'Soft totals',
  pair: 'Pairs',
};

function formatCard(bucket: BucketKey): string {
  return bucket === 'T' ? '10' : bucket;
}

function formatCards(cards: BucketKey[]): string {
  return cards.map(formatCard).join(', ');
}

function accuracyTone(pct: number): 'good' | 'ok' | 'bad' {
  if (pct >= 90) return 'good';
  if (pct >= 75) return 'ok';
  return 'bad';
}

function AccuracyBar({ label, tally }: { label: string; tally: Tally | undefined }) {
  if (!tally || tally.total === 0) return null;
  const pct = accuracyPct(tally);
  return (
    <div className="stat-bar-row">
      <div className="stat-bar-label">{label}</div>
      <div className="stat-bar-track">
        <div className={`stat-bar-fill stat-bar-${accuracyTone(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="stat-bar-value">
        {pct.toFixed(0)}%<span className="stat-bar-n"> ({tally.correct}/{tally.total})</span>
      </div>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">{value}</div>
      {sub && <div className="stat-tile-sub">{sub}</div>}
    </div>
  );
}

export function AdvancedStatsModal({ profileName, stats, onClose }: AdvancedStatsModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const lifetimePct = accuracyPct(stats.overall);
  const recentWindow = stats.recent.slice(-RECENT_TREND_WINDOW);
  const recent = recentWindow.length >= 10 ? recentWindow : null;
  const recentPct = recent ? (recent.filter(Boolean).length / recent.length) * 100 : null;

  const chosenTotal = ACTIONS_IN_ORDER.reduce((sum, a) => sum + (stats.actionChosenCounts[a] ?? 0), 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{profileName}'s Advanced Stats</h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        {stats.overall.total === 0 ? (
          <div className="stat-empty">No decisions recorded yet for this player — go play a few hands.</div>
        ) : (
          <div className="modal-body">
            <div className="stat-tiles">
              <StatTile
                label="Lifetime accuracy"
                value={`${lifetimePct.toFixed(1)}%`}
                sub={`${stats.overall.correct}/${stats.overall.total} decisions`}
              />
              <StatTile
                label="EV given up"
                value={`${stats.evLostTotal.toFixed(2)} units`}
                sub={`${(stats.evLostTotal / stats.overall.total).toFixed(3)} / decision`}
              />
              <StatTile
                label="Recent form"
                value={recentPct !== null ? `${recentPct.toFixed(0)}%` : '—'}
                sub={recentPct !== null ? `last ${recent!.length}, vs ${lifetimePct.toFixed(0)}% lifetime` : 'not enough decisions yet'}
              />
              <StatTile label="Current streak" value={String(stats.currentStreak)} sub="correct in a row" />
              <StatTile label="Best streak" value={String(stats.bestStreak)} sub="correct in a row" />
            </div>

            <section className="stat-section">
              <h3>Accuracy by decision type</h3>
              <div className="stat-bar-list">
                {ACTIONS_IN_ORDER.map((a) => (
                  <AccuracyBar key={a} label={ACTION_LABELS[a]} tally={stats.byAction[a]} />
                ))}
              </div>
            </section>

            <section className="stat-section">
              <h3>Accuracy by hand type</h3>
              <div className="stat-bar-list">
                {HAND_CATEGORIES.map((c) => (
                  <AccuracyBar key={c} label={HAND_CATEGORY_LABELS[c]} tally={stats.byHandCategory[c]} />
                ))}
              </div>
            </section>

            <section className="stat-section">
              <h3>Accuracy vs. dealer upcard</h3>
              <div className="stat-bar-list">
                {DEALER_UPCARDS.map((c) => (
                  <AccuracyBar key={c} label={formatCard(c)} tally={stats.byDealerUpcard[c]} />
                ))}
              </div>
            </section>

            {chosenTotal > 0 && (
              <section className="stat-section">
                <h3>Decision mix</h3>
                <div className="stat-bar-list">
                  {ACTIONS_IN_ORDER.filter((a) => stats.actionChosenCounts[a]).map((a) => {
                    const count = stats.actionChosenCounts[a] ?? 0;
                    const pct = (count / chosenTotal) * 100;
                    return (
                      <div className="stat-bar-row" key={a}>
                        <div className="stat-bar-label">{ACTION_LABELS[a]}</div>
                        <div className="stat-bar-track">
                          <div className="stat-bar-fill stat-bar-neutral" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="stat-bar-value">
                          {pct.toFixed(0)}%<span className="stat-bar-n"> ({count})</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="stat-section">
              <h3>Costliest misses</h3>
              {stats.costliestMisses.length === 0 ? (
                <div className="stat-empty">No costly mistakes recorded yet — nice.</div>
              ) : (
                <ol className="misses-list">
                  {stats.costliestMisses.map((m) => (
                    <li className="miss-row" key={m.timestamp}>
                      <span className="miss-ev">−{m.evLost.toFixed(2)}</span>
                      <span className="miss-detail">
                        <strong>{formatCards(m.playerCards)}</strong> vs dealer {formatCard(m.dealerUpcard)} — you{' '}
                        {ACTION_LABELS[m.action].toLowerCase()}, correct was{' '}
                        <strong>{ACTION_LABELS[m.bestAction].toLowerCase()}</strong>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
