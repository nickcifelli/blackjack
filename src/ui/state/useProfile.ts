import { useCallback, useMemo, useState } from 'react';
import {
  loadProfileData,
  saveProfileData,
  withActiveProfile,
  withRecordedDecision,
  type ProfileData,
  type ProfileStats,
} from './profileStore';

const DEFAULT_PROFILE_NAME = 'Guest';

function initialData(): ProfileData {
  const loaded = loadProfileData();
  const data = withActiveProfile(loaded, loaded.activeProfile ?? DEFAULT_PROFILE_NAME);
  if (data !== loaded) saveProfileData(data);
  return data;
}

export function useProfile() {
  const [data, setData] = useState(initialData);

  const switchProfile = useCallback((name: string) => {
    setData((prev) => {
      const next = withActiveProfile(prev, name);
      saveProfileData(next);
      return next;
    });
  }, []);

  const recordDecision = useCallback((correct: boolean) => {
    setData((prev) => {
      if (!prev.activeProfile) return prev;
      const next = withRecordedDecision(prev, prev.activeProfile, correct);
      saveProfileData(next);
      return next;
    });
  }, []);

  const activeProfile = data.activeProfile ?? DEFAULT_PROFILE_NAME;
  const stats: ProfileStats = data.profiles[activeProfile] ?? { correct: 0, total: 0 };
  const profiles = useMemo(() => Object.keys(data.profiles).sort((a, b) => a.localeCompare(b)), [data.profiles]);

  return { activeProfile, profiles, stats, switchProfile, recordDecision };
}
