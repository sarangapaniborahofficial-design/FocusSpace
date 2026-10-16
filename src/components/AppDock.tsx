import { useLiveQuery } from 'dexie-react-hooks';
import React, { useRef, useState, useEffect } from 'react';
import { Globe, Laptop, Mic, Pencil, Plus, Rocket, Trash2, X } from 'lucide-react';
import { db } from '../db/db';
import { APP_PRESETS, detectLaunchKind, launchTarget, normalizeWebUrl } from '../lib/launcher';
import { useTimerTaskId } from '../lib/timer';
import { storage, uid } from '../lib/utils';
import { isVoiceEnabled } from '../lib/runtime';
import type { LaunchKind, LaunchLink, Task } from '../types';
import { resolveBrandLogo } from './BrandIcons';

const GLOBAL_DOCK_STORAGE_KEY = 'focusspace-global-appdock';

const DEFAULT_GLOBAL_APPS: LaunchLink[] = [
  { id: 'app-vscode', label: 'VS Code', url: 'vscode://file/', kind: 'app', icon: 'code' },
  { id: 'app-cursor', label: 'Cursor', url: 'cursor://file/', kind: 'app', icon: 'cursor' },
  { id: 'app-obsidian', label: 'Obsidian', url: 'obsidian://open', kind: 'app', icon: 'obsidian' },
  { id: 'app-spotify', label: 'Spotify', url: 'spotify://', kind: 'app', icon: 'spotify' },
  { id: 'app-youtube', label: 'YouTube', url: 'https://youtube.com', kind: 'web', icon: 'youtube' },
  { id: 'app-discord', label: 'Discord', url: 'discord://', kind: 'app', icon: 'discord' },
  { id: 'app-antigravity', label: 'Antigravity', url: 'antigravity://open', kind: 'app', icon: 'sparkles' },
  { id: 'app-github', label: 'GitHub', url: 'https://github.com', kind: 'web', icon: 'github' },
];

