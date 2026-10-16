import { useLiveQuery } from 'dexie-react-hooks';
import { Command } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { db, seedDatabase, withStatus } from './db/db';
import { Analytics } from './components/Analytics';
import { Calendar } from './components/Calendar';
import { CategoryView, type CategoryTab } from './components/CategoryView';
import { CommandPalette } from './components/CommandPalette';
import { Header } from './components/Header';
import { Journal } from './components/Journal';
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
import { AppDock } from './components/AppDock';
import { FloatingHUDPortal } from './components/FloatingHUD';
import { ErrorBoundary } from './components/ui';
import { OnboardingWelcome, useWelcomeFlow, type WelcomeTask, type WelcomeHabit } from './components/OnboardingWelcome';
import { openTaskEditor } from './lib/taskEditor';
import { getTimerState, timer } from './lib/timer';
import { soundscape, useSoundscape, type SoundscapeType } from './lib/soundscape';
import { initJournalAutoSave } from './lib/journalAutoSave';
import { parseTaskInput } from './lib/taskParser';
import { toggleHabitDay } from './lib/habitActions';
import { computeStreaks } from './lib/analytics';
import { checkAndNotifyOverdue } from './lib/notifications';
import { isoToday, storage, uid } from './lib/utils';
import { isTauri, isVoiceEnabled } from './lib/runtime';
import { hudBridge, type TaskSnapshot } from './lib/hudBridge';
import type { FocusLog, Habit, LayoutMode, Page, Subtask, Task, Theme } from './types';
import { useDictation } from './voice/useDictation';
import { createInputTarget } from './voice/target/inputTarget';
import type { DictationTarget } from './voice/target/DictationTarget';
import { DictationHud } from './voice/ui/DictationHud';
import { isAudioConfigured } from './voice/audioDevices';
import { AudioDeviceSetupModal } from './components/AudioDeviceSetupModal';

