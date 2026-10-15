import { useLiveQuery } from 'dexie-react-hooks';
import { Command } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { db, seedDatabase } from './db/db';
import { Analytics } from './components/Analytics';
import { Calendar } from './components/Calendar';
import { CategoryView, type CategoryTab } from './components/CategoryView';
import { CommandPalette } from './components/CommandPalette';
import { Header } from './components/Header';
import { PageView } from './components/PageView';
import { PagesList } from './components/PagesList';
import { MiniTimer } from './components/MiniTimer';
import { Pomodoro } from './components/Pomodoro';
import { QuickAddModal } from './components/QuickAddModal';
import { Settings } from './components/Settings';
import { Sidebar } from './components/Sidebar';
import { TaskEditor } from './components/TaskEditor';
import { Toaster } from './components/Toaster';
import { ReloadPrompt } from './components/ReloadPrompt';
import { Review } from './components/Review';
import { ShortcutsModal } from './components/ShortcutsModal';
import { Today } from './components/Today';
import { ErrorBoundary } from './components/ui';
import { openTaskEditor } from './lib/taskEditor';
import { timer } from './lib/timer';
import { checkAndNotifyOverdue } from './lib/notifications';
import { storage } from './lib/utils';
import type { LayoutMode, Page, Task } from './types';

const STATIC_VIEWS = ['home', 'calendar', 'review', 'analytics', 'pages', 'settings'];
const VIEW_TITLES: Record<string, string> = {
  home: 'Home',
  calendar: 'Calendar',
  review: 'Weekly Review',
  analytics: 'Analytics',
  pages: 'Pages',
  settings: 'Settings',
};
const THEMES = ['nocturne', 'onyx', 'solaris', 'bauhaus'];
const normalizeTheme = (raw: string | null): string => {
  if (raw === 'nocturne' || raw === 'onyx' || raw === 'solaris' || raw === 'bauhaus') return raw;
  if (raw === 'dark') return 'nocturne';
  if (raw === 'light') return 'solaris';
  return 'nocturne';
};
const nextTheme = (theme: string) => THEMES[(THEMES.indexOf(normalizeTheme(theme)) + 1) % THEMES.length];

