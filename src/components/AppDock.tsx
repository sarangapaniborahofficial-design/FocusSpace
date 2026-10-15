import { useLiveQuery } from 'dexie-react-hooks';
import {
  Book,
  Code2,
  ExternalLink,
  Globe,
  MessageSquare,
  Music,
  Plus,
  Rocket,
  Sparkles,
  SquarePlay,
  Terminal,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { db } from '../db/db';
import { APP_PRESETS, detectLaunchKind, launchTarget } from '../lib/launcher';
import { useTimer } from '../lib/timer';
import { storage, uid } from '../lib/utils';
import type { LaunchLink, Task } from '../types';

const GLOBAL_DOCK_STORAGE_KEY = 'focusspace-global-appdock';

const DEFAULT_GLOBAL_APPS: LaunchLink[] = [
  { id: 'app-spotify', label: 'Spotify', url: 'spotify://', kind: 'app', icon: 'music' },
  { id: 'app-youtube', label: 'YouTube', url: 'https://youtube.com', kind: 'web', icon: 'youtube' },
  { id: 'app-discord', label: 'Discord', url: 'discord://', kind: 'app', icon: 'discord' },
  { id: 'app-antigravity', label: 'Antigravity', url: 'antigravity://open', kind: 'app', icon: 'sparkles' },
  { id: 'app-vscode', label: 'VS Code', url: 'vscode://file/', kind: 'app', icon: 'code' },
  { id: 'app-github', label: 'GitHub', url: 'https://github.com', kind: 'web', icon: 'globe' },
];

const iconMap: Record<string, LucideIcon> = {
  music: Music,
  spotify: Music,
  youtube: SquarePlay,
  discord: MessageSquare,
  sparkles: Sparkles,
  antigravity: Sparkles,
  code: Code2,
  terminal: Terminal,
  book: Book,
  globe: Globe,
};

const resolveIcon = (link: LaunchLink): LucideIcon => {
  if (link.icon && iconMap[link.icon.toLowerCase()]) return iconMap[link.icon.toLowerCase()];
  const lower = link.label.toLowerCase();
  if (lower.includes('spotify') || lower.includes('music')) return Music;
  if (lower.includes('youtube') || lower.includes('video')) return SquarePlay;
  if (lower.includes('discord')) return MessageSquare;
  if (lower.includes('antigravity')) return Sparkles;
  if (lower.includes('code') || lower.includes('vs')) return Code2;
  if (lower.includes('terminal') || lower.includes('cursor')) return Terminal;
  if (lower.includes('obsidian') || lower.includes('notes')) return Book;
  return ExternalLink;
};

function isAppAttached(link: LaunchLink, task?: Task): boolean {
  if (!task) return false;
  const label = link.label?.toLowerCase() ?? '';
  if (!label) return false;
  if (task.launchLinks?.some(l => l.url === link.url || (l.label && l.label.toLowerCase() === label))) return true;
  if (task.title && task.title.toLowerCase().includes(label)) return true;
  if (task.notes && task.notes.toLowerCase().includes(label)) return true;
  return false;
}

export function AppDock({
  categoryId,
  title,
  floating = false,
}: {
  categoryId?: string;
  title?: string;
  floating?: boolean;
}) {
  const timerState = useTimer();
  const category = useLiveQuery(
    async () => {
      if (!categoryId) return undefined;
      return await db.categories.get(categoryId);
    },
    [categoryId]
  );

  const activeTask = useLiveQuery(
    async () => {
      if (!timerState.taskId) return undefined;
      return await db.tasks.get(timerState.taskId);
    },
    [timerState.taskId]
  );

  const [globalApps, setGlobalApps] = useState<LaunchLink[]>(() => {
    const saved = storage.get(GLOBAL_DOCK_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingLabels = new Set(parsed.map((p: LaunchLink) => p.label.toLowerCase()));
          const missingDefaults = DEFAULT_GLOBAL_APPS.filter(d => !existingLabels.has(d.label.toLowerCase()));
          if (missingDefaults.length > 0) {
            const merged = [...parsed, ...missingDefaults];
            storage.set(GLOBAL_DOCK_STORAGE_KEY, JSON.stringify(merged));
            return merged;
          }
          return parsed;
        }
      } catch {
        /* fallback */
      }
    }
    return DEFAULT_GLOBAL_APPS;
  });

  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');

  // Mouse hover physics for 60fps Gaussian scaling wave
  const dockRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState<number | null>(null);

  const links: LaunchLink[] = categoryId
    ? category?.launchLinks ?? []
    : globalApps;

  const saveLinks = async (updated: LaunchLink[]) => {
    if (categoryId && category) {
      await db.categories.update(categoryId, { launchLinks: updated });
    } else {
      setGlobalApps(updated);
      storage.set(GLOBAL_DOCK_STORAGE_KEY, JSON.stringify(updated));
    }
  };

  const addLink = async (label = newLabel, url = newUrl) => {
    if (!label.trim() || !url.trim()) return;
    const link: LaunchLink = {
      id: uid(),
      label: label.trim(),
      url: url.trim(),
      kind: detectLaunchKind(url),
    };
    await saveLinks([...links, link]);
    setNewLabel('');
    setNewUrl('');
    setAddOpen(false);
  };

  const removeLink = async (id: string) => {
    await saveLinks(links.filter(l => l.id !== id));
  };

  // FLOATING BOTTOM DOCK TRAY (for Homepage / Workspace)
  if (floating) {
    return (
      <>
        {/* Floating Dock Tray */}
        <div
          ref={dockRef}
          onMouseMove={e => {
            if (dockRef.current) {
              const rect = dockRef.current.getBoundingClientRect();
              setMousePos(e.clientX - rect.left);
            }
          }}
          onMouseLeave={() => setMousePos(null)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-surface/90 backdrop-blur-xl border border-line-strong shadow-pop keycap transition-all duration-150"
          style={{ willChange: 'transform' }}
        >
          {links.map((link, index) => {
            const Icon = resolveIcon(link);
            const isAttached = isAppAttached(link, activeTask);

            // Gaussian hover magnification: scale(d) = 1 + 0.35 * exp(-d^2 / (2 * 55^2))
            let scale = 1;
            if (mousePos !== null && dockRef.current) {
              const itemWidth = 44;
              const itemCenter = index * (itemWidth + 6) + itemWidth / 2 + 12;
              const d = Math.abs(mousePos - itemCenter);
              scale = 1 + 0.35 * Math.exp(-Math.pow(d, 2) / (2 * Math.pow(55, 2)));
            }

            const translateY = -(scale - 1) * 14;

            return (
              <div
                key={link.id}
                style={{
                  transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
                  transformOrigin: 'bottom center',
                  transition: mousePos === null ? 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)' : 'none',
                }}
                className="relative group shrink-0"
              >
                <button
                  onClick={() => launchTarget(link.url, link.label)}
                  title={`Launch ${link.label} (${link.url})`}
                  className={`size-10 rounded-xl border flex items-center justify-center transition ${
                    isAttached
                      ? 'bg-accent/15 border-accent text-accent-text shadow-sm'
                      : 'bg-surface-2 border-line text-fg hover:border-line-strong hover:bg-hover'
                  }`}
                >
                  <Icon size={18} className={isAttached ? 'text-accent-text' : 'text-fg-soft'} />
                </button>

                {/* Active workspace indicator dot */}
                {isAttached && (
                  <span
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-1.5 rounded-full bg-accent shadow-sm animate-pulse"
                    title={`Attached to active task: ${activeTask?.title}`}
                  />
                )}

                {/* Tooltip Label */}
                <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-inv text-on-inv text-[10px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition shadow-md">
                  {link.label}
                </span>
              </div>
            );
          })}

          <div className="w-px h-6 bg-line mx-1" />

          {/* Quick Add / Manage Button */}
          <button
            onClick={() => setAddOpen(v => !v)}
            title="Add or Manage Workspace Apps"
            className="size-8 rounded-xl border border-line bg-surface hover:bg-hover text-fg-muted hover:text-fg flex items-center justify-center transition keycap shrink-0"
          >
            {addOpen ? <X size={14} /> : <Plus size={14} />}
          </button>
        </div>

        {/* Modal / Popover for Managing Apps */}
        {addOpen && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[340px] pop-in p-4 rounded-3xl bg-surface border border-line-strong shadow-pop space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-fg">Manage Workspace Dock</span>
              <button
                onClick={() => setAddOpen(false)}
                className="text-fg-muted hover:text-fg"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto py-1">
              {links.map(l => (
                <span
                  key={l.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-2 border border-line text-xs text-fg"
                >
                  {l.label}
                  <button
                    onClick={() => void removeLink(l.id)}
                    className="text-fg-subtle hover:text-rose-500"
                    title={`Remove ${l.label}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-line">
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="App Name (e.g. Figma)"
                className="w-full h-8 rounded-lg bg-surface-2 border border-line px-2.5 text-xs outline-none text-fg"
              />
              <input
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder="URL or URI (figma://..., https://...)"
                className="w-full h-8 rounded-lg bg-surface-2 border border-line px-2.5 text-xs font-mono outline-none text-fg"
                onKeyDown={e => {
                  if (e.key === 'Enter') void addLink();
                }}
              />
              <button
                onClick={() => void addLink()}
                disabled={!newLabel.trim() || !newUrl.trim()}
                className="w-full h-8 rounded-lg bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover disabled:opacity-40 transition keycap"
              >
                Pin New App
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // INLINE CARD MODE (for CategoryView / Settings)
  return (
    <section className="atelier-card rounded-3xl p-4 sm:p-5 overflow-hidden">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Rocket size={16} className="text-accent-text shrink-0" />
          <h2 className="text-sm font-semibold text-fg tracking-tight">
            {title || (categoryId ? `${category?.name ?? 'Category'} Launchpad` : 'Command Hub & App Dock')}
          </h2>
          <span className="text-[10px] font-mono text-fg-subtle px-1.5 py-0.5 rounded bg-surface-2 border border-line">
            {links.length} apps
          </span>
        </div>

        <button
          onClick={() => setAddOpen(v => !v)}
          className="h-7 px-2.5 rounded-lg border border-line bg-surface hover:bg-hover text-xs font-medium text-fg flex items-center gap-1 transition keycap"
        >
          {addOpen ? <X size={13} /> : <Plus size={13} />}
          <span>{addOpen ? 'Cancel' : 'Add App'}</span>
        </button>
      </div>

      {addOpen && (
        <div className="pop-in mb-4 p-3 rounded-2xl bg-surface-2 border border-line space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono text-fg-subtle uppercase">Quick presets:</span>
            {APP_PRESETS.map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => void addLink(preset.label, preset.url)}
                className="px-2 py-0.5 rounded-md bg-surface border border-line text-[11px] text-fg-soft hover:bg-hover hover:text-fg transition"
              >
                + {preset.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="App Name (e.g. VS Code)"
              className="flex-1 h-9 rounded-lg bg-surface border border-line px-3 text-xs outline-none"
            />
            <input
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="URI scheme or URL (vscode://..., https://...)"
              className="flex-1 h-9 rounded-lg bg-surface border border-line px-3 text-xs font-mono outline-none"
              onKeyDown={e => {
                if (e.key === 'Enter') void addLink();
              }}
            />
            <button
              onClick={() => void addLink()}
              disabled={!newLabel.trim() || !newUrl.trim()}
              className="h-9 px-3 rounded-lg bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover disabled:opacity-40 transition keycap shrink-0"
            >
              Pin to Dock
            </button>
          </div>
        </div>
      )}

      {links.length === 0 ? (
        <div className="p-4 rounded-2xl border border-dashed border-line text-center">
          <p className="text-xs text-fg-muted">No external applications or workspaces pinned yet.</p>
          <button
            onClick={() => setAddOpen(true)}
            className="mt-2 text-xs font-semibold text-accent-text hover:underline"
          >
            + Pin your primary tools (VS Code, Figma, Slack, GitHub)
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {links.map(link => {
            const Icon = resolveIcon(link);
            const isAttached = isAppAttached(link, activeTask);
            return (
              <div
                key={link.id}
                className={`group relative flex items-center rounded-xl border transition shadow-sm keycap overflow-hidden ${
                  isAttached
                    ? 'border-accent bg-accent/10'
                    : 'border-line bg-surface hover:border-line-strong hover:bg-hover'
                }`}
              >
                <button
                  onClick={() => launchTarget(link.url, link.label)}
                  title={`Launch ${link.label} (${link.url})`}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-fg"
                >
                  <Icon size={14} className={isAttached ? 'text-accent-text' : 'text-fg-soft'} />
                  <span className="font-semibold tracking-tight">{link.label}</span>
                </button>

                <button
                  onClick={() => void removeLink(link.id)}
                  title="Remove from dock"
                  aria-label={`Remove ${link.label}`}
                  className="pr-2 pl-1 text-fg-subtle hover:text-rose-500 opacity-60 hover:opacity-100 transition"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
