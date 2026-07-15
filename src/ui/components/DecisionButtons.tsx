import { ACTION_LABELS, type Action } from '../../engine/actions';

interface DecisionButtonsProps {
  legalActions: Action[];
  disabled: boolean;
  onChoose: (action: Action) => void;
}

export function DecisionButtons({ legalActions, disabled, onChoose }: DecisionButtonsProps) {
  if (legalActions.length === 0) return null;
  return (
    <div className="decision-buttons">
      {legalActions.map((action) => (
        <button
          key={action}
          type="button"
          disabled={disabled}
          onClick={() => onChoose(action)}
          className={`btn btn-action btn-${action}`}
        >
          {ACTION_LABELS[action]}
        </button>
      ))}
    </div>
  );
}