interface Nav {
  view: string;
  /** Inside a category: which section is showing, and which page (if any) is open. */
  tab: CategoryTab;
  pageId: string | null;
  /** Pre-filled task filter. */
  query: string;
  /** Bumped on every navigation so views remount fresh. */
  n: number;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() => storage.get('focusspace-sidebar') === 'collapsed');
  const [drawer, setDrawer] = useState(false);
  const [nav, setNav] = useState<Nav>({ view: 'home', tab: 'tasks', pageId: null, query: '', n: 0 });
  const [quick, setQuick] = useState(false);
  const [search, setSearch] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [theme, setTheme] = useState(() => normalizeTheme(storage.get('focusspace-theme')));
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => (storage.get('focusspace-layout') === 'cockpit' ? 'cockpit' : 'orbital'));
  const categoryList = useLiveQuery(() => db.categories.toArray(), []);
  const categories = categoryList ?? [];

  const active = nav.view;
  const isCategory = categories.some(c => c.id === active);

  const go = useCallback((view: string, opts: { tab?: CategoryTab; pageId?: string | null; query?: string } = {}) => {
    const tab = opts.tab ?? 'tasks';
    const pageId = opts.pageId ?? null;
    const query = opts.query ?? '';
    setDrawer(false);
    setNav(prev => (prev.view === view && prev.tab === tab && prev.pageId === pageId && !query ? prev : { view, tab, pageId, query, n: prev.n + 1 }));
  }, []);

  const boot = useCallback(() => {
    setDbError(null);
    seedDatabase()
      .then(() => setReady(true))
      .catch(err => setDbError(err instanceof Error ? err.message : 'Unknown error'));
  }, []);

  useEffect(() => {
    boot();
    void navigator.storage?.persist?.().catch(() => undefined);
  }, [boot]);

  useEffect(() => {
    const clean = normalizeTheme(theme);
    document.documentElement.dataset.theme = clean;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', clean === 'nocturne' ? '#040404' : clean === 'onyx' ? '#020302' : clean === 'bauhaus' ? '#e9ece4' : '#f3eee4');
    document.documentElement.style.colorScheme = (clean === 'nocturne' || clean === 'onyx') ? 'dark' : 'light';
    storage.set('focusspace-theme', clean);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.layout = layoutMode;
    storage.set('focusspace-layout', layoutMode);
  }, [layoutMode]);

  useEffect(() => { storage.set('focusspace-sidebar', collapsed ? 'collapsed' : 'open'); }, [collapsed]);

  useEffect(() => {
    if (categoryList && !STATIC_VIEWS.includes(active) && !categoryList.some(c => c.id === active)) go('home');
  }, [categoryList, active, go]);

  useEffect(() => {
    const run = async () => {
      const enabled = (storage.get('focusspace-notify-overdue') ?? 'true') === 'true';
      if (!enabled) return;
      const today = new Date().toISOString().slice(0, 10);
      const overdue = await db.tasks.filter(t => t.status !== 'Submitted/Done' && !!t.dueDate && t.dueDate < today).count();
      void checkAndNotifyOverdue(overdue, today);
    };
    void run();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && (e.key === '/' || e.key === '?')) {
        e.preventDefault();
        setSearch(false);
        setQuick(false);
        setShortcuts(s => !s);
        return;
      }
      if (mod && key === 'n') { e.preventDefault(); setSearch(false); setShortcuts(false); setQuick(true); return; }
      if (mod && key === 'k') { e.preventDefault(); setQuick(false); setShortcuts(false); setSearch(s => !s); return; }
      if (mod && e.key === '1') { e.preventDefault(); go('home'); return; }
      if (mod && e.key === '2') { e.preventDefault(); go('calendar'); return; }
      if (mod && e.key === '3') { e.preventDefault(); go('pages'); return; }
      if (mod && e.key === '4') { e.preventDefault(); go('analytics'); return; }
      if (mod && e.key === '5') { e.preventDefault(); go('review'); return; }
      if (e.code === 'Space' && !e.repeat && !mod && !e.altKey) {
        const el = e.target;
        if (el instanceof Element && el.closest('input,textarea,select,button,a,[contenteditable="true"],[role="dialog"]')) return;
        e.preventDefault();
        timer.toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const closeQuick = useCallback(() => setQuick(false), []);
  const closeSearch = useCallback(() => setSearch(false), []);
  const openQuick = useCallback(() => setQuick(true), []);
  const openSearch = useCallback(() => setSearch(true), []);
  const cycleTheme = useCallback(() => setTheme(t => nextTheme(t)), []);
  const openTask = useCallback((task: Task) => openTaskEditor(task.id), []);
  const openPage = useCallback((page: Page) => go(page.categoryId ?? 'pages', { pageId: page.id }), [go]);
  const openPageIn = useCallback((categoryId: string, pageId: string) => go(categoryId, { pageId }), [go]);
  const goHome = useCallback(() => go('home'), [go]);

  if (dbError) {
    return (
      <div className="min-h-screen bg-canvas text-fg grid place-items-center p-6">
        <div className="max-w-sm text-center atelier-card rounded-2xl p-6" role="alert">
          <div className="size-10 rounded-xl bg-accent text-accent-fg grid place-items-center mx-auto mb-4"><Command size={18} /></div>
          <h1 className="text-lg font-semibold">FocusSpace can't open its local database</h1>
          <p className="text-sm text-fg-muted mt-2">This usually happens in private browsing, or when the browser blocks site storage. Allow storage for this site (or use a normal window) and try again.</p>
          <p className="text-xs text-fg-soft mt-3 break-words font-mono">{dbError}</p>
          <button onClick={boot} className="mt-5 h-10 px-4 rounded-xl bg-accent text-accent-fg text-sm font-medium keycap">Try again</button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-canvas text-fg grid place-items-center">
        <div className="text-center">
          <div className="size-11 rounded-2xl bg-accent text-accent-fg grid place-items-center mx-auto mb-3 keycap"><Command size={20} /></div>
          <div className="text-sm text-fg-muted">Initializing local workspace…</div>
        </div>
      </div>
    );
  }

  const title = VIEW_TITLES[active] ?? categories.find(c => c.id === active)?.name ?? 'Home';

  return (
    <div className={`h-screen overflow-hidden flex flex-col ${layoutMode === 'orbital' ? 'p-2 sm:p-4 gap-3' : 'p-0'}`}>
      <div
        className={`w-full h-full max-w-[1680px] mx-auto bg-[var(--app-bg)] backdrop-blur-2xl text-fg flex overflow-hidden relative transition-all duration-300 ${
          layoutMode === 'orbital'
            ? 'rounded-[28px] shadow-pop border border-line sm:gap-3 sm:p-3'
            : 'rounded-none border-x border-line'
        }`}
      >
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          active={active}
          setActive={go}
          categories={categories}
          mobileOpen={drawer}
          onCloseMobile={() => setDrawer(false)}
          activePageId={nav.pageId}
          onOpenPage={openPageIn}
          layoutMode={layoutMode}
        />

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-transparent">
          <Header
            title={title}
            onMenu={() => setDrawer(true)}
            onQuickAdd={openQuick}
            onSearch={openSearch}
            onShortcuts={() => setShortcuts(true)}
            theme={theme}
            setTheme={setTheme}
            layoutMode={layoutMode}
            setLayoutMode={setLayoutMode}
          />

          <div className="flex-1 min-h-0 flex overflow-hidden gap-3">
            <main className="flex-1 min-w-0 overflow-y-auto pb-24 sm:pb-12">
              <div key={nav.n} className="view-in">
                <ErrorBoundary onReset={goHome}>
                  {active === 'home' ? <Today onQuickAdd={openQuick} onNavigate={go} />
                    : isCategory ? (
                      <CategoryView
                        categoryId={active} tab={nav.tab} pageId={nav.pageId} query={nav.query} onQuickAdd={openQuick}
                        onTab={tab => go(active, { tab })} onOpenPage={pageId => go(active, { pageId })} onBackToPages={() => go(active, { tab: 'pages' })}
                      />
                    )
                    : active === 'calendar' ? <Calendar />
                    : active === 'review' ? <Review onNavigate={go} onQuickAdd={openQuick} />
                    : active === 'analytics' ? <Analytics onNavigate={go} />
                    : active === 'pages' ? (
                      nav.pageId ? <PageView pageId={nav.pageId} onBack={() => go('pages')} /> : <PagesList onOpenPage={pageId => go('pages', { pageId })} />
                    )
                    : <Settings theme={theme} setTheme={setTheme} layoutMode={layoutMode} setLayoutMode={setLayoutMode} />}
                </ErrorBoundary>
              </div>
            </main>

            {/* In Split/Cockpit mode, keep the Pomodoro Timer persistently docked on the right across secondary views */}
            {layoutMode === 'cockpit' && active !== 'home' && (
              <aside className="hidden 2xl:flex w-[350px] shrink-0 border-l border-line bg-surface/60 p-4 flex-col gap-4 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <span className="index-chip text-fg-muted">Docked Pomodoro Timer</span>
                  <span className="size-2 rounded-full bg-accent animate-pulse" />
                </div>
                <Pomodoro />
              </aside>
            )}
          </div>
        </div>

        <TaskEditor />
        <QuickAddModal open={quick} onClose={closeQuick} defaultCategory={isCategory ? active : undefined} />
        <ShortcutsModal open={shortcuts} onClose={() => setShortcuts(false)} />
        {search && <CommandPalette categories={categories} onClose={closeSearch} onNavigate={go} onNewTask={openQuick} onOpenTask={openTask} onOpenPage={openPage} onCycleTheme={cycleTheme} onOpenShortcuts={() => setShortcuts(true)} />}
        {active !== 'home' && layoutMode !== 'cockpit' && <MiniTimer onOpen={goHome} />}
        <Toaster />
        <ReloadPrompt />
      </div>
    </div>
  );
}
