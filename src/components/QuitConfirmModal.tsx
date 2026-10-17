import React, { useEffect } from 'react';
import { AlertTriangle, Power, X, Minus } from 'lucide-react';
import { getElectronAPI, isElectron } from '../lib/runtime';

export function QuitConfirmModal({
  open,
  onClose,
  unsavedReason,
}: {
  open: boolean;
  onClose: () => void;
  unsavedReason?: string | null;
}) {
  const handleQuit = async () => {
    const api = getElectronAPI();
    if (api) {
      await api.quitApp();
    } else {
      window.close();
    }
  };

  const handleMinimize = async () => {
    const api = getElectronAPI();
    if (api) {
      await api.minimizeToTray();
      onClose();
    } else {
      onClose();
    }
  };

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void handleQuit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const hasUnsaved = Boolean(unsavedReason);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm rounded-2xl bg-surface border border-red-500/30 p-5 shadow-2xl keycap space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`size-10 rounded-xl flex items-center justify-center ${
              hasUnsaved 
                ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400' 
                : 'bg-red-500/15 border border-red-500/30 text-red-400'
            }`}>
              {hasUnsaved ? <AlertTriangle size={20} /> : <Power size={20} />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-fg">
                {hasUnsaved ? 'Unsaved Work / Active Session' : 'Close FocusSpace?'}
              </h3>
              <p className="text-[11px] text-fg-subtle">
                {hasUnsaved ? 'Active state detected before closing' : 'Session state and vault snapshots are saved locally.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-fg-subtle hover:text-fg hover:bg-hover transition cursor-pointer"
            aria-label="Cancel"
          >
            <X size={16} />
          </button>
        </div>

        {hasUnsaved && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200/90 text-xs leading-relaxed flex items-start gap-2.5">
            <AlertTriangle size={15} className="shrink-0 text-amber-400 mt-0.5" />
            <span>{unsavedReason}</span>
          </div>
        )}

        <div className="space-y-2 pt-1">
          {/* Primary Quit Button */}
          <button
            type="button"
            onClick={handleQuit}
            className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center justify-between transition shadow-md cursor-pointer keycap"
          >
            <span className="flex items-center gap-2">
              <Power size={14} />
              <span>Quit Application</span>
            </span>
            <kbd className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] font-mono border border-white/20">
              ENTER
            </kbd>
          </button>

          {/* Minimize to Tray Option (Desktop) */}
          {isElectron() && (
            <button
              type="button"
              onClick={handleMinimize}
              className="w-full py-2 px-4 rounded-xl border border-line bg-surface-2 hover:bg-hover text-fg font-semibold text-xs flex items-center justify-between transition cursor-pointer keycap"
            >
              <span className="flex items-center gap-2">
                <Minus size={14} className="text-fg-subtle" />
                <span>Keep Running in Background (Tray)</span>
              </span>
            </button>
          )}

          {/* Cancel */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 px-4 rounded-xl border border-transparent hover:bg-hover text-fg-subtle hover:text-fg font-medium text-xs flex items-center justify-center transition cursor-pointer"
          >
            Stay in FocusSpace (ESC)
          </button>
        </div>
      </div>
    </div>
  );
}
