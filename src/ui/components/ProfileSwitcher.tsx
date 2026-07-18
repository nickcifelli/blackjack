import { useEffect, useRef, useState } from 'react';
import { accuracyPct, type ProfileStats } from '../state/profileStore';
import { AdvancedStatsModal } from './AdvancedStatsModal';

interface ProfileSwitcherProps {
  activeProfile: string;
  profiles: string[];
  stats: ProfileStats;
  onSwitch: (name: string) => void;
}

export function ProfileSwitcher({ activeProfile, profiles, stats, onSwitch }: ProfileSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const pct = accuracyPct(stats.overall);

  const addProfile = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onSwitch(trimmed);
    setNewName('');
  };

  return (
    <div className="profile-switcher" ref={containerRef}>
      <button type="button" className="btn-profile" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="profile-name">{activeProfile}</span>
        <span className="profile-accuracy">
          {stats.overall.total > 0
            ? `${pct.toFixed(0)}% lifetime (${stats.overall.correct}/${stats.overall.total})`
            : 'no history yet'}
        </span>
      </button>

      {open && (
        <div className="profile-popover">
          <div className="settings-title">Switch player</div>
          {profiles.map((name) => (
            <button
              key={name}
              type="button"
              className={`profile-option${name === activeProfile ? ' profile-option-active' : ''}`}
              onClick={() => {
                onSwitch(name);
                setOpen(false);
              }}
            >
              {name}
            </button>
          ))}
          <form
            className="profile-add"
            onSubmit={(e) => {
              e.preventDefault();
              addProfile();
              setOpen(false);
            }}
          >
            <input
              type="text"
              placeholder="New player name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={24}
            />
            <button type="submit" className="btn-profile-add" disabled={!newName.trim()}>
              Add
            </button>
          </form>
          <button
            type="button"
            className="profile-advanced-link"
            onClick={() => {
              setShowAdvanced(true);
              setOpen(false);
            }}
          >
            View advanced stats →
          </button>
        </div>
      )}

      {showAdvanced && (
        <AdvancedStatsModal profileName={activeProfile} stats={stats} onClose={() => setShowAdvanced(false)} />
      )}
    </div>
  );
}
