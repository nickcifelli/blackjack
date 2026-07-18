import { useEffect, useRef, useState } from 'react';
import type { ProfileStats } from '../state/profileStore';

interface ProfileSwitcherProps {
  activeProfile: string;
  profiles: string[];
  stats: ProfileStats;
  onSwitch: (name: string) => void;
}

export function ProfileSwitcher({ activeProfile, profiles, stats, onSwitch }: ProfileSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
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

  const pct = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;

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
          {stats.total > 0 ? `${pct.toFixed(0)}% lifetime (${stats.correct}/${stats.total})` : 'no history yet'}
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
        </div>
      )}
    </div>
  );
}
