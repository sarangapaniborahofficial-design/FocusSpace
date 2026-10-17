import { Activity, Columns3, Copy, Keyboard, LayoutGrid, Maximize2, Menu, Minus, Moon, Orbit, PanelLeftClose, PanelLeftOpen, Pause, Play, Plus, Search, Sparkles, Square, Sun, X } from 'lucide-react';
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
  onToggleSidebar,
  isSidebarCollapsed,
  onMinimize,
  onToggleMaximize,
  onClose,
  isMaximized = false,
  onOpenScreenTime,
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
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  onMinimize?: () => void;
  onToggleMaximize?: () => void;
  onClose?: () => void;
  isMaximized?: boolean;
  onOpenScreenTime?: () => void;
}) {
  const currentTheme = THEMES.includes(theme) ? theme : 'nocturne';
  const next = THEMES[(THEMES.indexOf(currentTheme) + 1) % THEMES.length];

  return (
    <header
      onDoubleClick={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('window-drag-region')) {
          onToggleMaximize?.();
        }
      }}
      className={`h-16 shrink-0 flex items-center justify-between gap-3 px-3 sm:px-4 bg-surface/90 backdrop-blur-xl sticky top-0 z-30 border-b border-line window-drag-region ${
        layoutMode === 'orbital' ? 'rounded-2xl border shadow-card mb-1' : ''
      }`}
    >
      {/* Left: Window Controls + Mobile Menu / Desktop Toggle + Breadcrumb Title */}
      <div className="flex items-center gap-2 sm:gap-2.5 text-sm text-fg-muted min-w-0">
        {/* Native-style Window Controls on Top Left */}
        <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-xl bg-surface-2/70 border border-line/70 window-no-drag shadow-xs shrink-0">
          <button
            type="button"
            onClick={onMinimize}
            title="Minimize Window"
            aria-label="Minimize Window"
            className="size-7 grid place-items-center rounded-lg hover:bg-hover text-fg-muted hover:text-fg transition-colors cursor-pointer"
          >
            <Minus size={13} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={onToggleMaximize}
            title={isMaximized ? 'Restore Window' : 'Maximize / Multi-window'}
            aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
            className="size-7 grid place-items-center rounded-lg hover:bg-hover text-fg-muted hover:text-fg transition-colors cursor-pointer"
          >
            {isMaximized ? <Copy size={11} strokeWidth={2.2} /> : <Square size={11} strokeWidth={2.2} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close Window (Prompts if active work)"
            aria-label="Close Window"
            className="size-7 grid place-items-center rounded-lg hover:bg-red-500/15 text-fg-muted hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer"
          >
            <X size={13} strokeWidth={2.2} />
          </button>
        </div>

        <div className="hidden sm:block h-5 w-px bg-line/80 mx-0.5 shrink-0" />

        <button
          onClick={onMenu}
          aria-label="Open navigation"
          className="md:hidden size-8.5 grid place-items-center rounded-xl border border-line bg-surface-2 text-fg-muted hover:text-fg hover:bg-hover keycap cursor-pointer window-no-drag"
        >
          <Menu size={17} />
        </button>
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isSidebarCollapsed ? 'Expand sidebar permanently' : 'Collapse sidebar (Hover near left edge to pop up)'}
            className="hidden md:grid size-8.5 place-items-center rounded-xl border border-line bg-surface-2 text-fg-muted hover:text-fg hover:bg-hover keycap cursor-pointer transition window-no-drag"
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        )}
        <span className="hidden sm:inline text-fg-subtle">Workspace</span>
        <span className="hidden sm:inline text-fg-subtle">/</span>
        <span className="font-semibold text-base text-fg truncate">{title}</span>
      </div>

      {/* Center: Quick Timer Control Pill (Desktop) */}
      <div className="window-no-drag">
        <HeaderTimerPill />
      </div>

      {/* Right: Search, Quick Add, Screen Time, Layout Switcher, Shortcuts, Theme Switcher */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 window-no-drag">
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

        {onOpenScreenTime && (
          <button
            onClick={onOpenScreenTime}
            title="Screen Time & Digital Wellbeing"
            aria-label="Screen Time & Digital Wellbeing"
            className="size-9 grid place-items-center rounded-xl border border-line bg-surface-2 text-fg-muted hover:text-fg hover:bg-hover transition-colors keycap cursor-pointer"
          >
            <Activity size={16} className="text-accent-text" />
          </button>
        )}

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
      </div>
    </header>
  );
}
