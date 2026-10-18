import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Trash2, Globe, Laptop, ExternalLink } from 'lucide-react';
import { storage, uid } from '../lib/utils';
import { detectLaunchKind, launchTarget, normalizeWebUrl } from '../lib/launcher';
import { resolveBrandLogo } from './BrandIcons';
import type { LaunchKind, LaunchLink } from '../types';

const GLOBAL_DOCK_STORAGE_KEY = 'focusspace-global-appdock-v3';

const DEFAULT_APPS: LaunchLink[] = [
  { id: 'vscode', label: 'VS Code', url: 'vscode://file/', kind: 'app' },
  { id: 'spotify', label: 'Spotify', url: 'spotify://', kind: 'app' },
];

const PRESETS = [
  { label: 'VS Code', url: 'vscode://file/', kind: 'app' as LaunchKind },
  { label: 'Spotify', url: 'spotify://', kind: 'app' as LaunchKind },
  { label: 'Cursor', url: 'cursor://file/', kind: 'app' as LaunchKind },
  { label: 'Terminal', url: 'cmd.exe', kind: 'file' as LaunchKind },
  { label: 'Obsidian', url: 'obsidian://open', kind: 'app' as LaunchKind },
  { label: 'Discord', url: 'discord://', kind: 'app' as LaunchKind },
  { label: 'Slack', url: 'slack://open', kind: 'app' as LaunchKind },
  { label: 'Notion', url: 'notion://open', kind: 'app' as LaunchKind },
  { label: 'ChatGPT', url: 'https://chatgpt.com', kind: 'web' as LaunchKind },
  { label: 'Claude', url: 'https://claude.ai', kind: 'web' as LaunchKind },
  { label: 'GitHub', url: 'https://github.com', kind: 'web' as LaunchKind },
  { label: 'Figma', url: 'https://figma.com', kind: 'web' as LaunchKind },
  { label: 'Linear', url: 'https://linear.app', kind: 'web' as LaunchKind },
  { label: 'YouTube', url: 'https://youtube.com', kind: 'web' as LaunchKind },
];

