import { useEffect, useRef, useState } from 'react';

interface SettingsPanelProps {
  dealerStandsSoft17: boolean;
  onDealerStandsSoft17Change: (value: boolean) => void;
  dasAllowed: boolean;
  onDasAllowedChange: (value: boolean) => void;
  lateSurrenderAllowed: boolean;
  onLateSurrenderAllowedChange: (value: boolean) => void;
}

export function SettingsPanel({
  dealerStandsSoft17,
  onDealerStandsSoft17Change,
  dasAllowed,
  onDasAllowedChange,
  lateSurrenderAllowed,
  onLateSurrenderAllowedChange,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
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

  return (
    <div className="settings" ref={containerRef}>
      <button
        type="button"
        className="btn-settings-gear"
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div className="settings-popover">
          <div className="settings-title">Table rules</div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={!dealerStandsSoft17}
              onChange={(e) => onDealerStandsSoft17Change(!e.target.checked)}
            />
            <span>Dealer hits on soft 17</span>
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={dasAllowed} onChange={(e) => onDasAllowedChange(e.target.checked)} />
            <span>Double after split (DAS)</span>
          </label>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={lateSurrenderAllowed}
              onChange={(e) => onLateSurrenderAllowedChange(e.target.checked)}
            />
            <span>Late surrender</span>
          </label>
          <div className="settings-hint">All off by default.</div>
        </div>
      )}
    </div>
  );
}
