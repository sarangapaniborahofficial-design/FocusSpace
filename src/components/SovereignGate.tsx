import React, { useState } from 'react';
import { ShieldAlert, KeyRound, FolderOpen, ArrowRight, AlertTriangle } from 'lucide-react';
import { importSovereignKey } from '../lib/sovereign';

export function SovereignGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [manualKey, setManualKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLocateKey = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await importSovereignKey();
      if (res.success) {
        onUnlocked();
      } else if (res.error && res.error !== 'Cancelled') {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to import keyfile');
    } finally {
      setLoading(false);
    }
  };

  const handleManualUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualKey.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await importSovereignKey(manualKey.trim());
      if (res.success) {
        onUnlocked();
      } else {
        setError(res.error || 'Invalid 64-character hex master key');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to authenticate key');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-canvas/95 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md rounded-2xl bg-surface border border-line shadow-2xl p-6 sm:p-8 space-y-6 animate-scale-in">
        {/* Header Icon & Title */}
        <div className="text-center space-y-3">
          <div className="size-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 grid place-items-center mx-auto shadow-inner">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-fg tracking-tight">Sovereign Key Missing — Workspace Disabled</h1>
            <p className="text-xs text-fg-muted mt-1 leading-relaxed">
              The Dead-Man's Switch security policy is enforced. Access to this FocusSpace installation is locked until your Sovereign Master Key is verified.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/25 p-3 flex items-start gap-2.5 text-xs text-rose-400">
            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-500" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Primary Action: Locate Keyfile */}
        <div className="space-y-4">
          <button
            onClick={handleLocateKey}
            disabled={loading}
            className="w-full h-11 rounded-xl bg-accent text-accent-fg font-semibold keycap flex items-center justify-center gap-2 hover:bg-accent-hover transition cursor-pointer disabled:opacity-50 text-sm shadow-md"
          >
            <FolderOpen size={16} />
            <span>Locate Sovereign Keyfile (.key)</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <span className="relative px-3 bg-surface text-[11px] font-mono text-fg-muted uppercase tracking-wider">
              Or Enter Hex Key
            </span>
          </div>

          {/* Secondary Action: Manual Key Input */}
          <form onSubmit={handleManualUnlock} className="space-y-3">
            <div className="relative">
              <input
                type="password"
                value={manualKey}
                onChange={(e) => setManualKey(e.target.value)}
                placeholder="Paste 64-character hexadecimal key…"
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-2 border border-line text-xs font-mono text-fg placeholder:text-fg-muted focus:outline-hidden focus:border-accent"
              />
              <KeyRound size={14} className="absolute left-3 top-3 text-fg-muted" />
            </div>

            <button
              type="submit"
              disabled={loading || manualKey.trim().length !== 64}
              className="w-full h-9 rounded-xl border border-line bg-surface-2 hover:bg-hover text-xs font-semibold text-fg flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40"
            >
              <span>Unlock Workspace</span>
              <ArrowRight size={13} />
            </button>
          </form>
        </div>

        <div className="pt-2 border-t border-line text-center">
          <p className="text-[11px] font-mono text-fg-muted">
            Expected at: ~/.focusspace-sovereign/focusspace.sovereign.key
          </p>
        </div>
      </div>
    </div>
  );
}