function sanitizeLaunchLink(link: LaunchLink): LaunchLink {
  const kind = detectLaunchKind(link.url, link.kind);
  const normalizedUrl = kind === 'web' ? normalizeWebUrl(link.url) : link.url;
  return {
    ...link,
    kind,
    url: normalizedUrl,
  };
}

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
  onTriggerVoice,
}: {
  categoryId?: string;
  title?: string;
  floating?: boolean;
  onTriggerVoice?: () => void;
}) {
  // Use narrow taskId subscription so the dock does NOT re-render on the 250ms timer interval!
  const activeTaskId = useTimerTaskId();

  const category = useLiveQuery(
    async () => {
      if (!categoryId) return undefined;
      return await db.categories.get(categoryId);
    },
    [categoryId]
  );

  const activeTask = useLiveQuery(
    async () => {
      if (!activeTaskId) return undefined;
      return await db.tasks.get(activeTaskId);
    },
    [activeTaskId]
  );

  const [globalApps, setGlobalApps] = useState<LaunchLink[]>(() => {
    const saved = storage.get(GLOBAL_DOCK_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = parsed.map(sanitizeLaunchLink);
          const existingLabels = new Set(sanitized.map((p: LaunchLink) => p.label.toLowerCase()));
          const missingDefaults = DEFAULT_GLOBAL_APPS.filter(d => !existingLabels.has(d.label.toLowerCase()));
          if (missingDefaults.length > 0) {
            const merged = [...sanitized, ...missingDefaults];
            storage.set(GLOBAL_DOCK_STORAGE_KEY, JSON.stringify(merged));
            return merged;
          }
          return sanitized;
        }
      } catch {
        /* fallback */
      }
    }
    return DEFAULT_GLOBAL_APPS;
  });

  const [addOpen, setAddOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LaunchLink | null>(null);
  const [contextMenuLink, setContextMenuLink] = useState<{ link: LaunchLink; x: number; y: number } | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newKind, setNewKind] = useState<LaunchKind>('web');

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setContextMenuLink(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Mouse hover physics for 60/120fps Gaussian scaling wave throttled via requestAnimationFrame
  const dockRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);
  const [mousePos, setMousePos] = useState<number | null>(null);

  const links: LaunchLink[] = categoryId
    ? (category?.launchLinks ?? []).map(sanitizeLaunchLink)
    : globalApps;

  const saveLinks = async (updated: LaunchLink[]) => {
    const sanitized = updated.map(sanitizeLaunchLink);
    if (categoryId && category) {
      await db.categories.update(categoryId, { launchLinks: sanitized });
    } else {
      setGlobalApps(sanitized);
      storage.set(GLOBAL_DOCK_STORAGE_KEY, JSON.stringify(sanitized));
    }
  };

  const startEditing = (link: LaunchLink) => {
    setEditingLink(link);
    setNewLabel(link.label);
    setNewUrl(link.url);
    setNewKind(link.kind || 'web');
    setAddOpen(true);
    setContextMenuLink(null);
  };

  const cancelEditing = () => {
    setEditingLink(null);
    setNewLabel('');
    setNewUrl('');
    setNewKind('web');
  };

  const saveOrUpdateLink = async (explicitLabel?: string, explicitUrl?: string, explicitKind?: LaunchKind) => {
    const targetLabel = explicitLabel ?? newLabel;
    const targetUrl = explicitUrl ?? newUrl;
    const targetKind = explicitKind ?? newKind;

    if (!targetLabel.trim() || !targetUrl.trim()) return;
    const kind = targetKind || detectLaunchKind(targetUrl.trim());
    const finalUrl = kind === 'web' ? normalizeWebUrl(targetUrl.trim()) : targetUrl.trim();

    if (editingLink) {
      const updated = links.map(l =>
        l.id === editingLink.id
          ? { ...l, label: targetLabel.trim(), url: finalUrl, kind }
          : l
      );
      await saveLinks(updated);
      cancelEditing();
    } else {
      const link: LaunchLink = {
        id: uid(),
        label: targetLabel.trim(),
        url: finalUrl,
        kind,
      };
      await saveLinks([...links, link]);
      cancelEditing();
      setAddOpen(false);
    }
  };

  const addLink = async (label = newLabel, url = newUrl, explicitKind = newKind) => {
    await saveOrUpdateLink(label, url, explicitKind);
  };

  const removeLink = async (id: string) => {
    if (editingLink?.id === id) {
      cancelEditing();
    }
    await saveLinks(links.filter(l => l.id !== id));
  };

  // High-performance hover tracking with 0 layout reflow thrashing
  const handleMouseEnter = () => {
    if (dockRef.current) {
      rectRef.current = dockRef.current.getBoundingClientRect();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!rectRef.current && dockRef.current) {
      rectRef.current = dockRef.current.getBoundingClientRect();
    }
    if (rafRef.current) return;
    const clientX = e.clientX;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (rectRef.current) {
        setMousePos(clientX - rectRef.current.left);
      }
    });
  };

  const handleMouseLeave = () => {
    rectRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setMousePos(null);
  };

  // FLOATING BOTTOM DOCK TRAY (Centered & Larger)
  if (floating) {
    return (
      <>
        {/* Floating Dock Tray */}
        <div
          ref={dockRef}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-3xl bg-surface/90 backdrop-blur-xl border border-line-strong shadow-pop keycap transition-all duration-150 max-w-[calc(100vw-2rem)] overflow-x-auto scrollbar-none"
          style={{ willChange: 'transform' }}
        >
          {links.map((link, index) => {
            const isAttached = isAppAttached(link, activeTask);

            // Calibrated Gaussian hover magnification wave for 56px base width
            let scale = 1;
            if (mousePos !== null && dockRef.current) {
              const itemWidth = 56;
              const itemCenter = index * (itemWidth + 8) + itemWidth / 2 + 16;
              const d = Math.abs(mousePos - itemCenter);
              scale = 1 + 0.28 * Math.exp(-Math.pow(d, 2) / (2 * Math.pow(65, 2)));
            }

            const translateY = -(scale - 1) * 16;

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
                  onClick={() => launchTarget(link.url, link.label, link.kind)}
                  onContextMenu={e => {
                    e.preventDefault();
                    setContextMenuLink({
                      link,
                      x: e.clientX,
                      y: e.clientY - 120,
                    });
                  }}
                  title={`Launch ${link.label} (${link.url}) — Right-click to edit`}
                  className={`size-12 sm:size-14 rounded-2xl border flex items-center justify-center transition cursor-pointer shadow-sm ${
                    isAttached
                      ? 'bg-accent/15 border-accent shadow-md'
                      : 'bg-surface-2 border-line hover:border-line-strong hover:bg-hover'
                  }`}
                >
                  {resolveBrandLogo(link, 26)}
                </button>

                {/* Active workspace indicator dot */}
                {isAttached && (
                  <span
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-1.5 rounded-full bg-accent shadow-sm animate-pulse"
                    title={`Attached to active task: ${activeTask?.title}`}
                  />
                )}

                {/* Tooltip Label */}
                <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-inv text-on-inv text-[11px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition shadow-lg z-50">
                  {link.label}
                  <span className="ml-1 text-[9px] opacity-75 uppercase">
                    ({link.kind === 'web' ? 'Web' : 'App'})
                  </span>
                </span>
              </div>
            );
          })}

          <div className="w-px h-8 bg-line mx-1" />

          {/* Voice Typing Trigger Button */}
          {onTriggerVoice && isVoiceEnabled() && (
            <button
              onClick={onTriggerVoice}
              title="Universal Voice Typing (Alt+V)"
              className="size-10 sm:size-11 rounded-2xl border border-line bg-surface hover:bg-accent hover:text-accent-fg text-fg-muted hover:border-accent flex items-center justify-center transition keycap shrink-0 shadow-xs"
            >
              <Mic size={18} />
            </button>
          )}

          {/* Quick Add / Manage Button */}
          <button
            onClick={() => {
              if (addOpen) {
                cancelEditing();
                setAddOpen(false);
              } else {
                setAddOpen(true);
              }
            }}
            title="Add or Manage Workspace Apps"
            className="size-10 sm:size-11 rounded-2xl border border-line bg-surface hover:bg-hover text-fg-muted hover:text-fg flex items-center justify-center transition keycap shrink-0 shadow-xs"
          >
            {addOpen ? <X size={16} /> : <Plus size={16} />}
          </button>
        </div>

        {/* Right-click Context Menu for Dock Icons */}
        {contextMenuLink && (
          <div
            style={{
              left: Math.min(typeof window !== 'undefined' ? window.innerWidth - 180 : 200, Math.max(10, contextMenuLink.x - 80)),
              top: Math.max(10, contextMenuLink.y),
            }}
            className="fixed z-50 w-44 rounded-2xl bg-surface border border-line-strong shadow-pop p-1.5 space-y-0.5 text-xs select-none pop-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-2.5 py-1 text-[10px] font-semibold text-fg-subtle uppercase border-b border-line truncate">
              {contextMenuLink.link.label}
            </div>
            <button
              onClick={() => {
                launchTarget(contextMenuLink.link.url, contextMenuLink.link.label, contextMenuLink.link.kind);
                setContextMenuLink(null);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-hover text-fg text-left transition cursor-pointer"
            >
              <Rocket size={13} className="text-accent-text" />
              <span>Launch App</span>
            </button>
            <button
              onClick={() => {
                startEditing(contextMenuLink.link);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-hover text-fg text-left transition cursor-pointer"
            >
              <Pencil size={13} className="text-fg-muted" />
              <span>Edit App</span>
            </button>
            <button
              onClick={() => {
                void removeLink(contextMenuLink.link.id);
                setContextMenuLink(null);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-rose-500/10 text-rose-500 text-left transition cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Remove from Dock</span>
            </button>
          </div>
        )}

        {/* Modal / Popover for Managing Apps */}
        {addOpen && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[360px] pop-in p-5 rounded-3xl bg-surface border border-line-strong shadow-pop space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-fg">
                  {editingLink ? `Edit "${editingLink.label}"` : 'Manage Workspace Dock'}
                </h3>
                <p className="text-[11px] text-fg-subtle">
                  {editingLink ? 'Update name, target scheme, or type' : 'Pin desktop tools or web applications'}
                </p>
              </div>
              <button
                onClick={() => {
                  cancelEditing();
                  setAddOpen(false);
                }}
                className="text-fg-muted hover:text-fg cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Existing Links Pill Grid */}
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto py-1">
              {links.map(l => (
                <span
                  key={l.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs transition ${
                    editingLink?.id === l.id
                      ? 'bg-accent/15 border-accent text-accent-text font-semibold'
                      : 'bg-surface-2 border-line text-fg'
                  }`}
                >
                  <span className="font-medium">{l.label}</span>
                  <span className="text-[9px] text-fg-subtle uppercase">({l.kind})</span>
                  <button
                    onClick={() => startEditing(l)}
                    className="text-fg-subtle hover:text-accent-text transition cursor-pointer"
                    title={`Edit ${l.label}`}
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={() => void removeLink(l.id)}
                    className="text-fg-subtle hover:text-rose-500 transition cursor-pointer"
                    title={`Remove ${l.label}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>

            {/* Add / Edit App Form */}
            <div className="space-y-3 pt-2 border-t border-line">
              {/* Kind Toggle: Web App vs Native App */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-2 border border-line text-xs">
                <button
                  type="button"
                  onClick={() => setNewKind('web')}
                  className={`flex-1 py-1 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    newKind === 'web'
                      ? 'bg-accent text-accent-fg shadow-xs'
                      : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  <Globe size={13} />
                  <span>Web App</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewKind('app')}
                  className={`flex-1 py-1 px-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    newKind === 'app'
                      ? 'bg-accent text-accent-fg shadow-xs'
                      : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  <Laptop size={13} />
                  <span>Native App</span>
                </button>
              </div>

              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder={newKind === 'web' ? 'Name (e.g. YouTube, GitHub)' : 'Name (e.g. Spotify, VS Code)'}
                className="w-full h-9 rounded-xl bg-surface-2 border border-line px-3 text-xs outline-none text-fg placeholder:text-fg-subtle"
              />

              <input
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder={newKind === 'web' ? 'youtube.com or https://...' : 'spotify://, vscode://, discord://'}
                className="w-full h-9 rounded-xl bg-surface-2 border border-line px-3 text-xs font-mono outline-none text-fg placeholder:text-fg-subtle"
                onKeyDown={e => {
                  if (e.key === 'Enter') void saveOrUpdateLink();
                }}
              />

              <div className="flex items-center gap-2">
                {editingLink && (
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="flex-1 h-9 rounded-xl border border-line bg-surface hover:bg-hover text-fg text-xs font-medium transition cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => void saveOrUpdateLink()}
                  disabled={!newLabel.trim() || !newUrl.trim()}
                  className="flex-1 h-9 rounded-xl bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover disabled:opacity-40 transition keycap shadow-xs cursor-pointer"
                >
                  {editingLink ? 'Save Changes' : `Pin ${newKind === 'web' ? 'Web Application' : 'Native App'}`}
                </button>
              </div>
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
          onClick={() => {
            if (addOpen) {
              cancelEditing();
              setAddOpen(false);
            } else {
              setAddOpen(true);
            }
          }}
          className="h-7 px-2.5 rounded-lg border border-line bg-surface hover:bg-hover text-xs font-medium text-fg flex items-center gap-1 transition keycap cursor-pointer"
        >
          {addOpen ? <X size={13} /> : <Plus size={13} />}
          <span>{addOpen ? 'Cancel' : 'Add App'}</span>
        </button>
      </div>

      {addOpen && (
        <div className="pop-in mb-4 p-4 rounded-2xl bg-surface-2 border border-line space-y-3">
          {editingLink ? (
            <div className="flex items-center justify-between text-xs text-accent-text font-semibold px-1">
              <span>Editing "{editingLink.label}"</span>
              <button
                type="button"
                onClick={cancelEditing}
                className="text-fg-subtle hover:text-fg text-[11px] underline cursor-pointer"
              >
                Cancel edit
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-mono text-fg-subtle uppercase">Quick presets:</span>
              {APP_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => void addLink(preset.label, preset.url, preset.kind)}
                  className="px-2.5 py-1 rounded-lg bg-surface border border-line text-[11px] text-fg-soft hover:bg-hover hover:text-fg transition cursor-pointer"
                >
                  + {preset.label} <span className="text-[9px] text-fg-subtle">({preset.kind})</span>
                </button>
              ))}
            </div>
          )}

          {/* Segmented Type Picker */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface border border-line text-xs w-fit">
            <button
              type="button"
              onClick={() => setNewKind('web')}
              className={`py-1 px-3 rounded-lg font-medium flex items-center gap-1.5 transition cursor-pointer ${
                newKind === 'web' ? 'bg-accent text-accent-fg shadow-xs' : 'text-fg-muted hover:text-fg'
              }`}
            >
              <Globe size={13} />
              <span>Web App</span>
            </button>
            <button
              type="button"
              onClick={() => setNewKind('app')}
              className={`py-1 px-3 rounded-lg font-medium flex items-center gap-1.5 transition cursor-pointer ${
                newKind === 'app' ? 'bg-accent text-accent-fg shadow-xs' : 'text-fg-muted hover:text-fg'
              }`}
            >
              <Laptop size={13} />
              <span>Native App</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="App Name (e.g. YouTube or VS Code)"
              className="flex-1 h-9 rounded-xl bg-surface border border-line px-3 text-xs outline-none"
            />
            <input
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder={newKind === 'web' ? 'youtube.com or https://...' : 'vscode://, spotify://'}
              className="flex-1 h-9 rounded-xl bg-surface border border-line px-3 text-xs font-mono outline-none"
              onKeyDown={e => {
                if (e.key === 'Enter') void saveOrUpdateLink();
              }}
            />
            <button
              onClick={() => void saveOrUpdateLink()}
              disabled={!newLabel.trim() || !newUrl.trim()}
              className="h-9 px-4 rounded-xl bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover disabled:opacity-40 transition keycap shrink-0 shadow-xs cursor-pointer"
            >
              {editingLink ? 'Save Changes' : 'Pin to Dock'}
            </button>
          </div>
        </div>
      )}

      {links.length === 0 ? (
        <div className="p-4 rounded-2xl border border-dashed border-line text-center">
          <p className="text-xs text-fg-muted">No external applications or workspaces pinned yet.</p>
          <button
            onClick={() => setAddOpen(true)}
            className="mt-2 text-xs font-semibold text-accent-text hover:underline cursor-pointer"
          >
            + Pin your primary tools (YouTube, VS Code, Figma, Slack, GitHub)
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {links.map(link => {
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
                  onClick={() => launchTarget(link.url, link.label, link.kind)}
                  title={`Launch ${link.label} (${link.url})`}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-fg cursor-pointer"
                >
                  {resolveBrandLogo(link, 18)}
                  <span className="font-semibold tracking-tight">{link.label}</span>
                  <span className="text-[9px] text-fg-subtle uppercase opacity-75">
                    ({link.kind === 'web' ? 'Web' : 'App'})
                  </span>
                </button>

                <div className="flex items-center gap-0.5 pr-2">
                  <button
                    onClick={() => startEditing(link)}
                    title={`Edit ${link.label}`}
                    aria-label={`Edit ${link.label}`}
                    className="p-1 text-fg-subtle hover:text-fg opacity-60 hover:opacity-100 transition cursor-pointer"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => void removeLink(link.id)}
                    title="Remove from dock"
                    aria-label={`Remove ${link.label}`}
                    className="p-1 text-fg-subtle hover:text-rose-500 opacity-60 hover:opacity-100 transition cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
