/**
 * Lifetime per-player stats, persisted to localStorage under a single key.
 * Split into pure data transforms (testable without a DOM) and thin
 * load/save I/O around them.
 */

export interface ProfileStats {
  correct: number;
  total: number;
}

export interface ProfileData {
  activeProfile: string | null;
  profiles: Record<string, ProfileStats>;
}

export const EMPTY_PROFILE_DATA: ProfileData = { activeProfile: null, profiles: {} };

const ZERO_STATS: ProfileStats = { correct: 0, total: 0 };

export function withProfile(data: ProfileData, name: string): ProfileData {
  if (data.profiles[name]) return data;
  return { ...data, profiles: { ...data.profiles, [name]: { ...ZERO_STATS } } };
}

export function withActiveProfile(data: ProfileData, name: string): ProfileData {
  return { ...withProfile(data, name), activeProfile: name };
}

export function withRecordedDecision(data: ProfileData, name: string, correct: boolean): ProfileData {
  const current = data.profiles[name] ?? ZERO_STATS;
  return {
    ...data,
    profiles: {
      ...data.profiles,
      [name]: { correct: current.correct + (correct ? 1 : 0), total: current.total + 1 },
    },
  };
}

const STORAGE_KEY = 'blackjack-trainer:profiles';

export function loadProfileData(): ProfileData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PROFILE_DATA;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.profiles !== 'object') return EMPTY_PROFILE_DATA;
    return parsed as ProfileData;
  } catch {
    return EMPTY_PROFILE_DATA;
  }
}

export function saveProfileData(data: ProfileData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable (private mode, quota, disabled) — stats just won't persist
  }
}
