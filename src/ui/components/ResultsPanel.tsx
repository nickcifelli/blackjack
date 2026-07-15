import { ACTION_LABELS, type Action } from '../../engine/actions';
import type { DecisionFeedback } from '../state/useGame';

export function ResultsPanel({ feedback }: { feedback: DecisionFeedback | null }) {
  if (!feedback) return null;
  const actions = Object.keys(feedback.results) as Action[];

  return (
    <div className={`results-panel ${feedback.correct ? 'correct' : 'incorrect'}`}>
      <div className="results-banner">
        {feedback.correct ? 'Correct!' : `Not quite — best play was ${ACTION_LABELS[feedback.bestAction]}`}
      </div>
      <table className="results-table">
        <thead>
          <tr>
            <th>Action</th>
            <th>EV</th>
            <th>Win%</th>
            <th>Push%</th>
            <th>Loss%</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((action) => {
            const r = feedback.results[action]!;
            const isUserPick = action === feedback.action;
            const isBest = action === feedback.bestAction;
            const rowClass = [isUserPick && 'user-pick', isBest && 'best-pick'].filter(Boolean).join(' ');
            return (
              <tr key={action} className={rowClass}>
                <td>
                  {ACTION_LABELS[action]}
                  {isUserPick ? ' (you)' : ''}
                  {isBest ? ' ★' : ''}
                </td>
                <td>
                  {r.ev >= 0 ? '+' : ''}
                  {r.ev.toFixed(3)}
                </td>
                <td>{r.winPct.toFixed(1)}%</td>
                <td>{r.pushPct.toFixed(1)}%</td>
                <td>{r.lossPct.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
