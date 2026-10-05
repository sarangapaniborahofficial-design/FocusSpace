import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, CircleUserRound, Dumbbell, FileText, FolderKanban, GraduationCap, Home, Plus, Settings, Sparkles, Target, Download, type LucideIcon } from 'lucide-react';
import { db } from '../db/db';
import { useMediaQuery, usePWAInstall } from '../lib/hooks';
import { createPage } from '../lib/pages';
import { toast } from '../lib/toast';
import type { Category } from '../types';

const iconFor = (id: string) => ({ academics: GraduationCap, fitness: Dumbbell, career: Target, personal: CircleUserRound, projects: FolderKanban }[id] ?? FolderKanban);

export function Sidebar({ collapsed, setCollapsed, active, setActive, categories, mobileOpen, onCloseMobile, activePageId, onOpenPage }: {
  collapsed: boolean; setCollapsed: (v: boolean) => void; active: string; setActive: (v: string) => void; categories: Category[];
  mobileOpen: boolean; onCloseMobile: () => void;
  /** The page currently open (if any) and how to open one: (categoryId, pageId). */
  activePageId: string | null; onOpenPage: (categoryId: string, pageId: string) => void;
}) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const { isInstallable, install } = usePWAInstall();
  // The desktop "collapsed" preference must not hide labels inside the mobile drawer.
  const compact = collapsed && !isMobile;

  return (
    <>
      {mobileOpen && <div className="fade-in fixed inset-0 z-40 bg-black/60 md:hidden" onClick={onCloseMobile} aria-hidden="true" />}
      <aside
        aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-50 w-[240px] md:static md:z-auto ${compact ? 'md:w-[52px]' : 'md:w-[240px]'} shrink-0 bg-[var(--sidebar-bg)] md:rounded-3xl border border-zinc-800 text-zinc-300 transition-[transform,width] duration-200 flex flex-col ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="h-16 flex items-center px-4 border-b border-zinc-800/80">
          <button onClick={() => setActive('home')} className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-xl bg-zinc-100 text-zinc-950 grid place-items-center shadow-lg shadow-white/5"><Sparkles size={19} /></div>
            {!compact && <div className="text-left"><div className="font-semibold tracking-tight">FocusSpace</div><div className="text-[10px] uppercase tracking-[.18em] text-zinc-500">Local workspace</div></div>}
          </button>
        </div>
        <nav className="p-3 flex-1 overflow-y-auto" aria-label="Main">
          <div className="text-[10px] uppercase tracking-[.18em] text-zinc-600 px-2 mb-2">{compact ? '' : 'Workspace'}</div>
          <NavItem compact={compact} icon={Home} label="Home / Master" active={active === 'home'} onClick={() => setActive('home')} />
          <NavItem compact={compact} icon={CalendarDays} label="Calendar" active={active === 'calendar'} onClick={() => setActive('calendar')} />
          <NavItem compact={compact} icon={BarChart3} label="Analytics" active={active === 'analytics'} onClick={() => setActive('analytics')} />
          <NavItem compact={compact} icon={FileText} label="Pages" active={active === 'pages' && !activePageId} onClick={() => setActive('pages')} />
          <div className="my-5 border-t border-zinc-900" />
          <div className="text-[10px] uppercase tracking-[.18em] text-zinc-600 px-2 mb-2">{compact ? '' : 'Categories'}</div>
          {categories.map(c => (
            <div key={c.id}>
              <NavItem compact={compact} icon={iconFor(c.id)} label={c.name} dot={c.color} active={active === c.id && !activePageId} onClick={() => setActive(c.id)} />
              {!compact && active === c.id && <CategoryPages categoryId={c.id} activePageId={activePageId} onOpenPage={onOpenPage} />}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-zinc-800/80">
          {isInstallable && <NavItem compact={compact} icon={Download} label="Install App" active={false} onClick={install} />}
          <NavItem compact={compact} icon={Settings} label="Settings" active={active === 'settings'} onClick={() => setActive('settings')} />
          <button onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="mt-2 w-full h-9 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 hidden md:grid place-items-center">{collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
        </div>
      </aside>
    </>
  );
}

function NavItem({ icon: Icon, label, active, onClick, compact, dot }: {
  icon: LucideIcon; label: string; active: boolean; onClick: () => void; compact: boolean; dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={compact ? label : undefined}
      aria-label={compact ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={`w-full h-8 rounded-md flex items-center gap-3 px-3 mb-1 text-sm transition ${active ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)] shadow-inner' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'} ${compact ? 'justify-center' : ''}`}
    >
      <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
      {!compact && <><span className="truncate flex-1 text-left">{label}</span>{dot && <span className="size-2 rounded-full" style={{ backgroundColor: dot }} />}</>}
    </button>
  );
}

/** Pages of the category you're in, listed under it so notes are one click away. */
function CategoryPages({ categoryId, activePageId, onOpenPage }: { categoryId: string; activePageId: string | null; onOpenPage: (categoryId: string, pageId: string) => void }) {
  const pages = useLiveQuery(() => db.pages.where('categoryId').equals(categoryId).toArray(), [categoryId]);
  const [showAll, setShowAll] = useState(false);
  const sorted = [...(pages ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const shown = showAll ? sorted : sorted.slice(0, 6);
  const add = async () => {
    try { onOpenPage(categoryId, (await createPage({ categoryId })).id); } catch { toast('Could not create the page.', 'error'); }
  };
  return (
    <div className="mb-2 ml-[22px] pl-2 border-l border-zinc-800/80" role="group" aria-label="Pages">
      {shown.map(page => (
        <button
          key={page.id} onClick={() => onOpenPage(categoryId, page.id)} aria-current={activePageId === page.id ? 'page' : undefined} title={page.title || 'Untitled'}
          className={`w-full h-8 rounded-md flex items-center gap-2 px-2 text-[13px] text-left transition ${activePageId === page.id ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)]' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'}`}
        >
          <FileText size={13} className="shrink-0" /><span className="truncate">{page.title.trim() || 'Untitled'}</span>
        </button>
      ))}
      {sorted.length > 6 && (
        <button onClick={() => setShowAll(v => !v)} className="w-full h-7 px-2 text-xs text-left text-zinc-600 hover:text-zinc-300">{showAll ? 'Show fewer' : `Show all ${sorted.length}`}</button>
      )}
      <button onClick={() => void add()} className="w-full h-8 rounded-md flex items-center gap-2 px-2 text-[13px] text-zinc-600 hover:bg-zinc-900 hover:text-zinc-300"><Plus size={13} className="shrink-0" /> New page</button>
    </div>
  );
}
