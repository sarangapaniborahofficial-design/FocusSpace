import React from 'react';
import {
  Activity,
  Columns3,
  Keyboard,
  LayoutGrid,
  Maximize2,
  Menu,
  Moon,
  Orbit,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sparkles,
  Sun,
} from 'lucide-react';
import type { LayoutMode } from '../types';
import { FloatingHUDTrigger } from './FloatingHUD';
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
      className={`h-14 sm:h-16 shrink-0 flex items-center justify-between gap-3 px-3 sm:px-4 ${
        getElectronAPI()?.isElectron ? 'pr-[140px]' : ''
      } bg-[#050605] text-[#f2f4ef] window-drag-region select-none overflow-hidden relative z-30`}
    >
      {/* Left: Brand + Breadcrumb + Sidebar Toggle */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
        <button
          onClick={onMenu}
          aria-label="Open navigation"
          className="md:hidden size-8 grid place-items-center rounded-lg border border-[#2a302a] bg-[#111411] text-[#a3aaa0] hover:text-[#f2f4ef] hover:bg-[#1a1e1a] cursor-pointer window-no-drag shrink-0"
        >
          <Menu size={16} />
        </button>
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:grid size-8 place-items-center rounded-lg border border-[#2a302a] bg-[#111411] text-[#a3aaa0] hover:text-[#f2f4ef] hover:bg-[#1a1e1a] cursor-pointer transition window-no-drag shrink-0"
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        )}
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-base tracking-tight text-[#f2f4ef] shrink-0">FocusSpace</span>
          <span className="hidden sm:inline text-[#7f877c] text-xs">/</span>
          <span className="hidden sm:inline font-medium text-xs text-[#a3aaa0] truncate max-w-[160px] md:max-w-xs">{title}</span>
        </div>
      </div>

      {/* Center: Spotify-Style Centered Omni-Search Pill */}
      <div className="window-no-drag flex-1 max-w-xl mx-2 flex justify-center">
        <button
          onClick={onSearch}
          aria-label="Search or capture a task (Ctrl + K)"
          title="Search or capture a task (@category #tag !urgent ~30m)"
          className="w-full max-w-[480px] h-9 sm:h-10 px-4 rounded-full border border-[#2a302a] bg-[#111411] hover:border-[#3d453d] text-[#a3aaa0] hover:text-[#f2f4ef] flex items-center justify-between text-xs sm:text-sm transition-all cursor-pointer shadow-xs group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search size={14} className="text-[#7f877c] group-hover:text-[#c8ff29] transition-colors shrink-0" />
            <span className="truncate">Search or capture a task (@category #tag !urgent ~30m)</span>
          </div>
          <kbd className="hidden sm:inline font-mono text-[11px] px-2 py-0.5 rounded bg-[#1d221d] border border-[#2a302a] text-[#a3aaa0] shrink-0 ml-2">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right: Screen Time, Quick Add, Theme, and Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 window-no-drag">
        {/* Screen Time Badge */}
        {onOpenScreenTime && (
          <button
            onClick={onOpenScreenTime}
            title="Screen Time & Digital Wellbeing"
            aria-label="Screen Time & Digital Wellbeing"
            className="hidden lg:flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-[#2a302a] bg-[#111411] text-[#a3aaa0] hover:text-[#f2f4ef] hover:border-[#3d453d] font-mono text-xs transition-colors cursor-pointer shrink-0"
          >
            <Activity size={13} className="text-[#c8ff29]" />
            <span>{formatScreenTimeClock(screenTime.todaySeconds)} today</span>
          </button>
        )}

        {/* Quick Add Button */}
        <button
          onClick={onQuickAdd}
          aria-label="Quick add task"
          title="Quick Add Task (Ctrl + N)"
          className="h-8 px-2.5 sm:px-3 rounded-lg bg-[#c8ff29] text-[#0a0c0a] hover:bg-[#b8ef1d] text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0"
        >
          <Plus size={14} strokeWidth={2.5} />
          <span className="hidden sm:inline">Add</span>
        </button>

        {/* Floating HUD Trigger */}
        <FloatingHUDTrigger className="hidden md:grid size-8 rounded-lg shrink-0 border-[#2a302a] bg-[#111411] text-[#a3aaa0] hover:text-[#f2f4ef]" />

        {/* Theme Switcher */}
        <button
          title={`Theme: ${THEME_META[currentTheme]?.label}. Switch to ${THEME_META[next]?.label}`}
          aria-label={`Theme: ${THEME_META[currentTheme]?.label}. Switch to ${THEME_META[next]?.label}`}
          onClick={handleCycleTheme}
          className="size-8 grid place-items-center rounded-lg border border-[#2a302a] bg-[#111411] text-[#a3aaa0] hover:text-[#f2f4ef] hover:bg-[#1a1e1a] transition-colors cursor-pointer shrink-0"
        >
          {currentTheme === 'solaris' ? (
            <Sun size={14} className="text-amber-500" />
          ) : currentTheme === 'bauhaus' ? (
            <LayoutGrid size={14} className="text-[#f2f4ef]" />
          ) : currentTheme === 'nocturne' ? (
            <Moon size={14} className="text-[#c8ff29]" />
          ) : (
            <Sparkles size={14} className="text-[#c8ff29]" />
          )}
        </button>

        {/* Shortcuts */}
        {onShortcuts && (
          <button
            onClick={onShortcuts}
            title="Keyboard Shortcuts (Ctrl + /)"
            aria-label="Keyboard Shortcuts"
            className="hidden xl:grid size-8 place-items-center rounded-lg border border-[#2a302a] bg-[#111411] text-[#a3aaa0] hover:text-[#f2f4ef] hover:bg-[#1a1e1a] transition-colors cursor-pointer shrink-0"
          >
            <Keyboard size={14} />
          </button>
        )}

        {/* Fullscreen F11 */}
        {getElectronAPI() && (
          <button
            onClick={() => void getElectronAPI()?.toggleFullscreen()}
            title="Toggle Fullscreen (F11)"
            aria-label="Toggle Fullscreen"
            className="hidden xl:grid size-8 place-items-center rounded-lg border border-[#2a302a] bg-[#111411] text-[#a3aaa0] hover:text-[#f2f4ef] hover:bg-[#1a1e1a] transition-colors cursor-pointer shrink-0"
          >
            <Maximize2 size={13} />
          </button>
        )}

        {/* User Avatar Circle */}
        <div
          title="FocusSpace Profile"
          className="size-8 rounded-full bg-[#1d221d] border border-[#2a302a] grid place-items-center text-[#f2f4ef] font-bold text-xs select-none shrink-0"
        >
          S
        </div>
      </div>
    </header>
  );
}
