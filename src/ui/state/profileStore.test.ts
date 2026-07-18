import { describe, it, expect } from 'vitest';
import {
  EMPTY_PROFILE_DATA,
  COSTLIEST_MISSES_CAP,
  emptyStats,
  withActiveProfile,
  withProfile,
  withRecordedDecision,
  accuracyPct,
  type DecisionRecord,
} from './profileStore';

function record(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    action: 'hit',
    bestAction: 'hit',
    correct: true,
    evLost: 0,
    handCategory: 'hard',
    playerCards: ['9', '7'],
    dealerUpcard: '6',
    timestamp: 1000,
    ...overrides,
  };
}

describe('withProfile', () => {
  it('creates a zeroed profile if absent', () => {
    const data = withProfile(EMPTY_PROFILE_DATA, 'Nick');
    expect(data.profiles.Nick).toEqual(emptyStats());
  });

  it('leaves an existing profile untouched', () => {
    const seeded = withRecordedDecision(withProfile(EMPTY_PROFILE_DATA, 'Nick'), 'Nick', record());
    const data = withProfile(seeded, 'Nick');
    expect(data).toBe(seeded);
  });
});

describe('withActiveProfile', () => {
  it('creates the profile if it did not exist and marks it active', () => {
    const data = withActiveProfile(EMPTY_PROFILE_DATA, 'Alex');
    expect(data.activeProfile).toBe('Alex');
    expect(data.profiles.Alex).toEqual(emptyStats());
  });

  it('preserves stats when switching to an existing profile', () => {
    const seeded = withRecordedDecision(withProfile(EMPTY_PROFILE_DATA, 'Nick'), 'Nick', record());
    const data = withActiveProfile(seeded, 'Nick');
    expect(data.profiles.Nick.overall).toEqual({ correct: 1, total: 1 });
  });
});

describe('withRecordedDecision', () => {
  it('tracks overall accuracy and EV lost', () => {
    let data = withRecordedDecision(EMPTY_PROFILE_DATA, 'Nick', record({ correct: true, evLost: 0 }));
    data = withRecordedDecision(data, 'Nick', record({ correct: false, evLost: 0.4 }));

    expect(data.profiles.Nick.overall).toEqual({ correct: 1, total: 2 });
    expect(data.profiles.Nick.evLostTotal).toBeCloseTo(0.4);
  });

  it('buckets accuracy by the correct action, hand category, and dealer upcard', () => {
    const data = withRecordedDecision(
      EMPTY_PROFILE_DATA,
      'Nick',
      record({ action: 'stand', bestAction: 'double', correct: false, handCategory: 'soft', dealerUpcard: 'A' }),
    );
    const stats = data.profiles.Nick;
    expect(stats.byAction.double).toEqual({ correct: 0, total: 1 });
    expect(stats.byHandCategory.soft).toEqual({ correct: 0, total: 1 });
    expect(stats.byDealerUpcard.A).toEqual({ correct: 0, total: 1 });
  });

  it('tracks how often each action was chosen, independent of correctness', () => {
    let data = withRecordedDecision(EMPTY_PROFILE_DATA, 'Nick', record({ action: 'hit', bestAction: 'hit' }));
    data = withRecordedDecision(data, 'Nick', record({ action: 'hit', bestAction: 'stand', correct: false }));
    expect(data.profiles.Nick.actionChosenCounts.hit).toBe(2);
  });

  it('tracks current and best streaks, resetting current on a miss', () => {
    let data = EMPTY_PROFILE_DATA;
    for (let i = 0; i < 3; i++) data = withRecordedDecision(data, 'Nick', record({ correct: true }));
    expect(data.profiles.Nick.currentStreak).toBe(3);
    expect(data.profiles.Nick.bestStreak).toBe(3);

    data = withRecordedDecision(data, 'Nick', record({ correct: false, evLost: 0.1 }));
    expect(data.profiles.Nick.currentStreak).toBe(0);
    expect(data.profiles.Nick.bestStreak).toBe(3);
  });

  it('caps the recent-decisions log and keeps most-recent last', () => {
    let data = EMPTY_PROFILE_DATA;
    for (let i = 0; i < 5; i++) data = withRecordedDecision(data, 'Nick', record({ correct: i % 2 === 0 }));
    expect(data.profiles.Nick.recent).toEqual([true, false, true, false, true]);
  });

  it('only records a costly miss when incorrect and EV was actually lost', () => {
    let data = withRecordedDecision(EMPTY_PROFILE_DATA, 'Nick', record({ correct: true, evLost: 0 }));
    data = withRecordedDecision(data, 'Nick', record({ correct: false, evLost: 0 })); // a tie: wrong label, no cost
    expect(data.profiles.Nick.costliestMisses).toHaveLength(0);

    data = withRecordedDecision(data, 'Nick', record({ correct: false, evLost: 0.6 }));
    expect(data.profiles.Nick.costliestMisses).toHaveLength(1);
    expect(data.profiles.Nick.costliestMisses[0].evLost).toBeCloseTo(0.6);
  });

  it('keeps only the costliest N misses, worst first', () => {
    let data = EMPTY_PROFILE_DATA;
    const evLosses = [0.1, 0.9, 0.3, 1.5, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 1.2];
    for (const evLost of evLosses) {
      data = withRecordedDecision(data, 'Nick', record({ correct: false, evLost }));
    }
    const misses = data.profiles.Nick.costliestMisses;
    expect(misses).toHaveLength(COSTLIEST_MISSES_CAP);
    expect(misses.map((m) => m.evLost)).toEqual([...misses.map((m) => m.evLost)].sort((a, b) => b - a));
    expect(misses[0].evLost).toBeCloseTo(1.5);
  });

  it('does not mutate the input data', () => {
    const before = withProfile(EMPTY_PROFILE_DATA, 'Nick');
    const beforeSnapshot = JSON.parse(JSON.stringify(before));
    withRecordedDecision(before, 'Nick', record());
    expect(before).toEqual(beforeSnapshot);
  });
});

describe('accuracyPct', () => {
  it('is 0 for an empty or missing tally', () => {
    expect(accuracyPct(undefined)).toBe(0);
    expect(accuracyPct({ correct: 0, total: 0 })).toBe(0);
  });

  it('computes the percentage', () => {
    expect(accuracyPct({ correct: 3, total: 4 })).toBe(75);
  });
});
