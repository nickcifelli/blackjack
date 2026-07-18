import { describe, it, expect } from 'vitest';
import { EMPTY_PROFILE_DATA, withActiveProfile, withProfile, withRecordedDecision } from './profileStore';

describe('withProfile', () => {
  it('creates a zeroed profile if absent', () => {
    const data = withProfile(EMPTY_PROFILE_DATA, 'Nick');
    expect(data.profiles.Nick).toEqual({ correct: 0, total: 0 });
  });

  it('leaves an existing profile untouched', () => {
    const seeded = withRecordedDecision(withProfile(EMPTY_PROFILE_DATA, 'Nick'), 'Nick', true);
    const data = withProfile(seeded, 'Nick');
    expect(data).toBe(seeded);
  });
});

describe('withActiveProfile', () => {
  it('creates the profile if it did not exist and marks it active', () => {
    const data = withActiveProfile(EMPTY_PROFILE_DATA, 'Alex');
    expect(data.activeProfile).toBe('Alex');
    expect(data.profiles.Alex).toEqual({ correct: 0, total: 0 });
  });

  it('preserves stats when switching to an existing profile', () => {
    const seeded = withRecordedDecision(withProfile(EMPTY_PROFILE_DATA, 'Nick'), 'Nick', true);
    const data = withActiveProfile(seeded, 'Nick');
    expect(data.profiles.Nick).toEqual({ correct: 1, total: 1 });
  });
});

describe('withRecordedDecision', () => {
  it('increments total, and correct only on a correct decision', () => {
    let data = withRecordedDecision(EMPTY_PROFILE_DATA, 'Nick', true);
    expect(data.profiles.Nick).toEqual({ correct: 1, total: 1 });

    data = withRecordedDecision(data, 'Nick', false);
    expect(data.profiles.Nick).toEqual({ correct: 1, total: 2 });
  });

  it('does not mutate the input data', () => {
    const before = withProfile(EMPTY_PROFILE_DATA, 'Nick');
    const beforeSnapshot = JSON.parse(JSON.stringify(before));
    withRecordedDecision(before, 'Nick', true);
    expect(before).toEqual(beforeSnapshot);
  });
});
