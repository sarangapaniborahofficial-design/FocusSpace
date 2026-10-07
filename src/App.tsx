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
import { QuickAddModal } from './components/QuickAddModal';
import { Settings } from './components/Settings';
import { Sidebar } from './components/Sidebar';
import { TaskEditor } from './components/TaskEditor';
import { Toaster } from './components/Toaster';
import { ReloadPrompt } from './components/ReloadPrompt';
import { Today } from './components/Today';
import { ErrorBoundary } from './components/ui';
import { openTaskEditor } from './lib/taskEditor';
import { timer } from './lib/timer';
import { storage } from './lib/utils';
import type { Page, Task } from './types';

const STATIC_VIEWS = ['home', 'calendar', 'analytics', 'pages', 'settings'];
const VIEW_TITLES: Record<string, string> = { home: 'Home', calendar: 'Calendar', analytics: 'Analytics', pages: 'Pages', settings: 'Settings' };
const THEMES = ['dark', 'oled', 'light'];
const nextTheme = (theme: string) => THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];

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
  const [theme, setTheme] = useState(() => storage.get('focusspace-theme') || 'light');
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
    // Ask the browser not to evict local data under storage pressure. Ignored where unsupported.
    void navigator.storage?.persist?.().catch(() => undefined);
  }, [boot]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f5f2eb' : '#121214');
    document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
    storage.set('focusspace-theme', theme);
  }, [theme]);

  useEffect(() => { storage.set('focusspace-sidebar', collapsed ? 'collapsed' : 'open'); }, [collapsed]);

  // A deleted category must not leave the app on a dead view (it used to fall through to Settings).
  useEffect(() => {
    if (categoryList && !STATIC_VIEWS.includes(active) && !categoryList.some(c => c.id === active)) go('home');
  }, [categoryList, active, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'n') { e.preventDefault(); setSearch(false); setQuick(true); return; }
      if (mod && key === 'k') { e.preventDefault(); setQuick(false); setSearch(s => !s); return; }
      if (e.code === 'Space' && !e.repeat && !mod && !e.altKey) {
        const el = e.target;
        if (el instanceof Element && el.closest('input,textarea,select,button,a,[contenteditable="true"],[role="dialog"]')) return;
        e.preventDefault();
        timer.toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      <div className="min-h-screen white grid place-items-center p-6">
        <div className="max-w-sm text-center" role="alert">
          <div className="size-10 rounded-xl bg-[var(--accent)] text-[#121214] grid place-items-center mx-auto mb-4"><Command size={18} /></div>
          <h1 className="text-lg font-semibold">FocusSpace can't open its local database</h1>
          <p className="text-sm text-zinc-500 mt-2">This usually happens in private browsing, or when the browser blocks site storage. Allow storage for this site (or use a normal window) and try again.</p>
          <p className="text-xs text-zinc-600 mt-3 break-words">{dbError}</p>
          <button onClick={boot} className="mt-5 h-10 px-4 rounded-lg bg-[var(--accent)] text-[#121214] text-sm font-medium">Try again</button>
        </div>
      </div>
    );
  }

  if (!ready) return <div className="min-h-screen white grid place-items-center"><div className="text-center"><div className="size-10 rounded-xl bg-[var(--accent)] text-[#121214] grid place-items-center mx-auto mb-3"><Command size={18} /></div><div className="text-sm text-zinc-500">Initializing local workspace…</div></div></div>;

  const title = VIEW_TITLES[active] ?? categories.find(c => c.id === active)?.name ?? 'Home';

  return (
    <div className="h-screen overflow-hidden bg-[var(--app-bg)] text-zinc-900 flex p-4 gap-4">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} active={active} setActive={go} categories={categories} mobileOpen={drawer} onCloseMobile={() => setDrawer(false)} activePageId={nav.pageId} onOpenPage={openPageIn} />
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-transparent">
        <Header title={title} onMenu={() => setDrawer(true)} onQuickAdd={openQuick} onSearch={openSearch} theme={theme} setTheme={setTheme} />
        <div className="flex-1 overflow-y-auto pb-20">
          <div key={nav.n} className="view-in">
            <ErrorBoundary onReset={goHome}>
              {active === 'home' ? <Today onQuickAdd={openQuick} />
                : isCategory ? (
                  <CategoryView
                    categoryId={active} tab={nav.tab} pageId={nav.pageId} query={nav.query} onQuickAdd={openQuick}
                    onTab={tab => go(active, { tab })} onOpenPage={pageId => go(active, { pageId })} onBackToPages={() => go(active, { tab: 'pages' })}
                  />
                )
                : active === 'calendar' ? <Calendar />
                : active === 'analytics' ? <Analytics />
                : active === 'pages' ? (
                  nav.pageId ? <PageView pageId={nav.pageId} onBack={() => go('pages')} /> : <PagesList onOpenPage={pageId => go('pages', { pageId })} />
                )
                : <Settings theme={theme} setTheme={setTheme} />}
            </ErrorBoundary>
          </div>
        </div>
      </main>
      <TaskEditor />
      <QuickAddModal open={quick} onClose={closeQuick} defaultCategory={isCategory ? active : undefined} />
      {search && <CommandPalette categories={categories} onClose={closeSearch} onNavigate={go} onNewTask={openQuick} onOpenTask={openTask} onOpenPage={openPage} onCycleTheme={cycleTheme} />}
      {active !== 'home' && <MiniTimer onOpen={goHome} />}
      <Toaster />
      <ReloadPrompt />
    </div>
  );
}
