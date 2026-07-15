export type Action = 'stand' | 'hit' | 'double' | 'split' | 'surrender';

export const ACTION_LABELS: Record<Action, string> = {
  stand: 'Stand',
  hit: 'Hit',
  double: 'Double',
  split: 'Split',
  surrender: 'Surrender',
};
