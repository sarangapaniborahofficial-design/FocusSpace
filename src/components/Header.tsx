import { Columns3, Keyboard, LayoutGrid, Maximize2, Menu, Minimize2, Moon, Orbit, Pause, Play, Plus, Power, Search, Sparkles, Sun } from 'lucide-react';
import { MODE_LABELS, formatClock, timer, useTimer } from '../lib/timer';
import type { LayoutMode } from '../types';
import { FloatingHUDTrigger } from './FloatingHUD';
import { getElectronAPI } from '../lib/runtime';

const THEME_META: Record<string, { label: string; short: string }> = {
  nocturne: { label: 'Nocturne Solaris', short: 'Nocturne' },
  onyx: { label: 'Swiss Onyx', short: 'Swiss Onyx' },
  solaris: { label: 'Solaris', short: 'Solaris' },
  bauhaus: { label: 'Swiss Brutal', short: 'Swiss Brutal' },
};

const THEMES = ['nocturne', 'onyx', 'solaris', 'bauhaus'];

function HeaderTimerPill() {
  const s = useTimer();
  return (
    <div className="hidden xl:flex items-center gap-3 px-3 py-1 rounded-xl border border-line bg-surface-2">
      <span className="text-xs text-fg-muted">{MODE_LABELS[s.mode]}</span>
      <button
        onClick={() => timer.toggle()}
        title={s.running ? 'Pause timer (Space)' : 'Start timer (Space)'}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition ${
          s.running
            ? 'bg-accent text-accent-fg font-semibold shadow-xs'
            : 'text-fg-soft hover:bg-hover'
        }`}
      >
        {s.running ? <Pause size={12} /> : <Play size={12} fill="currentColor" />}
        <span className="tabular-nums">{formatClock(s.remainingMs)}</span>
      </button>
    </div>
  );
}

export function Header({
  title,
  onMenu,
  onQuickAdd,
  onSearch,
  onShortcuts,
  theme,
  setTheme,
  layoutMode = 'orbital',
  setLayoutMode,
  onQuit,
}: {
  title: string;
  onMenu: () => void;
  onQuickAdd: () => void;
  onSearch: () => void;
  onShortcuts?: () => void;
  theme: string;
  setTheme: (v: string) => void;
  layoutMode?: LayoutMode;
  setLayoutMode?: (m: LayoutMode) => void;
  onQuit?: () => void;
}) {
  const currentTheme = THEMES.includes(theme) ? theme : 'nocturne';
  const next = THEMES[(THEMES.indexOf(currentTheme) + 1) % THEMES.length];

  return (
    <header
      className={`h-16 shrink-0 flex items-center justify-between gap-3 px-3 sm:px-5 bg-surface/90 backdrop-blur-xl sticky top-0 z-30 border-b border-line ${
        layoutMode === 'orbital' ? 'rounded-2xl border shadow-card mb-1' : ''
      }`}
    >
      {/* Left: Mobile Menu + Breadcrumb Title */}
      <div className="flex items-center gap-2.5 text-sm text-fg-muted min-w-0">
        <button
          onClick={onMenu}
          aria-label="Open navigation"
          className="md:hidden size-9 grid place-items-center rounded-xl border border-line bg-surface-2 text-fg-muted hover:text-fg hover:bg-hover -ml-1 keycap"
        >
          <Menu size={18} />
        </button>
        <span className="hidden sm:inline text-fg-subtle">Workspace</span>
        <span className="hidden sm:inline text-fg-subtle">/</span>
        <span className="font-semibold text-base text-fg truncate">{title}</span>
      </div>

      {/* Center: Quick Timer Control Pill (Desktop) */}
      <HeaderTimerPill />

      {/* Right: Search, Quick Add, Layout Switcher, Shortcuts, Theme Switcher */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          onClick={onSearch}
          aria-label="Search and commands"
          className="hidden md:flex items-center gap-2 h-9 px-3 rounded-xl border border-line bg-surface-2 text-fg-muted hover:text-fg hover:border-line-strong text-sm keycap"
        >
          <Search size={15} />
          <span>Search</span>
          <kbd className="hidden xl:inline ml-1 font-mono text-[10px] border border-line bg-surface rounded px-1.5 py-0.5 text-fg-soft">Ctrl K</kbd>
        </button>
        <button
          onClick={onSearch}
          aria-label="Search and commands"
          className="md:hidden size-9 grid place-items-center rounded-xl border border-line bg-surface-2 text-fg-muted hover:text-fg hover:bg-hover keycap"
        >
          <Search size={16} />
        </button>

        <button
          onClick={onQuickAdd}
          aria-label="Quick add task"
          className="h-9 px-3 sm:px-3.5 rounded-xl bg-accent text-accent-fg hover:bg-accent-hover text-sm font-semibold flex items-center gap-1.5 keycap"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Quick Add</span>
        </button>

        {setLayoutMode && (
          <button
            onClick={() => setLayoutMode(layoutMode === 'orbital' ? 'cockpit' : 'orbital')}
            title={`Navigation layout: ${layoutMode === 'orbital' ? 'Floating Layout' : 'Split View (Docked Timer)'}. Click to switch.`}
            aria-label="Switch layout style"
            className="hidden lg:inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-xl border border-line bg-surface-2 text-fg-muted hover:text-fg hover:bg-hover text-xs font-semibold keycap"
          >
            {layoutMode === 'orbital' ? <Orbit size={14} className="text-accent-text" /> : <Columns3 size={14} className="text-accent-text" />}
            <span className="hidden xl:inline">{layoutMode === 'orbital' ? 'Floating' : 'Split View'}</span>
          </button>
        )}

        {onShortcuts && (
          <button
            onClick={onShortcuts}
            title="Keyboard Shortcuts (Ctrl + /)"
            aria-label="Keyboard Shortcuts"
            className="size-9 grid place-items-center rounded-xl border border-line bg-surface-2 text-fg-muted hover:text-fg hover:bg-hover transition-colors keycap"
          >
            <Keyboard size={16} />
          </button>
        )}

        <FloatingHUDTrigger className="size-9 rounded-xl" />

        <button
          title={`Theme: ${THEME_META[currentTheme]?.label}. Switch to ${THEME_META[next]?.label}`}
          aria-label={`Theme: ${THEME_META[currentTheme]?.label}. Switch to ${THEME_META[next]?.label}`}
          onClick={() => setTheme(next)}
          className="h-9 px-2.5 sm:px-3 rounded-xl border border-line bg-surface-2 text-fg-muted hover:text-fg hover:bg-hover flex items-center gap-1.5 text-xs font-semibold keycap shrink-0"
        >
          {currentTheme === 'solaris' ? (
            <Sun size={15} className="text-amber-600" />
          ) : currentTheme === 'bauhaus' ? (
            <LayoutGrid size={15} className="text-fg" />
          ) : currentTheme === 'nocturne' ? (
            <Moon size={15} className="text-accent-text" />
          ) : (
            <Sparkles size={15} className="text-accent-text" />
          )}
          <span className="hidden xl:inline">{THEME_META[currentTheme]?.short}</span>
        </button>

        {getElectronAPI() && (
          <button
            onClick={() => void getElectronAPI()?.toggleFullscreen()}
            title="Toggle Fullscreen (F11)"
            aria-label="Toggle Fullscreen"
            className="size-9 grid place-items-center rounded-xl border border-line bg-surface-2 text-fg-muted hover:text-fg hover:bg-hover transition-colors keycap shrink-0 cursor-pointer"
          >
            <Maximize2 size={15} />
          </button>
        )}

        {onQuit && (
          <button
            onClick={onQuit}
            title="Exit FocusSpace (Press Esc on Home)"
            aria-label="Exit FocusSpace"
            className="h-9 px-2.5 sm:px-3 rounded-xl border border-red-500/35 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/60 hover:text-red-300 transition-colors flex items-center gap-1.5 text-xs font-bold keycap cursor-pointer shrink-0"
          >
            <Power size={14} className="text-red-400" />
            <span className="hidden sm:inline">Quit</span>
            <kbd className="hidden lg:inline-block px-1 py-0.2 rounded bg-black/40 text-[9px] font-mono text-fg-subtle border border-line">
              ESC
            </kbd>
          </button>
        )}
      </div>
    </header>
  );
}
