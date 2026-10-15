import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import {
  BarChart3,
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
  const compact = collapsed && !isMobile;

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

  return (
    <>
      {mobileOpen && (
        <div
          className="fade-in fixed inset-0 z-40 bg-black/65 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside
        aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-50 w-[264px] md:static md:z-auto ${
          compact ? 'md:w-[70px]' : 'md:w-[260px]'
        } shrink-0 bg-surface text-fg-soft transition-[transform,width] duration-200 flex flex-col ${
          layoutMode === 'orbital'
            ? 'border border-line md:rounded-2xl shadow-card'
            : 'border-r border-line'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className={`h-20 flex items-center ${compact ? 'justify-center px-2' : 'px-5'} border-b border-line/70`}>
          <button
            onClick={() => setActive('home')}
            className="flex items-center gap-3 min-w-0 group"
          >
            <div className="size-9 rounded-xl bg-accent text-accent-fg grid place-items-center shrink-0 keycap group-hover:scale-105 transition-transform">
              <Sparkles size={18} />
            </div>
            {!compact && (
              <div className="text-left min-w-0">
                <div className="font-bold tracking-tight text-fg text-base">FocusSpace</div>
                <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-fg-muted truncate">
                  Local workspace
                </div>
              </div>
            )}
          </button>
        </div>

        <nav className="p-3 flex-1 overflow-y-auto space-y-4" aria-label="Main">
          <div>
            {!compact && (
              <div className="text-xs font-medium text-fg-muted px-3 mb-2">Workspace</div>
            )}
            <div className="space-y-1">
              <NavItem
                compact={compact}
                icon={Home}
                label="Home / Master"
                badge={totalOpen > 0 ? String(totalOpen) : undefined}
                active={active === 'home'}
                onClick={() => setActive('home')}
              />
              <NavItem
                compact={compact}
                icon={CalendarDays}
                label="Calendar"
                active={active === 'calendar'}
                onClick={() => setActive('calendar')}
              />
              <NavItem
                compact={compact}
                icon={Trophy}
                label="Weekly Review"
                active={active === 'review'}
                onClick={() => setActive('review')}
              />
              <NavItem
                compact={compact}
                icon={BarChart3}
                label="Analytics"
                active={active === 'analytics'}
                onClick={() => setActive('analytics')}
              />
              <NavItem
                compact={compact}
                icon={FileText}
                label="Pages"
                active={active === 'pages' && !activePageId}
                onClick={() => setActive('pages')}
              />
            </div>
          </div>

          <div>
            {!compact && (
              <div className="text-xs font-medium text-fg-muted px-3 mb-2">Categories</div>
            )}
            <div className="space-y-1">
              {categories.map(c => {
                const count = openCountByCat(c.id);
                return (
                  <div key={c.id}>
                    <NavItem
                      compact={compact}
                      icon={iconFor(c.id)}
                      label={c.name}
                      dot={c.color}
                      badge={count > 0 ? String(count) : undefined}
                      active={active === c.id && !activePageId}
                      onClick={() => setActive(c.id)}
                    />
                    {!compact && active === c.id && (
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
              compact={compact}
              icon={Download}
              label="Install App"
              active={false}
              onClick={install}
            />
          )}
          <NavItem
            compact={compact}
            icon={Settings}
            label="Settings"
            active={active === 'settings'}
            onClick={() => setActive('settings')}
          />
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="mt-1 w-full h-8 rounded-xl border border-transparent hover:border-line text-fg-soft hover:text-fg hover:bg-hover hidden md:grid place-items-center"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
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
  compact,
  dot,
}: {
  icon: LucideIcon;
  label: string;
  badge?: string;
  active: boolean;
  onClick: () => void;
  compact: boolean;
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
              className={`text-[11px] font-mono px-1.5 py-0.5 rounded-md tabular-nums ${
                active ? 'bg-black/20 text-accent-fg font-semibold' : 'bg-surface-2 text-fg-soft border border-line'
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
