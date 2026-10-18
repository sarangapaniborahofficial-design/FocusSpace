import React from 'react';
import {
  Activity,
  Keyboard,
  LayoutGrid,
  Maximize2,
  Menu,
  Minus,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sparkles,
  Square,
  Sun,
  X,
} from 'lucide-react';
import type { LayoutMode } from '../types';
import { FloatingHUDTrigger } from './FloatingHUD';
import { PinnedAppsPill } from './PinnedAppsPill';
import { getElectronAPI } from '../lib/runtime';
import { useScreenTimer, formatScreenTimeClock } from '../lib/screenTimer';
import { FocusSpaceLogo } from './FocusSpaceLogo';

const THEME_META: Record<string, { label: string; short: string }> = {
  nocturne: { label: 'Nocturne Solaris', short: 'Nocturne' },
  onyx: { label: 'Swiss Onyx', short: 'Swiss Onyx' },
  solaris: { label: 'Solaris', short: 'Solaris' },
  bauhaus: { label: 'Swiss Brutal', short: 'Swiss Brutal' },
};

const THEMES = ['nocturne', 'onyx', 'solaris', 'bauhaus'];

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
  const screenTime = useScreenTimer();

  const handleCycleTheme = () => {
    setTheme(next);
    const api = getElectronAPI();
    if (api?.setTitleBarTheme) {
      void api.setTitleBarTheme(next);
    }
  };

  return (
    <header
      onDoubleClick={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('window-drag-region')) {
          onToggleMaximize?.();
        }
      }}
      className="h-12 shrink-0 rounded-2xl bg-surface border border-line px-4 flex items-center justify-between gap-3 window-drag-region select-none relative z-30"
    >
      {/* Left: Brand + Breadcrumb + Sidebar Toggle */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink window-no-drag">
        <button
          onClick={onMenu}
          aria-label="Open navigation"
          className="md:hidden size-8 grid place-items-center rounded-xl border border-line bg-surface-2 hover:bg-hover text-fg-muted hover:text-fg cursor-pointer shrink-0 transition"
        >
          <Menu size={15} />
        </button>

        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:grid size-8 place-items-center rounded-xl border border-line bg-surface-2 hover:bg-hover text-fg-muted hover:text-fg cursor-pointer transition shrink-0"
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
        )}

        <div className="flex items-center gap-2 min-w-0">
          <div className="size-6 rounded-lg bg-accent text-accent-fg grid place-items-center shrink-0 keycap">
            <FocusSpaceLogo size={14} />
          </div>
          <span className="font-bold text-sm tracking-tight text-fg shrink-0">FocusSpace</span>
          <span className="hidden sm:inline text-fg-muted/60 text-xs">/</span>
          <span className="hidden sm:inline font-medium text-xs text-fg-muted truncate max-w-[140px] md:max-w-xs">{title}</span>
        </div>
      </div>

      {/* Center: Spotify-Style Centered Omni-Search Pill */}
      <div className="window-no-drag flex-1 max-w-lg mx-2 flex justify-center">
        <button
          onClick={onSearch}
          aria-label="Search or capture a task (Ctrl + K)"
          title="Search or capture a task (@category #tag !urgent ~30m)"
          className="w-full max-w-[440px] h-8 px-3 rounded-full border border-line bg-surface-2 hover:bg-hover text-fg-muted hover:text-fg flex items-center justify-between text-xs transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search size={13} className="text-fg-muted group-hover:text-accent-text transition-colors shrink-0" />
            <span className="truncate">Search or capture a task (@category #tag !urgent ~30m)</span>
          </div>
          <kbd className="hidden sm:inline font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface border border-line text-fg-muted shrink-0 ml-2">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Pinned Workspace Apps Pill */}
      <div className="window-no-drag hidden md:flex items-center shrink-0">
        <PinnedAppsPill />
      </div>

      {/* Right: Screen Time, Quick Add, Theme, Controls & Window Buttons */}
      <div className="flex items-center gap-1.5 shrink-0 window-no-drag">
        {/* Screen Time Badge */}
        {onOpenScreenTime && (
          <button
            onClick={onOpenScreenTime}
            title="Screen Time & Digital Wellbeing"
            aria-label="Screen Time & Digital Wellbeing"
            className="hidden lg:flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-line bg-surface-2 hover:bg-hover text-fg-muted hover:text-fg font-mono text-xs transition-colors cursor-pointer shrink-0"
          >
            <Activity size={13} className="text-accent-text" />
            <span>{formatScreenTimeClock(screenTime.todaySeconds)}</span>
          </button>
        )}

        {/* Quick Add Button */}
        <button
          onClick={onQuickAdd}
          aria-label="Quick add task"
          title="Quick Add Task (Ctrl + N)"
          className="h-8 px-2.5 rounded-xl bg-accent text-accent-fg font-semibold keycap text-xs flex items-center gap-1 hover:bg-accent-hover transition-all cursor-pointer shrink-0"
        >
          <Plus size={13} strokeWidth={2.5} />
          <span className="hidden sm:inline">Add</span>
        </button>

        {/* Floating HUD Trigger */}
        <FloatingHUDTrigger className="hidden md:grid size-8 rounded-xl shrink-0 border-line bg-surface-2 hover:bg-hover text-fg-muted hover:text-fg" />

        {/* Theme Switcher */}
        <button
          title={`Theme: ${THEME_META[currentTheme]?.label}. Switch to ${THEME_META[next]?.label}`}
          aria-label={`Theme: ${THEME_META[currentTheme]?.label}. Switch to ${THEME_META[next]?.label}`}
          onClick={handleCycleTheme}
          className="size-8 grid place-items-center rounded-xl border border-line bg-surface-2 hover:bg-hover text-fg-muted hover:text-fg transition-colors cursor-pointer shrink-0"
        >
          {currentTheme === 'solaris' ? (
            <Sun size={13} className="text-amber-500" />
          ) : currentTheme === 'bauhaus' ? (
            <LayoutGrid size={13} className="text-fg" />
          ) : currentTheme === 'nocturne' ? (
            <Moon size={13} className="text-accent-text" />
          ) : (
            <Sparkles size={13} className="text-accent-text" />
          )}
        </button>

        {/* Shortcuts */}
        {onShortcuts && (
          <button
            onClick={onShortcuts}
            title="Keyboard Shortcuts (Ctrl + /)"
            aria-label="Keyboard Shortcuts"
            className="hidden xl:grid size-8 place-items-center rounded-xl border border-line bg-surface-2 hover:bg-hover text-fg-muted hover:text-fg transition-colors cursor-pointer shrink-0"
          >
            <Keyboard size={13} />
          </button>
        )}

        {/* Fullscreen F11 */}
        {getElectronAPI() && (
          <button
            onClick={() => void getElectronAPI()?.toggleFullscreen()}
            title="Toggle Fullscreen (F11)"
            aria-label="Toggle Fullscreen"
            className="hidden xl:grid size-8 place-items-center rounded-xl border border-line bg-surface-2 hover:bg-hover text-fg-muted hover:text-fg transition-colors cursor-pointer shrink-0"
          >
            <Maximize2 size={12} />
          </button>
        )}

        {/* User Avatar Pill */}
        <div
          title="FocusSpace Profile"
          className="size-8 rounded-full bg-surface-2 border border-line grid place-items-center text-fg font-bold text-xs select-none shrink-0"
        >
          S
        </div>

        {/* Electron Window Control Buttons [ — ] [ ◻ ] [ ✕ ] */}
        {getElectronAPI() && (
          <div className="flex items-center gap-0.5 ml-1 border-l border-line pl-2">
            <button
              onClick={onMinimize}
              title="Minimize"
              aria-label="Minimize"
              className="size-7 grid place-items-center rounded-lg text-fg-muted hover:text-fg hover:bg-hover transition cursor-pointer"
            >
              <Minus size={13} />
            </button>
            <button
              onClick={onToggleMaximize}
              title={isMaximized ? 'Restore' : 'Maximize'}
              aria-label={isMaximized ? 'Restore' : 'Maximize'}
              className="size-7 grid place-items-center rounded-lg text-fg-muted hover:text-fg hover:bg-hover transition cursor-pointer"
            >
              <Square size={11} />
            </button>
            <button
              onClick={onClose}
              title="Close"
              aria-label="Close"
              className="size-7 grid place-items-center rounded-lg text-fg-muted hover:text-rose-500 hover:bg-rose-500/15 transition cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
