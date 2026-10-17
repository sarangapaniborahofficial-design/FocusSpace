import { useLiveQuery } from 'dexie-react-hooks';
import React, { useRef, useState, useEffect } from 'react';
import {
  Clock,
  FolderOpen,
  Globe,
  Laptop,
  Mic,
  Pause,
  Pencil,
  Play,
  Plus,
  Rocket,
  Search,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { db } from '../db/db';
import { APP_PRESETS, detectLaunchKind, launchTarget, normalizeWebUrl, isNativeFilePath } from '../lib/launcher';
import { timer, useTimer, formatClock, useTimerTaskId } from '../lib/timer';
import { useScreenTimer, formatScreenTimeClock } from '../lib/screenTimer';
import { ambientSound, useAmbientSound } from '../lib/ambientSound';
import { storage, uid } from '../lib/utils';
import { getElectronAPI, isVoiceEnabled } from '../lib/runtime';
import type { LaunchKind, LaunchLink, Task } from '../types';
import { resolveBrandLogo } from './BrandIcons';
import { BrowserSetupModal, BROWSER_OPTIONS } from './BrowserSetupModal';
import { FocusSpaceLogo } from './FocusSpaceLogo';

const GLOBAL_DOCK_STORAGE_KEY = 'focusspace-global-appdock-v3';

// Empty by default: user starts with a completely clean taskbar
const DEFAULT_GLOBAL_APPS: LaunchLink[] = [];

const POPULAR_NATIVE_PRESETS = [
  { label: 'VS Code', path: 'vscode://file/', kind: 'app' as LaunchKind },
  { label: 'Discord', path: 'discord://', kind: 'app' as LaunchKind },
  { label: 'Spotify', path: 'spotify://', kind: 'app' as LaunchKind },
  { label: 'Cursor', path: 'cursor://file/', kind: 'app' as LaunchKind },
  { label: 'Obsidian', path: 'obsidian://open', kind: 'app' as LaunchKind },
  { label: 'Slack', path: 'slack://open', kind: 'app' as LaunchKind },
  { label: 'Notion', path: 'notion://open', kind: 'app' as LaunchKind },
  { label: 'Terminal', path: 'cmd.exe', kind: 'file' as LaunchKind },
];

const POPULAR_WEB_PRESETS = [
  { label: 'ChatGPT', url: 'https://chatgpt.com', kind: 'web' as LaunchKind },
  { label: 'Claude', url: 'https://claude.ai', kind: 'web' as LaunchKind },
  { label: 'YouTube', url: 'https://youtube.com', kind: 'web' as LaunchKind },
  { label: 'GitHub', url: 'https://github.com', kind: 'web' as LaunchKind },
  { label: 'Figma', url: 'https://figma.com', kind: 'web' as LaunchKind },
  { label: 'Linear', url: 'https://linear.app', kind: 'web' as LaunchKind },
  { label: 'Twitter / X', url: 'https://x.com', kind: 'web' as LaunchKind },
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
  onSearch,
  onStart,
  onNavigate,
  onTriggerVoice,
  onOpenScreenTime,
}: {
  categoryId?: string;
  title?: string;
  floating?: boolean;
  onSearch?: () => void;
  onStart?: () => void;
  onNavigate?: (view: string) => void;
  onTriggerVoice?: () => void;
  onOpenScreenTime?: () => void;
}) {
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

  // Stores
  const screenTime = useScreenTimer();
  const timerState = useTimer();
  const ambientState = useAmbientSound();

  // Pinned Apps
  const [globalApps, setGlobalApps] = useState<LaunchLink[]>(() => {
    const saved = storage.get(GLOBAL_DOCK_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map(sanitizeLaunchLink);
        }
      } catch {}
    }
    return DEFAULT_GLOBAL_APPS;
  });

  // Track session launched apps
  const [launchedAppIds, setLaunchedAppIds] = useState<Set<string>>(() => new Set());

  // Clock
  const [clockDate, setClockDate] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setClockDate(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const timeFormatted = clockDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dateFormatted = clockDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  // Add / Edit Modal State
  const [addOpen, setAddOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LaunchLink | null>(null);
  const [contextMenuLink, setContextMenuLink] = useState<{ link: LaunchLink; x: number; y: number } | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newKind, setNewKind] = useState<LaunchKind>('app');
  const [preferredBrowser, setPreferredBrowser] = useState<string>(() => {
    return localStorage.getItem('focusspace-default-browser') || '';
  });
  const [browserModalOpen, setBrowserModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => setContextMenuLink(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

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
    setNewKind(link.kind || (isNativeFilePath(link.url) ? 'file' : 'web'));
    setAddOpen(true);
    setContextMenuLink(null);
  };

  const cancelEditing = () => {
    setEditingLink(null);
    setNewLabel('');
    setNewUrl('');
    setNewKind('app');
  };

  const handlePickFile = async () => {
    const api = getElectronAPI();
    if (!api) return;
    try {
      const selectedPath = await api.pickAppFile();
      if (selectedPath) {
        setNewUrl(selectedPath);
        setNewKind('file');
        if (!newLabel.trim()) {
          const match = selectedPath.match(/[^\\\/]+(?=\.[^\\\/]+$)/);
          if (match) {
            setNewLabel(match[0]);
          } else {
            const fallbackMatch = selectedPath.split(/[\\\/]/).pop();
            if (fallbackMatch) setNewLabel(fallbackMatch);
          }
        }
      }
    } catch (err) {
      console.warn('pickAppFile error:', err);
    }
  };

  const handleSelectBrowser = (browserId: string) => {
    setPreferredBrowser(browserId);
    localStorage.setItem('focusspace-default-browser', browserId);
  };

  const saveOrUpdateLink = async (explicitLabel?: string, explicitUrl?: string, explicitKind?: LaunchKind) => {
    const targetLabel = explicitLabel ?? newLabel;
    const targetUrl = explicitUrl ?? newUrl;
    const targetKind = explicitKind ?? newKind;

    if (!targetLabel.trim() || !targetUrl.trim()) return;

    if (targetKind === 'web' && !localStorage.getItem('focusspace-default-browser')) {
      setBrowserModalOpen(true);
    }

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
      setAddOpen(false);
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

  const removeLink = async (id: string) => {
    if (editingLink?.id === id) {
      cancelEditing();
    }
    await saveLinks(links.filter(l => l.id !== id));
  };

  const currentBrowserName =
    BROWSER_OPTIONS.find(b => b.id === (preferredBrowser || 'system'))?.name || 'System Default';

  // PERMANENT INTEGRATED WINDOWS-STYLE TASKBAR
  if (floating) {
    return (
      <>
        <footer
          aria-label="FocusSpace Taskbar"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="fixed bottom-0 left-0 right-0 z-40 h-13 sm:h-14 bg-[var(--app-bg)]/95 backdrop-blur-2xl border-t border-line text-fg flex items-center justify-between px-3 sm:px-4 select-none shadow-pop shrink-0"
        >
          {/* Left: Start Hub & Windows-Style Search Input */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              onClick={onStart}
              title="FocusSpace Start Hub (Home)"
              aria-label="Start Hub"
              className="size-9 sm:size-10 rounded-xl bg-surface-2 hover:bg-hover border border-line flex items-center justify-center keycap transition cursor-pointer shrink-0 shadow-2xs group"
            >
              <FocusSpaceLogo size={21} className="group-hover:scale-105 transition-transform" />
            </button>

            <button
              onClick={onSearch}
              title="Search tasks, notes, habits, commands (Ctrl+K)"
              className="flex items-center gap-2 h-9 px-3 rounded-xl bg-surface-2/80 hover:bg-surface-2 border border-line hover:border-line-strong text-xs text-fg-muted hover:text-fg transition shadow-2xs w-40 sm:w-56 md:w-64 cursor-pointer group"
            >
              <Search size={14} className="text-fg-subtle group-hover:text-accent-text transition-colors shrink-0" />
              <span className="truncate text-[11px] sm:text-xs">Search anything…</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface text-[10px] font-mono border border-line text-fg-subtle ml-auto">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* Center: Pinned & Running Apps with Underline Indicators */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-1 px-2 mx-1 sm:mx-2">
            {links.map((link) => {
              const isAttached = isAppAttached(link, activeTask);
              const isRunning = isAttached || launchedAppIds.has(link.id);

              return (
                <div key={link.id} className="relative group shrink-0">
                  <button
                    onClick={() => {
                      setLaunchedAppIds(prev => new Set(prev).add(link.id));
                      launchTarget(link.url, link.label, link.kind);
                    }}
                    onContextMenu={e => {
                      e.preventDefault();
                      setContextMenuLink({
                        link,
                        x: Math.max(10, e.clientX - 80),
                        y: Math.max(10, e.clientY - 140),
                      });
                    }}
                    title={`${link.label} (${link.kind === 'web' ? 'Web' : 'App'})${isRunning ? ' · Active' : ''} — Right click for options`}
                    className={`size-10 sm:size-11 rounded-xl border flex items-center justify-center transition cursor-pointer relative shadow-2xs ${
                      isRunning
                        ? 'bg-accent/15 border-accent shadow-xs'
                        : 'bg-surface-2/70 border-line hover:border-line-strong hover:bg-hover'
                    }`}
                  >
                    {resolveBrandLogo(link, 22)}
                    {/* Windows Taskbar Active Indicator Bar */}
                    {isRunning && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-accent shadow-sm animate-pulse" />
                    )}
                  </button>

                  {/* Hover Tooltip / Preview */}
                  <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-inv text-on-inv text-[10px] font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition shadow-lg z-50">
                    {link.label}
                    {isRunning && <span className="ml-1 text-accent-text font-normal">• Active</span>}
                  </span>
                </div>
              );
            })}

            {/* Quick Add Button on Taskbar */}
            <button
              onClick={() => {
                if (addOpen) {
                  cancelEditing();
                  setAddOpen(false);
                } else {
                  setAddOpen(true);
                }
              }}
              title="Pin App to Taskbar"
              aria-label="Pin App"
              className="size-8 sm:size-9 rounded-xl border border-dashed border-line bg-surface/50 hover:bg-hover text-fg-muted hover:text-fg flex items-center justify-center transition cursor-pointer shrink-0 ml-0.5"
            >
              {addOpen ? <X size={13} /> : <Plus size={13} />}
            </button>
          </div>

          {/* Right: System Tray & Digital Wellbeing & Clock */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Screen Time Widget */}
            <button
              onClick={onOpenScreenTime}
              className="flex items-center gap-1.5 h-9 px-2.5 rounded-xl bg-surface-2 hover:bg-hover border border-line text-xs font-semibold text-fg transition cursor-pointer keycap shadow-2xs"
              title="Screen Time & Digital Wellbeing (Click to configure limits & view stats)"
            >
              <span
                className={`size-2 rounded-full ${
                  screenTime.limitReached
                    ? 'bg-rose-500 animate-pulse'
                    : screenTime.limitWarningReached
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
              />
              <Clock size={13} className="text-accent-text" />
              <span className="font-mono text-[11px] tabular-nums">
                {formatScreenTimeClock(screenTime.todaySeconds)}
              </span>
            </button>

            {/* Focus Timer Mini Status */}
            <div className="hidden lg:flex items-center gap-1 h-9 px-2 rounded-xl bg-surface-2 border border-line text-xs font-semibold">
              <button
                onClick={() => timer.toggle()}
                className="size-6 rounded-lg bg-accent text-accent-fg grid place-items-center keycap hover:bg-accent-hover cursor-pointer"
                title={timerState.running ? 'Pause Timer (Space)' : 'Start Focus Timer (Space)'}
              >
                {timerState.running ? <Pause size={11} /> : <Play size={11} fill="currentColor" />}
              </button>
              <button
                onClick={onStart}
                className="font-mono text-[11px] px-1 hover:text-accent-text transition cursor-pointer tabular-nums"
                title="Open Focus Timer"
              >
                {formatClock(timerState.remainingMs)}
              </button>
            </div>

            {/* Ambient Sound Widget */}
            <button
              onClick={() => ambientSound.toggle()}
              className={`size-9 rounded-xl border border-line grid place-items-center transition cursor-pointer keycap ${
                ambientState.playing
                  ? 'bg-accent/15 border-accent text-accent-fg'
                  : 'bg-surface-2 hover:bg-hover text-fg-muted hover:text-fg'
              }`}
              title={ambientState.playing ? `Pause ${ambientState.track} Sound` : 'Play Ambient Sound'}
            >
              <Volume2 size={14} className={ambientState.playing ? 'animate-pulse text-accent-text' : ''} />
            </button>

            {/* Universal Voice Dictation */}
            {isVoiceEnabled() && (
              <button
                onClick={onTriggerVoice}
                className="size-9 rounded-xl border border-line bg-surface-2 hover:bg-hover text-fg-muted hover:text-fg grid place-items-center transition cursor-pointer keycap"
                title="Universal Voice Typing (Alt+V)"
              >
                <Mic size={14} />
              </button>
            )}

            {/* Live System Clock & Calendar Link */}
            <button
              onClick={() => onNavigate?.('calendar')}
              className="flex flex-col items-end justify-center h-9 px-2 rounded-xl hover:bg-surface-2 transition text-right cursor-pointer"
              title="Open Calendar Planner"
            >
              <span className="text-[11px] font-bold font-mono text-fg leading-none tabular-nums">
                {timeFormatted}
              </span>
              <span className="text-[9px] font-mono text-fg-subtle leading-none mt-0.5">
                {dateFormatted}
              </span>
            </button>

            {/* Windows Show Desktop Sliver */}
            <button
              onClick={onStart}
              className="w-1.5 h-8 rounded-full bg-line-strong/60 hover:bg-accent transition-all cursor-pointer ml-0.5"
              title="Show Desktop / Go to Home"
              aria-label="Show Desktop"
            />
          </div>
        </footer>

        {/* Right-click Context Menu */}
        {contextMenuLink && (
          <div
            style={{
              left: Math.min(typeof window !== 'undefined' ? window.innerWidth - 180 : 200, Math.max(10, contextMenuLink.x)),
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
                setLaunchedAppIds(prev => new Set(prev).add(contextMenuLink.link.id));
                launchTarget(contextMenuLink.link.url, contextMenuLink.link.label, contextMenuLink.link.kind);
                setContextMenuLink(null);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-hover text-fg text-left transition cursor-pointer"
            >
              <Rocket size={13} className="text-accent-text" />
              <span>Launch / Bring to Front</span>
            </button>
            <button
              onClick={() => startEditing(contextMenuLink.link)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-hover text-fg text-left transition cursor-pointer"
            >
              <Pencil size={13} className="text-fg-muted" />
              <span>Edit App</span>
            </button>
            {launchedAppIds.has(contextMenuLink.link.id) && (
              <button
                onClick={() => {
                  setLaunchedAppIds(prev => {
                    const next = new Set(prev);
                    next.delete(contextMenuLink.link.id);
                    return next;
                  });
                  setContextMenuLink(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-hover text-fg text-left transition cursor-pointer"
              >
                <X size={13} className="text-fg-muted" />
                <span>Detach from Session</span>
              </button>
            )}
            <button
              onClick={() => {
                void removeLink(contextMenuLink.link.id);
                setContextMenuLink(null);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-rose-500/10 text-rose-500 text-left transition cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Unpin from Taskbar</span>
            </button>
          </div>
        )}

        {/* Modal Popover for Adding / Managing Apps */}
        {addOpen && (
          <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 w-[380px] max-w-[calc(100vw-2rem)] pop-in p-5 rounded-3xl bg-surface border border-line-strong shadow-pop space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-fg">
                  {editingLink ? `Edit "${editingLink.label}"` : 'Pin App to Taskbar'}
                </h3>
                <p className="text-[11px] text-fg-subtle">
                  Pin native desktop executables or web applications with official SVG icons.
                </p>
              </div>
              <button
                onClick={() => {
                  cancelEditing();
                  setAddOpen(false);
                }}
                className="text-fg-muted hover:text-fg cursor-pointer p-1"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* Kind Toggle: Native App vs Web App */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-2 border border-line text-xs">
              <button
                type="button"
                onClick={() => setNewKind('app')}
                className={`flex-1 py-1.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  newKind !== 'web'
                    ? 'bg-accent text-accent-fg shadow-xs'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                <Laptop size={13} />
                <span>Native Desktop App</span>
              </button>
              <button
                type="button"
                onClick={() => setNewKind('web')}
                className={`flex-1 py-1.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  newKind === 'web'
                    ? 'bg-accent text-accent-fg shadow-xs'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                <Globe size={13} />
                <span>Web App</span>
              </button>
            </div>

            {/* Quick Presets for Selected Kind */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-fg-subtle uppercase tracking-wider">
                Popular Official Brands:
              </span>
              <div className="flex flex-wrap gap-1">
                {(newKind === 'web' ? POPULAR_WEB_PRESETS : POPULAR_NATIVE_PRESETS).map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setNewLabel(preset.label);
                      setNewUrl(newKind === 'web' ? (preset as any).url : (preset as any).path);
                      setNewKind(preset.kind);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-surface-2 border border-line hover:border-accent text-[11px] font-medium text-fg flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {resolveBrandLogo({ id: 'preview', label: preset.label, url: (preset as any).url || (preset as any).path, kind: preset.kind }, 13)}
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-2.5 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-fg-muted block mb-1">
                  Application Name
                </label>
                <input
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder={newKind === 'web' ? 'e.g. ChatGPT, YouTube, Linear' : 'e.g. Discord, Spotify, VS Code'}
                  className="w-full h-9 rounded-xl bg-surface-2 border border-line px-3 text-xs outline-none text-fg placeholder:text-fg-subtle"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-fg-muted flex items-center justify-between mb-1">
                  <span>{newKind === 'web' ? 'Web URL' : 'File Location / Executable Path'}</span>
                  {newKind !== 'web' && getElectronAPI() && (
                    <button
                      type="button"
                      onClick={handlePickFile}
                      className="text-accent-text hover:underline flex items-center gap-1 font-bold text-[10px] cursor-pointer"
                    >
                      <FolderOpen size={11} />
                      <span>Browse File…</span>
                    </button>
                  )}
                </label>
                <div className="flex gap-1.5">
                  <input
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    placeholder={
                      newKind === 'web'
                        ? 'e.g. https://chatgpt.com'
                        : 'e.g. C:\\Users\\...\\Discord.exe or notepad.exe'
                    }
                    className="flex-1 h-9 rounded-xl bg-surface-2 border border-line px-3 text-xs font-mono outline-none text-fg placeholder:text-fg-subtle"
                  />
                  {newKind !== 'web' && getElectronAPI() && (
                    <button
                      type="button"
                      onClick={handlePickFile}
                      title="Select executable file"
                      className="h-9 px-2.5 rounded-xl border border-line bg-surface-2 hover:bg-hover text-xs font-semibold text-fg flex items-center gap-1 cursor-pointer"
                    >
                      <FolderOpen size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Web App: Browser Selector */}
              {newKind === 'web' && (
                <div className="p-2.5 rounded-xl bg-surface-2 border border-line flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-accent" />
                    <div>
                      <div className="text-[10px] uppercase font-mono text-fg-subtle">Target Browser</div>
                      <div className="font-semibold text-fg">{currentBrowserName}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBrowserModalOpen(true)}
                    className="text-[11px] font-bold text-accent-text hover:underline cursor-pointer"
                  >
                    Change…
                  </button>
                </div>
              )}

              {/* Live SVG Logo Preview */}
              {newLabel.trim() && (
                <div className="p-2.5 rounded-xl bg-surface-2 border border-line flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-surface border border-line flex items-center justify-center shrink-0">
                    {resolveBrandLogo(
                      {
                        id: 'preview',
                        label: newLabel,
                        url: newUrl,
                        kind: newKind,
                      },
                      22
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase text-fg-subtle">Official Vector Icon Preview</div>
                    <div className="text-xs font-semibold text-fg truncate max-w-[220px]">{newLabel}</div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
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
                  type="button"
                  onClick={() => void saveOrUpdateLink()}
                  disabled={!newLabel.trim() || !newUrl.trim()}
                  className="flex-1 h-9 rounded-xl bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover disabled:opacity-40 transition keycap shadow-xs cursor-pointer"
                >
                  {editingLink ? 'Save Changes' : 'Pin to Taskbar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* First-time / On-demand Browser Setup Modal */}
        <BrowserSetupModal
          open={browserModalOpen}
          currentBrowser={preferredBrowser}
          onSelect={handleSelectBrowser}
          onClose={() => setBrowserModalOpen(false)}
        />
      </>
    );
  }

  // INLINE CARD MODE (Category View)
  return (
    <section className="atelier-card rounded-3xl p-4 sm:p-5 overflow-hidden">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Rocket size={16} className="text-accent-text shrink-0" />
          <h2 className="text-sm font-semibold text-fg tracking-tight">
            {title || (categoryId ? `${category?.name ?? 'Category'} Launchpad` : 'Command Hub & Taskbar')}
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
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface border border-line text-xs w-fit">
            <button
              type="button"
              onClick={() => setNewKind('app')}
              className={`py-1 px-3 rounded-lg font-medium flex items-center gap-1.5 transition cursor-pointer ${
                newKind !== 'web' ? 'bg-accent text-accent-fg shadow-xs' : 'text-fg-muted hover:text-fg'
              }`}
            >
              <Laptop size={13} />
              <span>Native App</span>
            </button>
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
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="App Name (e.g. Discord, YouTube)"
              className="flex-1 h-9 rounded-xl bg-surface border border-line px-3 text-xs outline-none"
            />
            <div className="flex-1 flex gap-1">
              <input
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder={newKind === 'web' ? 'https://chatgpt.com' : 'C:\\...\\app.exe or discord://'}
                className="flex-1 h-9 rounded-xl bg-surface border border-line px-3 text-xs font-mono outline-none"
              />
              {newKind !== 'web' && getElectronAPI() && (
                <button
                  type="button"
                  onClick={handlePickFile}
                  title="Browse for executable"
                  className="h-9 px-2 rounded-xl border border-line bg-surface hover:bg-hover text-xs font-semibold text-fg flex items-center gap-1 cursor-pointer"
                >
                  <FolderOpen size={13} />
                </button>
              )}
            </div>
            <button
              onClick={() => void saveOrUpdateLink()}
              disabled={!newLabel.trim() || !newUrl.trim()}
              className="h-9 px-4 rounded-xl bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover disabled:opacity-40 transition keycap shrink-0 shadow-xs cursor-pointer"
            >
              {editingLink ? 'Save' : 'Pin to Taskbar'}
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
            + Add your first native or web application
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
                    className="size-6 rounded-lg grid place-items-center text-fg-subtle hover:text-fg hover:bg-surface-2 transition cursor-pointer"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={() => void removeLink(link.id)}
                    title={`Remove ${link.label}`}
                    aria-label={`Remove ${link.label}`}
                    className="size-6 rounded-lg grid place-items-center text-fg-subtle hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BrowserSetupModal
        open={browserModalOpen}
        currentBrowser={preferredBrowser}
        onSelect={handleSelectBrowser}
        onClose={() => setBrowserModalOpen(false)}
      />
    </section>
  );
}
