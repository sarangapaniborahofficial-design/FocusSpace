import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Columns3,
  Flame,
  Headphones,
  Layers,
  Orbit,
  Play,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import type { LayoutMode, Priority, Theme } from '../types';
import type { SoundscapeType } from '../lib/soundscape';

export type WelcomeVariant = 'full-daily' | 'quick-return';

export interface WelcomeTask {
  id: string;
  title: string;
  categoryName: string;
  projectTag: string;
  priority: Priority;
  estimatedDuration: number;
  done: boolean;
}

export interface WelcomeHabit {
  id: string;
  name: string;
  color: string;
  streak: number;
  doneToday: boolean;
}

export const WELCOME_DATE_KEY = 'focusspace-last-welcome-date';
export const WELCOME_EVER_KEY = 'focusspace-onboarding-completed';
export const WELCOME_SESSION_KEY = 'focusspace-session-welcomed';

const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* ignore storage errors */
    }
  },
};

export function isoTodayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function formatMinutes(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

/**
 * Hook to manage the daily welcome sequence state in App.tsx.
 * - First login of the day (local YYYY-MM-DD !== saved date): opens the full 3-slide journey ('full-daily').
 * - Subsequent logins on the same day (new tab/window session): opens the compact 1-slide re-entry card ('quick-return').
 * - Same-tab reload: skips automatically so mid-work refreshes never interrupt flow.
 */
export function useWelcomeFlow(today: string = isoTodayLocal()) {
  const [open, setOpen] = useState<boolean>(() => {
    const lastDate = safeStorage.get(WELCOME_DATE_KEY);
    if (lastDate !== today) return true;
    try {
      return window.sessionStorage.getItem(WELCOME_SESSION_KEY) !== '1';
    } catch {
      return false;
    }
  });

  const [variant, setVariant] = useState<WelcomeVariant>(() => {
    const lastDate = safeStorage.get(WELCOME_DATE_KEY);
    return lastDate !== today ? 'full-daily' : 'quick-return';
  });

  const completeWelcome = useCallback(() => {
    safeStorage.set(WELCOME_DATE_KEY, today);
    safeStorage.set(WELCOME_EVER_KEY, 'true');
    try {
      window.sessionStorage.setItem(WELCOME_SESSION_KEY, '1');
    } catch {
      /* ignore sessionStorage errors */
    }
    setOpen(false);
  }, [today]);

  const triggerWelcome = useCallback((mode: WelcomeVariant = 'full-daily') => {
    setVariant(mode);
    setOpen(true);
  }, []);

  return {
    welcomeOpen: open,
    welcomeVariant: variant,
    setWelcomeVariant: setVariant,
    completeWelcome,
    triggerWelcome,
  };
}

const THEME_CARDS: {
  id: Theme;
  name: string;
  tag: string;
  swatch: string;
  desc: string;
}[] = [
  {
    id: 'nocturne',
    name: 'Nocturne Solaris',
    tag: 'DARK // ANODIZED',
    swatch: '#ff5526',
    desc: 'Pitch-black dot matrix, warm stone borders & Braun vermilion',
  },
  {
    id: 'onyx',
    name: 'Swiss Onyx',
    tag: 'DARK // GRID',
    swatch: '#a3e635',
    desc: 'Pitch-black architectural grid, brutalist shadows & acid citron',
  },
  {
    id: 'solaris',
    name: 'Solaris',
    tag: 'LIGHT // ANALOG',
    swatch: '#e04f26',
    desc: 'Warm tactile drafting paper, vermilion orange & botanical sage',
  },
  {
    id: 'bauhaus',
    name: 'Swiss Brutal',
    tag: 'LIGHT // EDITORIAL',
    swatch: '#c8ff29',
    desc: 'High-contrast ink grid, hard offset shadows & acid citron',
  },
];

const SOUNDSCAPE_OPTIONS: { id: SoundscapeType; label: string; desc: string }[] = [
  { id: 'off', label: 'Off', desc: 'Pure silence' },
  { id: 'brown', label: 'Brown Noise', desc: 'Warm low-pass rumble' },
  { id: 'rain', label: 'Analog Rain', desc: 'Soft procedural rainfall' },
  { id: 'binaural', label: 'Binaural 14Hz', desc: 'Alpha wave focus drone' },
];

function ProgressRing({
  value,
  size = 38,
  stroke = 4,
  label,
  accentColor,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  accentColor: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={accentColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          className="transition-all duration-500"
        />
      </svg>
      {label && <span className="absolute text-[10px] font-mono font-bold">{label}</span>}
    </div>
  );
}

export interface OnboardingWelcomeProps {
  open: boolean;
  variant?: WelcomeVariant;
  theme: Theme;
  setTheme: (t: Theme) => void;
  layoutMode: LayoutMode;
  setLayoutMode: (m: LayoutMode) => void;
  onComplete: () => void;
  tasks?: WelcomeTask[];
  habits?: WelcomeHabit[];
  focusMinutesToday?: number;
  soundscape?: SoundscapeType;
  onSelectSoundscape?: (id: SoundscapeType) => void;
  onAddQuickTask?: (rawInput: string) => void;
  onToggleHabit?: (habitId: string) => void;
  onStartFocusTask?: (taskId: string) => void;
}

export function OnboardingWelcome({
  open,
  variant: initialVariant = 'full-daily',
  theme,
  setTheme,
  layoutMode,
  setLayoutMode,
  onComplete,
  tasks = [],
  habits = [],
  focusMinutesToday = 0,
  soundscape = 'brown',
  onSelectSoundscape,
  onAddQuickTask,
  onToggleHabit,
  onStartFocusTask,
}: OnboardingWelcomeProps) {
  const [mode, setMode] = useState<WelcomeVariant>(initialVariant);
  const [slide, setSlide] = useState<0 | 1 | 2>(0);
  const [morphingOut, setMorphingOut] = useState(false);
  const [captureInput, setCaptureInput] = useState('');

  useEffect(() => {
    if (open) {
      setMode(initialVariant);
      setSlide(0);
      setMorphingOut(false);
    }
  }, [open, initialVariant]);

  const openTasks = useMemo(() => tasks.filter(t => !t.done), [tasks]);
  const doneTasks = useMemo(() => tasks.filter(t => t.done), [tasks]);
  const totalCount = tasks.length;
  const completionPct = totalCount > 0 ? Math.round((doneTasks.length / totalCount) * 100) : 0;
  const plannedMinutes = useMemo(
    () => openTasks.reduce((sum, t) => sum + (t.estimatedDuration || 30), 0),
    [openTasks]
  );
  const habitsDone = useMemo(() => habits.filter(h => h.doneToday).length, [habits]);
  const nextTask = openTasks[0] ?? null;

  const triggerExitMorph = useCallback(
    (startTaskId?: string) => {
      if (morphingOut) return;
      setMorphingOut(true);
      if (startTaskId && onStartFocusTask) {
        onStartFocusTask(startTaskId);
      }
      window.setTimeout(() => {
        onComplete();
      }, 340);
    },
    [morphingOut, onComplete, onStartFocusTask]
  );

  // Keyboard navigation: Right/Enter/Space advances, Left goes back, Esc skips
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (e.key === 'Escape') {
        e.preventDefault();
        triggerExitMorph();
        return;
      }
      if (inInput) return;

      if (mode === 'quick-return') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          triggerExitMorph();
        }
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (slide < 2) setSlide(s => (s + 1) as 0 | 1 | 2);
        else triggerExitMorph();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (slide > 0) setSlide(s => (s - 1) as 0 | 1 | 2);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, mode, slide, triggerExitMorph]);

  const handleInlineAddTask = () => {
    const raw = captureInput.trim();
    if (!raw) return;
    onAddQuickTask?.(raw);
    setCaptureInput('');
  };

  if (!open) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const formattedDate = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const palette = {
    nocturne: {
      surface: '#0d0c0b',
      surface2: '#151311',
      line: '#2a2622',
      lineStrong: '#453e37',
      fg: '#f4efe6',
      muted: '#9e9485',
      subtle: '#6e665b',
      accent: '#ff5526',
      accentFg: '#ffffff',
      accentText: '#ff6e45',
      shadow: '4px 4px 0px #000000',
    },
    onyx: {
      surface: '#0a0c0a',
      surface2: '#111411',
      line: '#2a312a',
      lineStrong: '#a3e635',
      fg: '#f4f7f0',
      muted: '#909a8a',
      subtle: '#626b5d',
      accent: '#a3e635',
      accentFg: '#050705',
      accentText: '#a3e635',
      shadow: '4px 4px 0px #000000',
    },
    solaris: {
      surface: '#fffdf9',
      surface2: '#f6f1e7',
      line: '#dcd3c2',
      lineStrong: '#bfb39d',
      fg: '#161412',
      muted: '#5c554b',
      subtle: '#7d7467',
      accent: '#e04f26',
      accentFg: '#ffffff',
      accentText: '#bf3b16',
      shadow: '3px 3px 0px #cfc4b0',
    },
    bauhaus: {
      surface: '#ffffff',
      surface2: '#f2f4ee',
      line: '#141614',
      lineStrong: '#000000',
      fg: '#0d0f0d',
      muted: '#454c45',
      subtle: '#636b63',
      accent: '#c8ff29',
      accentFg: '#0d0f0d',
      accentText: '#2d4700',
      shadow: '4px 4px 0px #141614',
    },
  }[theme];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to FocusSpace"
      style={{ color: palette.fg }}
      className={`fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        morphingOut
          ? 'opacity-0 scale-[1.04] -translate-y-2 blur-md pointer-events-none'
          : 'opacity-100 scale-100 translate-y-0 blur-none'
      }`}
    >
      {/* ====================================================================
          MODE B: SUBSEQUENT LOGINS SAME DAY ("QUICK RETURN" 1-SLIDE CARD)
          ==================================================================== */}
      {mode === 'quick-return' ? (
        <div
          style={{
            backgroundColor: palette.surface,
            borderColor: palette.line,
            boxShadow: palette.shadow,
          }}
          className="w-full max-w-xl rounded-3xl border-2 p-6 sm:p-8 overflow-hidden relative transition-all animate-[fadeIn_0.24s_ease-out]"
        >
          <div
            style={{ borderColor: palette.line }}
            className="flex items-center justify-between gap-3 pb-4 border-b"
          >
            <div className="flex items-center gap-2">
              <span
                style={{ backgroundColor: palette.accent }}
                className="size-2 rounded-full animate-pulse"
              />
              <span
                style={{ color: palette.muted }}
                className="font-mono text-[10px] tracking-widest uppercase"
              >
                QUICK RETURN // {formattedDate}
              </span>
            </div>
            <button
              onClick={() => {
                setMode('full-daily');
                setSlide(0);
              }}
              style={{ color: palette.accentText }}
              className="text-xs font-mono hover:underline cursor-pointer"
            >
              View Full 3-Slide Tour →
            </button>
          </div>

          <div className="mt-6">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {greeting}. Ready for your next block?
            </h1>
            <p style={{ color: palette.muted }} className="text-sm mt-1.5">
              Your local vault is synced and ready. Here is where your day stands right now:
            </p>
          </div>

          {/* 3-Cell Live Pulse Strip */}
          <div className="grid grid-cols-3 gap-3 my-6">
            <div
              style={{ backgroundColor: palette.surface2, borderColor: palette.line }}
              className="p-3.5 rounded-2xl border flex items-center gap-3"
            >
              <ProgressRing
                value={completionPct / 100}
                size={38}
                stroke={4}
                label={`${completionPct}%`}
                accentColor={palette.accent}
              />
              <div>
                <div className="text-base font-bold font-mono tabular-nums">
                  {doneTasks.length}/{totalCount}
                </div>
                <div
                  style={{ color: palette.subtle }}
                  className="text-[10px] font-mono uppercase"
                >
                  Tasks Done
                </div>
              </div>
            </div>

            <div
              style={{ backgroundColor: palette.surface2, borderColor: palette.line }}
              className="p-3.5 rounded-2xl border"
            >
              <div style={{ color: palette.subtle }} className="text-[10px] font-mono uppercase">
                Focus Logged
              </div>
              <div className="text-base font-bold font-mono tabular-nums mt-1">
                {focusMinutesToday > 0
                  ? formatMinutes(focusMinutesToday)
                  : formatMinutes(plannedMinutes)}
              </div>
              <div style={{ color: palette.muted }} className="text-[10px] font-mono">
                {focusMinutesToday > 0 ? 'today' : 'planned left'}
              </div>
            </div>

            <div
              style={{ backgroundColor: palette.surface2, borderColor: palette.line }}
              className="p-3.5 rounded-2xl border"
            >
              <div style={{ color: palette.subtle }} className="text-[10px] font-mono uppercase">
                Daily Habits
              </div>
              <div className="text-base font-bold font-mono tabular-nums mt-1">
                {habitsDone}/{habits.length}
              </div>
              <div style={{ color: palette.muted }} className="text-[10px] font-mono">
                checked in
              </div>
            </div>
          </div>

          {/* Next Task Up Spotlight */}
          {nextTask && (
            <div
              style={{ backgroundColor: palette.surface2, borderColor: palette.lineStrong }}
              className="p-4 rounded-2xl border mb-6 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div
                  style={{ color: palette.accentText }}
                  className="font-mono text-[10px] tracking-widest uppercase font-semibold"
                >
                  DO THIS NEXT · {nextTask.priority.toUpperCase()} PRIORITY
                </div>
                <div className="font-semibold text-base truncate mt-1">{nextTask.title}</div>
              </div>
              <button
                onClick={() => triggerExitMorph(nextTask.id)}
                style={{ backgroundColor: palette.accent, color: palette.accentFg }}
                className="h-9 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer keycap"
              >
                <Play size={13} fill="currentColor" /> Focus Now
              </button>
            </div>
          )}

          <div
            style={{ borderColor: palette.line }}
            className="flex items-center justify-between gap-3 pt-4 border-t"
          >
            <span style={{ color: palette.subtle }} className="text-xs font-mono">
              Press{' '}
              <kbd
                style={{ backgroundColor: palette.surface2, borderColor: palette.line }}
                className="px-1.5 py-0.5 rounded border"
              >
                Enter
              </kbd>{' '}
              or{' '}
              <kbd
                style={{ backgroundColor: palette.surface2, borderColor: palette.line }}
                className="px-1.5 py-0.5 rounded border"
              >
                Space
              </kbd>
            </span>
            <button
              onClick={() => triggerExitMorph()}
              style={{ backgroundColor: palette.accent, color: palette.accentFg }}
              className="h-10 px-5 rounded-xl text-sm font-semibold flex items-center gap-2 cursor-pointer keycap"
            >
              <span>Resume Workspace</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      ) : (
        /* ====================================================================
           MODE A: FIRST LOGIN OF THE DAY (FULL 3-SLIDE FLOWY JOURNEY)
           ==================================================================== */
        <div
          style={{
            backgroundColor: palette.surface,
            borderColor: palette.line,
            boxShadow: palette.shadow,
          }}
          className="w-full max-w-4xl rounded-3xl border-2 overflow-hidden flex flex-col max-h-[92vh] transition-all"
        >
          {/* Top Telemetry Bar */}
          <div
            style={{ backgroundColor: palette.surface2, borderColor: palette.line }}
            className="px-6 py-4 border-b flex items-center justify-between gap-3 shrink-0"
          >
            <div className="flex items-center gap-2.5">
              <span
                style={{ backgroundColor: palette.accent, color: palette.accentFg }}
                className="size-8 rounded-xl grid place-items-center keycap"
              >
                <Sparkles size={16} />
              </span>
              <div>
                <div
                  style={{ color: palette.accentText }}
                  className="font-mono text-[10px] tracking-widest uppercase font-semibold"
                >
                  SLIDE 0{slide + 1} / 03 //{' '}
                  {slide === 0
                    ? 'WELCOME & CALIBRATION'
                    : slide === 1
                    ? 'WHAT TO DO TODAY'
                    : 'RITUALS & REVIEW'}
                </div>
                <div style={{ color: palette.muted }} className="text-xs">
                  {formattedDate} · First session of the day
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode('quick-return')}
                style={{ backgroundColor: palette.surface, borderColor: palette.line, color: palette.muted }}
                className="hidden sm:inline-flex items-center h-8 px-2.5 rounded-lg border text-xs font-mono cursor-pointer hover:bg-hover"
                title="Switch to compact 1-slide view"
              >
                Compact View
              </button>
              <button
                onClick={() => triggerExitMorph()}
                style={{ backgroundColor: palette.surface, borderColor: palette.line, color: palette.muted }}
                className="h-8 px-3 rounded-lg border text-xs font-mono cursor-pointer hover:bg-hover"
              >
                Skip <span className="opacity-60 ml-1">Esc</span>
              </button>
            </div>
          </div>

          {/* Slide Body with Smooth Entrance Animation */}
          <div key={slide} className="p-6 sm:p-8 overflow-y-auto flex-1 animate-[fadeIn_0.24s_cubic-bezier(0.16,1,0.3,1)]">
            {/* ---------------- SLIDE 1: WELCOME & PHILOSOPHY ---------------- */}
            {slide === 0 && (
              <div className="space-y-6">
                <div className="max-w-2xl">
                  <div
                    style={{ backgroundColor: palette.surface2, borderColor: palette.line, color: palette.muted }}
                    className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-mono mb-3"
                  >
                    <ShieldCheck size={14} className="text-emerald-500" />
                    <span>100% LOCAL-FIRST VAULT · ZERO TELEMETRY · OFFLINE READY</span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                    {greeting}. Welcome to{' '}
                    <span style={{ color: palette.accentText }} className="italic font-serif font-normal">
                      FocusSpace.
                    </span>
                  </h1>
                  <p style={{ color: palette.muted }} className="text-sm sm:text-base mt-2 leading-relaxed">
                    Your personal command hub for deep work, time-blocking, and daily reflection. Everything you write, schedule, and track stays strictly on this device.
                  </p>
                </div>

                {/* Live Theme Calibration Grid */}
                <div>
                  <div
                    style={{ color: palette.subtle }}
                    className="font-mono text-[10px] tracking-widest uppercase mb-2.5"
                  >
                    01 // CHOOSE YOUR AESTHETIC PERSONA
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {THEME_CARDS.map(t => {
                      const active = theme === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setTheme(t.id)}
                          style={{
                            backgroundColor: active ? palette.surface2 : palette.surface,
                            borderColor: active ? palette.accent : palette.line,
                          }}
                          className="text-left p-4 rounded-2xl border-2 transition-all flex flex-col justify-between cursor-pointer keycap"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span
                                style={{ color: palette.subtle }}
                                className="font-mono text-[9px] tracking-widest uppercase"
                              >
                                {t.tag}
                              </span>
                              <span
                                className="size-4 rounded-full border border-black/20 shrink-0"
                                style={{ backgroundColor: t.swatch }}
                              />
                            </div>
                            <div className="font-bold text-sm mt-2">{t.name}</div>
                            <p style={{ color: palette.muted }} className="text-xs mt-1 leading-snug">
                              {t.desc}
                            </p>
                          </div>
                          <div
                            style={{ borderColor: palette.line }}
                            className="mt-3 pt-2 border-t flex items-center justify-between text-[11px] font-mono"
                          >
                            <span style={{ color: active ? palette.accentText : palette.subtle }}>
                              {active ? '● Active Theme' : 'Select'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Spatial Layout Selector */}
                <div>
                  <div
                    style={{ color: palette.subtle }}
                    className="font-mono text-[10px] tracking-widest uppercase mb-2.5"
                  >
                    02 // CHOOSE YOUR WORKSPACE ERGONOMICS
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => setLayoutMode('orbital')}
                      style={{
                        backgroundColor: layoutMode === 'orbital' ? palette.surface2 : palette.surface,
                        borderColor: layoutMode === 'orbital' ? palette.accent : palette.line,
                      }}
                      className="text-left p-4 rounded-2xl border-2 transition flex items-start gap-3.5 cursor-pointer keycap"
                    >
                      <span
                        style={{ backgroundColor: palette.surface2, color: palette.accentText }}
                        className="size-9 rounded-xl grid place-items-center shrink-0"
                      >
                        <Orbit size={18} />
                      </span>
                      <div>
                        <div className="font-semibold text-sm">Floating Layout</div>
                        <p style={{ color: palette.muted }} className="text-xs mt-0.5">
                          Detached cards over your patterned backdrop with a compact floating mini-timer.
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => setLayoutMode('cockpit')}
                      style={{
                        backgroundColor: layoutMode === 'cockpit' ? palette.surface2 : palette.surface,
                        borderColor: layoutMode === 'cockpit' ? palette.accent : palette.line,
                      }}
                      className="text-left p-4 rounded-2xl border-2 transition flex items-start gap-3.5 cursor-pointer keycap"
                    >
                      <span
                        style={{ backgroundColor: palette.surface2, color: palette.accentText }}
                        className="size-9 rounded-xl grid place-items-center shrink-0"
                      >
                        <Columns3 size={18} />
                      </span>
                      <div>
                        <div className="font-semibold text-sm">Split View (Docked Timer)</div>
                        <p style={{ color: palette.muted }} className="text-xs mt-0.5">
                          Edge-to-edge studio workbench keeping the Pomodoro dial permanently docked on the right.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- SLIDE 2: WHAT TO DO (EXECUTION PILLARS) ---------------- */}
            {slide === 1 && (
              <div className="space-y-6">
                <div>
                  <div
                    style={{ color: palette.accentText }}
                    className="font-mono text-[10px] tracking-widest uppercase mb-1"
                  >
                    PILLAR 02 // EXECUTION & FLOW
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    What deserves your attention today?
                  </h2>
                  <p style={{ color: palette.muted }} className="text-sm mt-1">
                    Capture tasks in one line using natural language, optimize your schedule, and launch straight into your apps.
                  </p>
                </div>

                {/* Live Inline Task Capture right inside Slide 2 */}
                <div
                  style={{ backgroundColor: palette.surface2, borderColor: palette.lineStrong }}
                  className="p-4 rounded-2xl border space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Zap size={13} style={{ color: palette.accentText }} /> Try Quick Capture right now:
                    </span>
                    <span style={{ color: palette.subtle }} className="font-mono text-[11px]">
                      Supports @category #tag !priority ~duration
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={captureInput}
                      onChange={e => setCaptureInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleInlineAddTask();
                        }
                      }}
                      placeholder="e.g. Finish problem set @academics #CS101 !high ~60m"
                      style={{ backgroundColor: palette.surface, borderColor: palette.line }}
                      className="flex-1 h-10 rounded-xl border px-3.5 text-sm outline-none"
                    />
                    <button
                      onClick={handleInlineAddTask}
                      disabled={!captureInput.trim()}
                      style={{ backgroundColor: palette.accent, color: palette.accentFg }}
                      className="h-10 px-4 rounded-xl text-xs font-semibold disabled:opacity-40 shrink-0 cursor-pointer keycap"
                    >
                      + Add to Today
                    </button>
                  </div>
                </div>

                {/* 3 Core Execution Pillars */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div
                    style={{ backgroundColor: palette.surface2, borderColor: palette.line }}
                    className="p-4 rounded-2xl border space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        style={{ color: palette.accentText }}
                        className="font-mono text-[10px] tracking-widest uppercase"
                      >
                        01 // TODAY&apos;S QUEUE
                      </span>
                      <Clock3 size={15} style={{ color: palette.muted }} />
                    </div>
                    <div className="text-xl font-bold font-mono">
                      {openTasks.length} Open · {formatMinutes(plannedMinutes)}
                    </div>
                    <p style={{ color: palette.muted }} className="text-xs leading-relaxed">
                      {nextTask
                        ? `Recommended starter: “${nextTask.title}” (${nextTask.priority} priority).`
                        : 'Your queue is wide open. Add a task above to lock in your first block.'}
                    </p>
                  </div>

                  <div
                    style={{ backgroundColor: palette.surface2, borderColor: palette.line }}
                    className="p-4 rounded-2xl border space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        style={{ color: palette.accentText }}
                        className="font-mono text-[10px] tracking-widest uppercase"
                      >
                        02 // SMART SCHEDULER
                      </span>
                      <Layers size={15} style={{ color: palette.muted }} />
                    </div>
                    <div className="text-base font-bold">Chronobiology Pacing</div>
                    <p style={{ color: palette.muted }} className="text-xs leading-relaxed">
                      Slots a ≤15m Quick Win first for momentum, places Deep Work in peak hours, and adds post-meeting buffers.
                    </p>
                  </div>

                  <div
                    style={{ backgroundColor: palette.surface2, borderColor: palette.line }}
                    className="p-4 rounded-2xl border space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        style={{ color: palette.accentText }}
                        className="font-mono text-[10px] tracking-widest uppercase"
                      >
                        03 // APP LAUNCHPAD
                      </span>
                      <Rocket size={15} style={{ color: palette.muted }} />
                    </div>
                    <div className="text-base font-bold">1-Click Focus &amp; Launch</div>
                    <p style={{ color: palette.muted }} className="text-xs leading-relaxed">
                      Jump straight into VS Code, Cursor, Obsidian, Spotify, Discord, or GitHub from any task or `Ctrl + K`.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- SLIDE 3: REVIEW, HABITS & SOUNDSCAPE ---------------- */}
            {slide === 2 && (
              <div className="space-y-6">
                <div>
                  <div
                    style={{ color: palette.accentText }}
                    className="font-mono text-[10px] tracking-widest uppercase mb-1"
                  >
                    PILLAR 03 // RITUALS, AUDIO &amp; REFLECTION
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Set your rhythm before you begin.
                  </h2>
                  <p style={{ color: palette.muted }} className="text-sm mt-1">
                    Check off morning habits, pre-select your offline focus soundscape, and review your daily reflection loop.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Interactive Morning Habit Check-In */}
                  <div
                    style={{ backgroundColor: palette.surface2, borderColor: palette.line }}
                    className="p-4 rounded-2xl border space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm flex items-center gap-2">
                        <Target size={15} style={{ color: palette.accentText }} /> Daily Habits (
                        {habitsDone}/{habits.length})
                      </span>
                      <span
                        style={{ color: palette.subtle }}
                        className="font-mono text-[10px] tracking-widest uppercase"
                      >
                        TAP TO CHECK IN
                      </span>
                    </div>
                    <div className="space-y-2">
                      {habits.map(h => (
                        <button
                          key={h.id}
                          onClick={() => onToggleHabit?.(h.id)}
                          style={{
                            backgroundColor: palette.surface,
                            borderColor: h.doneToday ? palette.accent : palette.line,
                          }}
                          className="w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer keycap"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="size-7 rounded-lg grid place-items-center shrink-0"
                              style={{
                                background: h.doneToday ? h.color : `${h.color}25`,
                                color: h.doneToday ? '#090b10' : h.color,
                              }}
                            >
                              {h.doneToday ? <Check size={14} strokeWidth={2.5} /> : <Circle size={13} />}
                            </span>
                            <span className="text-xs font-semibold truncate">{h.name}</span>
                          </div>
                          {h.streak > 0 && (
                            <span
                              style={{ color: palette.muted }}
                              className="text-[11px] font-mono flex items-center gap-1"
                            >
                              <Flame size={11} className="text-amber-500" /> {h.streak}d
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Offline Focus Soundscape Pre-Selector & Evening Reflection Preview */}
                  <div className="space-y-4">
                    <div
                      style={{ backgroundColor: palette.surface2, borderColor: palette.line }}
                      className="p-4 rounded-2xl border space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm flex items-center gap-2">
                          <Headphones size={15} style={{ color: palette.accentText }} /> Focus Soundscape (100% Offline)
                        </span>
                        <span
                          style={{ color: palette.subtle }}
                          className="font-mono text-[10px] tracking-widest uppercase"
                        >
                          WEB AUDIO SYNTH
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {SOUNDSCAPE_OPTIONS.map(s => {
                          const active = soundscape === s.id;
                          return (
                            <button
                              key={s.id}
                              onClick={() => onSelectSoundscape?.(s.id)}
                              style={{
                                backgroundColor: active ? palette.accent : palette.surface,
                                color: active ? palette.accentFg : palette.fg,
                                borderColor: active ? palette.accent : palette.line,
                              }}
                              className="p-2.5 rounded-xl border text-left transition cursor-pointer keycap"
                            >
                              <div className="text-xs font-semibold">{s.label}</div>
                              <div className="text-[10px] mt-0.5 truncate opacity-80">{s.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div
                      style={{ backgroundColor: palette.surface2, borderColor: palette.line }}
                      className="p-4 rounded-2xl border"
                    >
                      <div
                        style={{ color: palette.accentText }}
                        className="font-mono text-[10px] tracking-widest uppercase"
                      >
                        EVENING LOOP // AUTO-REFLECTION
                      </div>
                      <div className="font-semibold text-sm mt-1">
                        Daily Journal &amp; 11:59 PM Auto-Save
                      </div>
                      <p style={{ color: palette.muted }} className="text-xs mt-1 leading-relaxed">
                        At the end of the day, your completed tasks, focus hours, and habit streaks are automatically logged to your Journal.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Navigation Bar */}
          <div
            style={{ backgroundColor: palette.surface2, borderColor: palette.line }}
            className="px-6 py-4 border-t flex items-center justify-between gap-4 shrink-0"
          >
            <button
              onClick={() => slide > 0 && setSlide(s => (s - 1) as 0 | 1 | 2)}
              disabled={slide === 0}
              style={{ backgroundColor: palette.surface, borderColor: palette.line }}
              className="h-10 px-4 rounded-xl border text-xs font-semibold flex items-center gap-1.5 disabled:opacity-30 cursor-pointer keycap"
            >
              <ArrowLeft size={14} /> Back
            </button>

            {/* Step Indicator Pills */}
            <div className="flex items-center gap-2" role="tablist" aria-label="Onboarding steps">
              {[0, 1, 2].map(i => (
                <button
                  key={i}
                  onClick={() => setSlide(i as 0 | 1 | 2)}
                  aria-label={`Go to slide ${i + 1}`}
                  style={{
                    backgroundColor: slide === i ? palette.accent : palette.lineStrong,
                  }}
                  className={`h-2.5 rounded-full transition-all cursor-pointer ${
                    slide === i ? 'w-8' : 'w-2.5'
                  }`}
                />
              ))}
            </div>

            {slide < 2 ? (
              <button
                onClick={() => setSlide(s => (s + 1) as 0 | 1 | 2)}
                style={{ backgroundColor: palette.accent, color: palette.accentFg }}
                className="h-10 px-5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer keycap"
              >
                <span>Next</span>
                <ArrowRight size={15} />
              </button>
            ) : (
              <button
                onClick={() => triggerExitMorph()}
                style={{ backgroundColor: palette.accent, color: palette.accentFg }}
                className="h-10 px-6 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer keycap"
              >
                <CheckCircle2 size={16} />
                <span>Enter FocusSpace</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
