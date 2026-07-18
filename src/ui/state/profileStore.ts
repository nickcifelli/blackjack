/**
 * Lifetime per-player stats, persisted to localStorage under a single key.
 * Split into pure data transforms (testable without a DOM) and thin
 * load/save I/O around them.
 */

import { BUCKET_KEYS, type BucketKey } from '../../engine/cards';
import type { Action } from '../../engine/actions';

export type HandCategory = 'hard' | 'soft' | 'pair';

export const HAND_CATEGORIES: HandCategory[] = ['hard', 'soft', 'pair'];
export const DEALER_UPCARDS: BucketKey[] = BUCKET_KEYS;

/** Everything known about one decision at the moment it's made, as reported by useGame. */
export interface DecisionRecord {
  action: Action;
  bestAction: Action;
  correct: boolean;
  /** EV given up vs. the best action, in units of the hand's current bet. Always >= 0. */
  evLost: number;
  handCategory: HandCategory;
  playerCards: BucketKey[];
  dealerUpcard: BucketKey;
  timestamp: number;
}

export interface Tally {
  correct: number;
  total: number;
}

export function accuracyPct(tally: Tally | undefined): number {
  if (!tally || tally.total === 0) return 0;
  return (tally.correct / tally.total) * 100;
}

/** A single incorrect decision retained for the "costliest misses" list, ranked by EV lost. */
export interface CostlyMiss {
  timestamp: number;
  action: Action;
  bestAction: Action;
  evLost: number;
  handCategory: HandCategory;
  playerCards: BucketKey[];
  dealerUpcard: BucketKey;
}

export interface ProfileStats {
  overall: Tally;
  evLostTotal: number;
  /** Accuracy grouped by the correct action for the decision (not the action chosen). */
  byAction: Partial<Record<Action, Tally>>;
  byHandCategory: Partial<Record<HandCategory, Tally>>;
  byDealerUpcard: Partial<Record<BucketKey, Tally>>;
  /** How often each action was actually chosen, regardless of correctness. */
  actionChosenCounts: Partial<Record<Action, number>>;
  currentStreak: number;
  bestStreak: number;
  /** Rolling correctness log, oldest first, capped at RECENT_LOG_CAP. */
  recent: boolean[];
  /** Worst mistakes ever, highest EV lost first, capped at COSTLIEST_MISSES_CAP. */
  costliestMisses: CostlyMiss[];
}

export interface ProfileData {
  activeProfile: string | null;
  profiles: Record<string, ProfileStats>;
}

export const RECENT_LOG_CAP = 200;
export const RECENT_TREND_WINDOW = 50;
export const COSTLIEST_MISSES_CAP = 10;

export const EMPTY_PROFILE_DATA: ProfileData = { activeProfile: null, profiles: {} };

function emptyTally(): Tally {
  return { correct: 0, total: 0 };
}

export function emptyStats(): ProfileStats {
  return {
    overall: emptyTally(),
    evLostTotal: 0,
    byAction: {},
    byHandCategory: {},
    byDealerUpcard: {},
    actionChosenCounts: {},
    currentStreak: 0,
    bestStreak: 0,
    recent: [],
    costliestMisses: [],
  };
}

function bumpTally<K extends string>(
  map: Partial<Record<K, Tally>>,
  key: K,
  correct: boolean,
): Partial<Record<K, Tally>> {
  const current = map[key] ?? emptyTally();
  return { ...map, [key]: { correct: current.correct + (correct ? 1 : 0), total: current.total + 1 } };
}

export function withProfile(data: ProfileData, name: string): ProfileData {
  if (data.profiles[name]) return data;
  return { ...data, profiles: { ...data.profiles, [name]: emptyStats() } };
}

export function withActiveProfile(data: ProfileData, name: string): ProfileData {
  return { ...withProfile(data, name), activeProfile: name };
}

export function withRecordedDecision(data: ProfileData, name: string, record: DecisionRecord): ProfileData {
  const current = data.profiles[name] ?? emptyStats();

  const currentStreak = record.correct ? current.currentStreak + 1 : 0;
  const recent = [...current.recent, record.correct].slice(-RECENT_LOG_CAP);

  const costliestMisses =
    !record.correct && record.evLost > 0
      ? [...current.costliestMisses, { ...record }]
          .sort((a, b) => b.evLost - a.evLost)
          .slice(0, COSTLIEST_MISSES_CAP)
      : current.costliestMisses;

  const stats: ProfileStats = {
    overall: { correct: current.overall.correct + (record.correct ? 1 : 0), total: current.overall.total + 1 },
    evLostTotal: current.evLostTotal + record.evLost,
    byAction: bumpTally(current.byAction, record.bestAction, record.correct),
    byHandCategory: bumpTally(current.byHandCategory, record.handCategory, record.correct),
    byDealerUpcard: bumpTally(current.byDealerUpcard, record.dealerUpcard, record.correct),
    actionChosenCounts: {
      ...current.actionChosenCounts,
      [record.action]: (current.actionChosenCounts[record.action] ?? 0) + 1,
    },
    currentStreak,
    bestStreak: Math.max(current.bestStreak, currentStreak),
    recent,
    costliestMisses,
  };

  return { ...data, profiles: { ...data.profiles, [name]: stats } };
}

// Bumped from the v1 { correct, total } shape — old data under the v1 key is simply
// left behind rather than migrated, since it's just running totals, not a irreplaceable record.
const STORAGE_KEY = 'blackjack-trainer:profiles:v2';

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
