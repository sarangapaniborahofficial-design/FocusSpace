import React, { useEffect } from 'react';
import { Power, X, Minus } from 'lucide-react';
import { getElectronAPI, isElectron } from '../lib/runtime';

export function QuitConfirmModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm rounded-2xl bg-surface border border-red-500/30 p-5 shadow-2xl keycap space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
              <Power size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-fg">Exit FocusSpace?</h3>
              <p className="text-[11px] text-fg-subtle">
                Session state and vault snapshots are saved locally.
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