export function PinnedAppsPill() {
  const [apps, setApps] = useState<LaunchLink[]>(() => {
    const saved = storage.get(GLOBAL_DOCK_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {}
    }
    return DEFAULT_APPS;
  });

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  const saveApps = (newApps: LaunchLink[]) => {
    setApps(newApps);
    storage.set(GLOBAL_DOCK_STORAGE_KEY, JSON.stringify(newApps));
  };

  const handleLaunch = (app: LaunchLink) => {
    void launchTarget(app.url, app.kind);
  };

  const handleAddPreset = (preset: typeof PRESETS[0]) => {
    if (apps.some(a => a.url === preset.url)) return;
    const newApp: LaunchLink = {
      id: uid(),
      label: preset.label,
      url: preset.url,
      kind: preset.kind,
    };
    saveApps([...apps, newApp]);
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLabel.trim() || !customUrl.trim()) return;
    const kind = detectLaunchKind(customUrl.trim());
    const finalUrl = kind === 'web' ? normalizeWebUrl(customUrl.trim()) : customUrl.trim();
    const newApp: LaunchLink = {
      id: uid(),
      label: customLabel.trim(),
      url: finalUrl,
      kind,
    };
    saveApps([...apps, newApp]);
    setCustomLabel('');
    setCustomUrl('');
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    saveApps(apps.filter(a => a.id !== id));
  };

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    if (popoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [popoverOpen]);

  return (
    <div className="relative flex items-center">
      {/* Compact Pinned Pill */}
      <div className="flex items-center gap-1 h-8 px-1.5 rounded-xl bg-surface-2 border border-line shadow-xs">
        {apps.map(app => (
          <button
            key={app.id || app.url}
            onClick={() => handleLaunch(app)}
            title={`Launch ${app.label}`}
            aria-label={`Launch ${app.label}`}
            className="size-6.5 rounded-lg grid place-items-center hover:bg-hover text-fg transition cursor-pointer shrink-0"
          >
            {resolveBrandLogo(app, 14)}
          </button>
        ))}

        {/* Pin App (+) Trigger */}
        <button
          onClick={() => setPopoverOpen(!popoverOpen)}
          title="Pin workspace apps & tools"
          aria-label="Pin workspace app"
          className="size-6.5 rounded-lg border border-dashed border-line hover:border-line-strong grid place-items-center text-fg-muted hover:text-fg hover:bg-hover transition cursor-pointer shrink-0"
        >
          <Plus size={12} strokeWidth={2.5} />
        </button>
      </div>

      {/* Popover Menu */}
      {popoverOpen && (
        <div
          ref={popoverRef}
          className="absolute top-10 right-0 w-72 rounded-2xl bg-surface border border-line shadow-2xl p-3 z-50 select-none animate-in fade-in zoom-in-95 duration-150 space-y-3"
        >
          <div className="flex items-center justify-between border-b border-line pb-2">
            <span className="text-xs font-bold text-fg">Pinned Workspace Apps</span>
            <button
              onClick={() => setPopoverOpen(false)}
              className="size-5 rounded-md text-fg-muted hover:text-fg hover:bg-hover grid place-items-center transition cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>

          {/* Current Pinned Apps List */}
          {apps.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-fg-muted font-semibold">
                Active Pins ({apps.length})
              </span>
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                {apps.map(app => (
                  <div
                    key={app.id || app.url}
                    className="flex items-center justify-between px-2 py-1 rounded-lg bg-surface-2 border border-line text-xs text-fg"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {resolveBrandLogo(app, 13)}
                      <span className="truncate font-medium">{app.label}</span>
                    </div>
                    <button
                      onClick={(e) => handleRemove(app.id || app.url, e)}
                      title={`Unpin ${app.label}`}
                      className="size-5 rounded text-fg-muted hover:text-rose-500 hover:bg-rose-500/10 grid place-items-center transition cursor-pointer shrink-0 ml-1"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Presets */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-fg-muted font-semibold">
              Popular Presets
            </span>
            <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto pr-1">
              {PRESETS.map(p => {
                const isPinned = apps.some(a => a.url === p.url);
                return (
                  <button
                    key={p.url}
                    onClick={() => handleAddPreset(p)}
                    disabled={isPinned}
                    className={`px-2 py-1 rounded-lg border text-left text-[11px] flex items-center gap-1.5 transition truncate cursor-pointer ${
                      isPinned
                        ? 'opacity-40 border-line bg-surface-2 text-fg-muted cursor-not-allowed'
                        : 'border-line bg-surface-2 text-fg hover:bg-hover hover:border-line-strong'
                    }`}
                  >
                    {resolveBrandLogo(p as LaunchLink, 12)}
                    <span className="truncate">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom App / URL Input */}
          <form onSubmit={handleAddCustom} className="pt-2 border-t border-line space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-fg-muted font-semibold">
              Add Custom Link or Executable
            </span>
            <input
              type="text"
              placeholder="Name (e.g. Linear)"
              value={customLabel}
              onChange={e => setCustomLabel(e.target.value)}
              className="w-full bg-surface-2 border border-line rounded-lg px-2.5 py-1 text-xs text-fg placeholder:text-fg-subtle outline-none focus:border-line-strong transition"
            />
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="URL or file path"
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                className="flex-1 bg-surface-2 border border-line rounded-lg px-2.5 py-1 text-xs text-fg placeholder:text-fg-subtle outline-none focus:border-line-strong transition"
              />
              <button
                type="submit"
                disabled={!customLabel.trim() || !customUrl.trim()}
                className="px-2.5 py-1 rounded-lg bg-accent text-accent-fg font-semibold keycap text-xs hover:bg-accent-hover transition cursor-pointer disabled:opacity-40"
              >
                Pin
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
