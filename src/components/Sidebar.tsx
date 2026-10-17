import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, useRef } from 'react';
import { FocusSpaceLogo } from './FocusSpaceLogo';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Download,
  Dumbbell,
  FileText,
  FolderKanban,
  GraduationCap,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { db } from '../db/db';
import { useMediaQuery, usePWAInstall } from '../lib/hooks';
import { createPage } from '../lib/pages';
import { toast } from '../lib/toast';
import { storage } from '../lib/utils';
import type { Category, LayoutMode } from '../types';

const iconFor = (id: string) =>
  ({
    academics: GraduationCap,
    fitness: Dumbbell,
    career: Target,
    personal: CircleUserRound,
    projects: FolderKanban,
  }[id] ?? FolderKanban);

export function Sidebar({
  collapsed,
  setCollapsed,
  active,
  setActive,
  categories,
  mobileOpen,
  onCloseMobile,
  activePageId,
  onOpenPage,
  layoutMode = 'orbital',
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  active: string;
  setActive: (v: string) => void;
  categories: Category[];
  mobileOpen: boolean;
  onCloseMobile: () => void;
  activePageId: string | null;
  onOpenPage: (categoryId: string, pageId: string) => void;
  layoutMode?: LayoutMode;
}) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const { isInstallable, install } = usePWAInstall();
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Resizable Sidebar Width (200px - 440px) with LocalStorage persistence
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const v = parseInt(storage.get('focusspace-sidebar-width') || '264', 10);
    return isNaN(v) ? 264 : Math.max(200, Math.min(440, v));
  });
  const [isDragging, setIsDragging] = useState(false);

  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onPointerMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(200, Math.min(440, startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const onPointerUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setIsDragging(false);
      const delta = ev.clientX - startX;
      const finalWidth = Math.max(200, Math.min(440, startWidth + delta));
      storage.set('focusspace-sidebar-width', String(finalWidth));
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleHoverEnter = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHovered(true);
  };

  const handleHoverLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 220);
  };

  const togglePermanentCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    storage.set('focusspace-sidebar', next ? 'collapsed' : 'expanded');
    setIsHovered(false);
  };

  const { countByCat, totalOpen } = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (t.status !== 'Submitted/Done') {
        total++;
        if (t.categoryId) {
          map[t.categoryId] = (map[t.categoryId] || 0) + 1;
        }
      }
    }
    return { countByCat: map, totalOpen: total };
  }, [tasks]);

  const openCountByCat = (catId: string) => countByCat[catId] || 0;

  const isOverlayMode = !isMobile && collapsed && isHovered;
  const isHiddenDesktop = !isMobile && collapsed && !isHovered;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fade-in fixed inset-0 z-40 bg-black/65 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Hover Peek trigger strip on left edge when collapsed on desktop */}
      {!isMobile && collapsed && (
        <div
          onMouseEnter={handleHoverEnter}
          onClick={handleHoverEnter}
          className="fixed top-0 bottom-0 left-0 w-3.5 z-40 group cursor-pointer flex items-center"
          title="Hover or click to view sidebar"
        >
          <div className="w-1 h-14 rounded-r-full bg-line-strong/60 group-hover:bg-accent group-hover:w-1.5 transition-all shadow-xs" />
        </div>
      )}

      {/* Main Sidebar Element */}
      <aside
        aria-label="Sidebar"
        onMouseEnter={collapsed ? handleHoverEnter : undefined}
        onMouseLeave={collapsed ? handleHoverLeave : undefined}
        style={{
          width: isHiddenDesktop ? 0 : isMobile ? undefined : `${sidebarWidth}px`,
        }}
        className={`fixed inset-y-0 left-0 z-50 shrink-0 bg-surface text-fg-soft flex flex-col relative ${
          isDragging
            ? 'transition-none select-none'
            : 'transition-[width,transform,opacity] duration-300 ease-out'
        } ${
          layoutMode === 'orbital'
            ? 'border border-line md:rounded-2xl shadow-card'
            : 'border-r border-line'
        } ${
          isMobile
            ? mobileOpen
              ? 'translate-x-0 w-[264px]'
              : '-translate-x-full w-[264px]'
            : isOverlayMode
            ? 'translate-x-0 shadow-2xl fixed inset-y-0 left-0 z-50 m-2 sm:m-3'
            : isHiddenDesktop
            ? '-translate-x-full opacity-0 pointer-events-none md:static md:w-0 md:p-0 md:m-0 md:border-none'
            : 'md:static md:z-auto md:translate-x-0 opacity-100'
        }`}
      >
        {/* Right edge drag-resize handle for desktop */}
        {!isMobile && !isHiddenDesktop && (
          <div
            onPointerDown={handleResizePointerDown}
            onDoubleClick={() => {
              setSidebarWidth(264);
              storage.set('focusspace-sidebar-width', '264');
            }}
            className="absolute top-0 bottom-0 -right-1 w-2.5 cursor-col-resize group z-30 flex items-center justify-center hover:bg-accent/20 active:bg-accent/30 transition select-none"
            title="Drag to resize menu width (Double-click to reset)"
          >
            <div className="w-[2px] h-12 rounded-full bg-line-strong/60 group-hover:bg-accent group-hover:h-20 transition-all" />
          </div>
        )}
        <div className="h-20 flex items-center px-5 border-b border-line/70">
          <button
            onClick={() => setActive('home')}
            className="flex items-center gap-3 min-w-0 group"
          >
            <div className="size-9 rounded-xl bg-accent text-accent-fg grid place-items-center shrink-0 keycap group-hover:scale-105 transition-transform">
              <FocusSpaceLogo size={20} />
            </div>
            <div className="text-left min-w-0">
              <div className="font-bold tracking-tight text-fg text-base">FocusSpace</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-fg-muted truncate">
                Local workspace
              </div>
            </div>
          </button>
        </div>

        <nav className="p-3 flex-1 overflow-y-auto space-y-4" aria-label="Main">
          <div>
            <div className="text-xs font-medium text-fg-muted px-3 mb-2">Workspace</div>
            <div className="space-y-1">
              <NavItem
                compact={false}
                icon={Home}
                label="Home / Master"
                badge={totalOpen > 0 ? String(totalOpen) : undefined}
                active={active === 'home'}
                onClick={() => setActive('home')}
              />
              <NavItem
                compact={false}
                icon={CalendarDays}
                label="Calendar"
                active={active === 'calendar'}
                onClick={() => setActive('calendar')}
              />
              <NavItem
                compact={false}
                icon={Trophy}
                label="Weekly Review"
                active={active === 'review'}
                onClick={() => setActive('review')}
              />
              <NavItem
                compact={false}
                icon={BarChart3}
                label="Analytics"
                active={active === 'analytics'}
                onClick={() => setActive('analytics')}
              />
              <NavItem
                compact={false}
                icon={BookOpen}
                label="Daily Journal"
                active={active === 'journal'}
                onClick={() => setActive('journal')}
              />
              <NavItem
                compact={false}
                icon={FileText}
                label="Pages"
                active={active === 'pages' && !activePageId}
                onClick={() => setActive('pages')}
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-fg-muted px-3 mb-2">Categories</div>
            <div className="space-y-1">
              {categories.map(c => {
                const count = openCountByCat(c.id);
                return (
                  <div key={c.id}>
                    <NavItem
                      compact={false}
                      icon={iconFor(c.id)}
                      label={c.name}
                      dot={c.color}
                      badge={count > 0 ? String(count) : undefined}
                      active={active === c.id && !activePageId}
                      onClick={() => setActive(c.id)}
                    />
                    {active === c.id && (
                      <CategoryPages
                        categoryId={c.id}
                        activePageId={activePageId}
                        onOpenPage={onOpenPage}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="p-3 border-t border-line bg-surface-2/40 space-y-1">
          {isInstallable && (
            <NavItem
              compact={false}
              icon={Download}
              label="Install App"
              active={false}
              onClick={install}
            />
          )}
          <NavItem
            compact={false}
            icon={Settings}
            label="Settings"
            active={active === 'settings'}
            onClick={() => setActive('settings')}
          />
          <button
            onClick={togglePermanentCollapse}
            aria-label={collapsed ? 'Pin and expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Pin Sidebar (Permanently Expanded)' : 'Collapse Sidebar (Hover near left edge to pop up)'}
            className="mt-1 w-full h-8 rounded-xl border border-line/60 hover:border-line bg-surface-2/60 hover:bg-hover text-fg-soft hover:text-fg hidden md:flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer transition keycap"
          >
            {collapsed ? (
              <>
                <PanelLeftOpen size={15} />
                <span>Pin Sidebar</span>
              </>
            ) : (
              <>
                <PanelLeftClose size={15} />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

function NavItem({
  icon: Icon,
  label,
  badge,
  active,
  onClick,
  compact = false,
  dot,
}: {
  icon: LucideIcon;
  label: string;
  badge?: string;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
  dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={compact ? label : undefined}
      aria-label={compact ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={`w-full h-10 rounded-xl flex items-center gap-3 px-3.5 text-[14px] font-medium transition-[background-color,color,box-shadow] duration-150 ${
        active
          ? 'bg-accent text-accent-fg font-semibold keycap'
          : 'text-fg-soft hover:bg-hover hover:text-fg'
      } ${compact ? 'justify-center px-0' : ''}`}
    >
      <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
      {!compact && (
        <>
          <span className="truncate flex-1 text-left">{label}</span>
          {dot && <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: dot }} />}
          {badge && (
            <span
              className={`text-[11px] font-mono px-1.5 py-0.5 rounded-md tabular-nums font-bold ${
                active ? 'bg-surface text-fg shadow-xs border border-line' : 'bg-surface-2 text-fg-soft border border-line'
              }`}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  );
}

function CategoryPages({
  categoryId,
  activePageId,
  onOpenPage,
}: {
  categoryId: string;
  activePageId: string | null;
  onOpenPage: (categoryId: string, pageId: string) => void;
}) {
  const pages = useLiveQuery(
    () => db.pages.where('categoryId').equals(categoryId).toArray(),
    [categoryId]
  );
  const [showAll, setShowAll] = useState(false);
  const sorted = [...(pages ?? [])].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
  const shown = showAll ? sorted : sorted.slice(0, 6);
  const add = async () => {
    try {
      onOpenPage(categoryId, (await createPage({ categoryId })).id);
    } catch {
      toast('Could not create the page.', 'error');
    }
  };
  return (
    <div
      className="my-1.5 ml-5 pl-2.5 border-l border-line space-y-0.5"
      role="group"
      aria-label="Pages"
    >
      {shown.map(page => (
        <button
          key={page.id}
          onClick={() => onOpenPage(categoryId, page.id)}
          aria-current={activePageId === page.id ? 'page' : undefined}
          title={page.title || 'Untitled'}
          className={`w-full h-8 rounded-lg flex items-center gap-2 px-2.5 text-[13px] text-left transition ${
            activePageId === page.id
              ? 'bg-accent text-accent-fg font-semibold'
              : 'text-fg-soft hover:bg-hover hover:text-fg'
          }`}
        >
          <FileText size={13} className="shrink-0" />
          <span className="truncate">{page.title.trim() || 'Untitled'}</span>
        </button>
      ))}
      {sorted.length > 6 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="w-full h-7 px-2 text-xs text-left text-fg-soft hover:text-fg"
        >
          {showAll ? 'Show fewer' : `Show all ${sorted.length}`}
        </button>
      )}
      <button
        onClick={() => void add()}
        className="w-full h-8 rounded-lg flex items-center gap-2 px-2.5 text-[13px] text-fg-soft hover:bg-hover hover:text-fg"
      >
        <Plus size={13} className="shrink-0" /> New page
      </button>
    </div>
  );
}