const STATIC_VIEWS = ['home', 'calendar', 'review', 'analytics', 'journal', 'pages', 'settings'];
const VIEW_TITLES: Record<string, string> = {
  home: 'Home',
  calendar: 'Calendar',
  review: 'Weekly Review',
  analytics: 'Analytics',
  journal: 'Daily Journal',
  pages: 'Knowledge Pages',
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

  const lastFocusedInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [globalDictationTarget, setGlobalDictationTarget] = useState<DictationTarget | null>(null);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        lastFocusedInputRef.current = e.target;
      }
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  const globalDictation = useDictation({
    target: globalDictationTarget,
  });

  const [audioSetupOpen, setAudioSetupOpen] = useState(false);

  const triggerUniversalVoice = useCallback(() => {
    if (!isVoiceEnabled()) return;
    if (!isAudioConfigured()) {
      setAudioSetupOpen(true);
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      setGlobalDictationTarget(createInputTarget(active));
      globalDictation.toggle();
    } else if (lastFocusedInputRef.current && document.body.contains(lastFocusedInputRef.current)) {
      lastFocusedInputRef.current.focus();
      setGlobalDictationTarget(createInputTarget(lastFocusedInputRef.current));
      globalDictation.toggle();
    } else {
      setQuick(true);
    }
  }, [globalDictation]);

  const categoryList = useLiveQuery(() => db.categories.toArray(), []);
  const categories = categoryList ?? [];

  const today = isoToday();
  const { welcomeOpen, welcomeVariant, completeWelcome, triggerWelcome } = useWelcomeFlow(today);
  const currentSoundscape = useSoundscape();

  const allTasks = useLiveQuery<Task[]>(() => (welcomeOpen ? db.tasks.toArray() : Promise.resolve<Task[]>([])), [welcomeOpen]) ?? [];
  const allHabits = useLiveQuery<Habit[]>(() => (welcomeOpen ? db.habits.toArray() : Promise.resolve<Habit[]>([])), [welcomeOpen]) ?? [];
  const allFocusLogs = useLiveQuery<FocusLog[]>(() => (welcomeOpen ? db.focusLogs.toArray() : Promise.resolve<FocusLog[]>([])), [welcomeOpen]) ?? [];

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
  const welcomeTasks: WelcomeTask[] = useMemo(() => {
    return allTasks.map(t => ({
      id: t.id,
      title: t.title,
      categoryName: catMap.get(t.categoryId) ?? 'General',
      projectTag: t.projectTag ?? 'Task',
      priority: t.priority,
      estimatedDuration: t.estimatedDuration || 30,
      done: t.status === 'Submitted/Done',
    }));
  }, [allTasks, catMap]);

  const welcomeHabits: WelcomeHabit[] = useMemo(() => {
    return allHabits.filter(h => h.active).map(h => {
      const { current } = computeStreaks(h.completions, today);
      return {
        id: h.id,
        name: h.name,
        color: h.color,
        streak: current,
        doneToday: h.completions.includes(today),
      };
    });
  }, [allHabits, today]);

  const focusMinutesToday = useMemo(() => {
    return allFocusLogs
      .filter(l => l.startedAt?.slice(0, 10) === today && l.mode === 'focus')
      .reduce((sum, l) => sum + (l.durationMinutes || 0), 0);
  }, [allFocusLogs, today]);

  const handleWelcomeAddTask = useCallback(async (raw: string) => {
    const parsed = parseTaskInput(raw, categories, today);
    const targetCat = categories.find(c => c.id === parsed.categoryId) ?? categories[0];
    if (!targetCat) return;
    const now = new Date().toISOString();
    const task: Task = {
      id: uid(),
      title: parsed.title,
      categoryId: targetCat.id,
      projectTag: parsed.projectTag ?? targetCat.name,
      priority: parsed.priority ?? 'Medium',
      status: 'To Do',
      estimatedDuration: parsed.estimatedDuration ?? 30,
      dueDate: parsed.dueDate ?? today,
      dueTime: parsed.dueTime ?? '',
      subtasks: [],
      notes: '',
      colorCode: targetCat.color,
      createdAt: now,
      updatedAt: now,
    };
    await db.tasks.add(task);
  }, [categories, today]);

  const handleWelcomeToggleHabit = useCallback(async (habitId: string) => {
    await toggleHabitDay(habitId, today);
  }, [today]);

  const handleWelcomeSelectSoundscape = useCallback((id: SoundscapeType) => {
    soundscape.setType(id);
  }, []);

  const handleWelcomeStartFocusTask = useCallback((taskId: string) => {
    const t = allTasks.find(x => x.id === taskId);
    if (t) {
      timer.setTask(t);
      if (!getTimerState().running) {
        timer.toggle();
      }
    }
  }, [allTasks]);

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
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      navigator.storage
        .persist()
        .then(persisted => {
          console.log(`[FocusSpace Storage] Persistent storage granted: ${persisted}`);
        })
        .catch(err => {
          console.warn('[FocusSpace Storage] Persistent storage check failed:', err);
        });
    }
  }, [boot]);

  useEffect(() => {
    const cleanup = initJournalAutoSave();
    return cleanup;
  }, []);

  // Synchronize Timer and Task State across the Floating HUD Bridge
  useEffect(() => {
    const syncState = async () => {
      const tState = getTimerState();
      let activeTaskSnapshot: TaskSnapshot | null = null;
      if (tState.taskId) {
        const t = await db.tasks.get(tState.taskId);
        if (t) {
          activeTaskSnapshot = {
            id: t.id,
            title: t.title,
            notes: t.notes,
            status: t.status,
            subtasks: t.subtasks,
          };
        }
      }
      hudBridge.send({
        type: 'STATE_SYNC',
        v: 1,
        timer: {
          mode: tState.mode,
          remainingMs: tState.remainingMs,
          totalMs: (tState.durations[tState.mode] || 25) * 60_000,
          running: tState.running,
          isOvertime: Boolean(tState.isOvertime),
          overtimeMs: tState.overtimeMs || 0,
          taskId: tState.taskId,
          taskTitle: tState.taskTitle,
        },
        activeTask: activeTaskSnapshot,
      });
    };

    const unsubTimer = timer.subscribe(() => {
      void syncState();
    });

    const unsubBridge = hudBridge.subscribe(async (msg) => {
      if (msg.type === 'REQUEST_SYNC') {
        void syncState();
      } else if (msg.type === 'TOGGLE_TIMER') {
        timer.toggle();
        void syncState();
      } else if (msg.type === 'BANK_OVERTIME') {
        timer.bankOvertime();
        void syncState();
      } else if (msg.type === 'COMPLETE_TASK') {
        const task = await db.tasks.get(msg.taskId);
        if (task) {
          await db.tasks.put(withStatus(task, 'Submitted/Done'));
          void syncState();
        }
      } else if (msg.type === 'COMPLETE_SUBTASK') {
        const task = await db.tasks.get(msg.taskId);
        if (task) {
          const updated = (task.subtasks || []).map(s =>
            s.id === msg.subtaskId ? { ...s, completed: !s.completed } : s
          );
          await db.tasks.update(task.id, { subtasks: updated, updatedAt: new Date().toISOString() });
          void syncState();
        }
      } else if (msg.type === 'ADD_SUBTASK') {
        const task = await db.tasks.get(msg.taskId);
        if (task && msg.title.trim()) {
          const newSub: Subtask = { id: uid(), title: msg.title.trim(), completed: false };
          const updated = [...(task.subtasks || []), newSub];
          await db.tasks.update(task.id, { subtasks: updated, updatedAt: new Date().toISOString() });
          void syncState();
        }
      } else if (msg.type === 'SAVE_SCRATCHPAD') {
        const task = await db.tasks.get(msg.taskId);
        if (task && msg.text.trim()) {
          const now = new Date();
          const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          const entry = `• [${timeStr}] ${msg.text.trim()}`;
          const newNotes = task.notes ? `${task.notes}\n${entry}` : entry;
          await db.tasks.update(task.id, { notes: newNotes, updatedAt: now.toISOString() });
          void syncState();
        }
      }
    });

    void syncState();

    return () => {
      unsubTimer();
      unsubBridge();
    };
  }, []);

  // Listen for Tauri backend shortcuts: Ctrl+Alt+Space (Quick Add) & Ctrl+Alt+D (Universal Voice)
  useEffect(() => {
    if (!isTauri()) return;
    let unlistenQuick: (() => void) | undefined;
    let unlistenVoice: (() => void) | undefined;

    import('@tauri-apps/api/event')
      .then(({ listen }) => {
        listen('quick-add-shortcut', () => {
          setQuick(true);
        }).then(un => {
          unlistenQuick = un;
        });

        listen('toggle-dictation-shortcut', () => {
          triggerUniversalVoice();
        }).then(un => {
          unlistenVoice = un;
        });
      })
      .catch(err => {
        console.warn('Could not register Tauri shortcut listeners:', err);
      });

    return () => {
      unlistenQuick?.();
      unlistenVoice?.();
    };
  }, [triggerUniversalVoice]);

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
      const today = isoToday();
      const overdue = await db.tasks.filter(t => t.status !== 'Submitted/Done' && !!t.dueDate && t.dueDate < today).count();
      void checkAndNotifyOverdue(overdue, today);
    };
    void run();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const isEditing = e.target instanceof Element && Boolean(e.target.closest('input,textarea,select,[contenteditable="true"]'));

      if (e.altKey && key === 'v') {
        if (!isVoiceEnabled()) return;
        e.preventDefault();
        triggerUniversalVoice();
        return;
      }
      if (mod && (e.key === '/' || e.key === '?')) {
        e.preventDefault();
        setSearch(false);
        setQuick(false);
        setShortcuts(s => !s);
        return;
      }
      if (isEditing && (key === 'n' || ['1', '2', '3', '4', '5', '6'].includes(e.key))) return;
      if (mod && key === 'n') { e.preventDefault(); setSearch(false); setShortcuts(false); setQuick(true); return; }
      if (mod && key === 'k') { e.preventDefault(); setQuick(false); setShortcuts(false); setSearch(s => !s); return; }
      if (mod && (key === 'j' || e.key === '6')) { e.preventDefault(); go('journal'); return; }
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
  }, [go, triggerUniversalVoice]);

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
        className={`w-full h-full bg-[var(--app-bg)] backdrop-blur-md text-fg flex overflow-hidden relative transition-[border-radius,box-shadow,gap,padding] duration-200 ease-out ${
          layoutMode === 'orbital'
            ? 'max-w-[1680px] mx-auto rounded-[28px] shadow-pop border border-line sm:gap-3 sm:p-3'
            : 'w-full max-w-none rounded-none border-none'
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
            <main className="flex-1 min-w-0 overflow-y-auto pb-28 sm:pb-24">
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
                    : active === 'journal' ? <Journal />
                    : active === 'pages' ? (
                      nav.pageId ? <PageView pageId={nav.pageId} onBack={() => go('pages')} /> : <PagesList onOpenPage={pageId => go('pages', { pageId })} />
                    )
                    : <Settings theme={theme} setTheme={setTheme} layoutMode={layoutMode} setLayoutMode={setLayoutMode} onReplayWelcome={() => triggerWelcome('full-daily')} />}
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
      </div>

      {/* Global Overlays, Modals, Portals, and Docks decoupled from horizontal flex flow */}
      <TaskEditor />
      <QuickAddModal open={quick} onClose={closeQuick} defaultCategory={isCategory ? active : undefined} />
      <ShortcutsModal open={shortcuts} onClose={() => setShortcuts(false)} />
      {search && <CommandPalette categories={categories} onClose={closeSearch} onNavigate={go} onNewTask={openQuick} onOpenTask={openTask} onOpenPage={openPage} onCycleTheme={cycleTheme} onOpenShortcuts={() => setShortcuts(true)} onReplayWelcome={() => triggerWelcome('full-daily')} />}
      {active !== 'home' && layoutMode !== 'cockpit' && <MiniTimer onOpen={goHome} />}
      <AppDock floating onTriggerVoice={triggerUniversalVoice} />
      {isVoiceEnabled() && (
        <>
          <DictationHud
            state={globalDictation.state}
            audioLevel={globalDictation.audioLevel}
            modelProgress={globalDictation.modelProgress}
            onStop={globalDictation.stop}
          />
          <AudioDeviceSetupModal
            isOpen={audioSetupOpen}
            onClose={() => setAudioSetupOpen(false)}
            onConfigured={() => {
              setAudioSetupOpen(false);
              triggerUniversalVoice();
            }}
          />
        </>
      )}
      <FloatingHUDPortal />
      <OnboardingWelcome
        open={welcomeOpen}
        variant={welcomeVariant}
        theme={theme as Theme}
        setTheme={t => setTheme(t)}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        onComplete={completeWelcome}
        tasks={welcomeTasks}
        habits={welcomeHabits}
        focusMinutesToday={focusMinutesToday}
        soundscape={currentSoundscape.type}
        onSelectSoundscape={handleWelcomeSelectSoundscape}
        onAddQuickTask={handleWelcomeAddTask}
        onToggleHabit={handleWelcomeToggleHabit}
        onStartFocusTask={handleWelcomeStartFocusTask}
      />
      <Toaster />
      {!isTauri() && <ReloadPrompt />}
    </div>
  );
}
