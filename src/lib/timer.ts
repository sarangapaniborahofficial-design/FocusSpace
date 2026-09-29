import { useSyncExternalStore } from 'react';
import { db } from '../db/db';
import type { FocusLog, Task } from '../types';
import { toast } from './toast';
import { formatDuration, storage, uid } from './utils';

/**
 * Pomodoro engine.
 *
 * It lives outside React so the timer keeps running while you move between views, and it is driven
 * by a wall-clock deadline (`endsAt`) rather than by counting ticks, so background-tab throttling or a
 * sleeping laptop can't make it drift. Focus time is logged exactly once per session: on completion,
 * or as a partial log when a session is reset, switched away from, or re-attached to another task.
 */

export type Mode = 'focus' | 'shortBreak' | 'longBreak';
export type Durations = Record<Mode, number>;

export const MODES: Mode[] = ['focus', 'shortBreak', 'longBreak'];
export const MODE_LABELS: Record<Mode, string> = { focus: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' };
export const DEFAULT_DURATIONS: Durations = { focus: 25, shortBreak: 5, longBreak: 15 };
export const DURATIONS_KEY = 'focusspace-pomodoro-durations';
export const SESSIONS_PER_CYCLE = 4;

const SOUND_KEY = 'focusspace-timer-sound';
const BASE_TITLE = 'FocusSpace';

export const validMinutes = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 && n <= 240 ? Math.round(n) : fallback;
};

export function loadDurations(): Durations {
  try {
    const raw = storage.get(DURATIONS_KEY);
    if (!raw) return { ...DEFAULT_DURATIONS };
    const parsed = JSON.parse(raw) as Partial<Durations>;
    return {
      focus: validMinutes(parsed.focus, DEFAULT_DURATIONS.focus),
      shortBreak: validMinutes(parsed.shortBreak, DEFAULT_DURATIONS.shortBreak),
      longBreak: validMinutes(parsed.longBreak, DEFAULT_DURATIONS.longBreak),
    };
  } catch {
    return { ...DEFAULT_DURATIONS };
  }
}

export const isSoundOn = () => storage.get(SOUND_KEY) !== 'off';
export const setSoundOn = (on: boolean) => storage.set(SOUND_KEY, on ? 'on' : 'off');

export interface TimerState {
  mode: Mode;
  durations: Durations;
  running: boolean;
  /** Time left in ms. While running it is refreshed about once a second from `endsAt`. */
  remainingMs: number;
  /** Wall-clock deadline (epoch ms) while running, otherwise null. */
  endsAt: number | null;
  /** ISO time the current session was first started; null while nothing has been started. */
  startedAt: string | null;
  taskId?: string;
  taskTitle?: string;
  /** Focus sessions finished since the last long break. */
  cycle: number;
}

const initialDurations = loadDurations();
let state: TimerState = {
  mode: 'focus',
  durations: initialDurations,
  running: false,
  remainingMs: initialDurations.focus * 60_000,
  endsAt: null,
  startedAt: null,
  cycle: 0,
};

const listeners = new Set<() => void>();
let ticker: number | undefined;
let guardOn = false;

const pad = (n: number) => String(n).padStart(2, '0');
export const formatClock = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};

const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };

function commit(next: TimerState) {
  state = next;

  if (state.running && ticker === undefined) ticker = window.setInterval(tick, 250);
  if (!state.running && ticker !== undefined) { window.clearInterval(ticker); ticker = undefined; }

  document.title = state.running ? `${formatClock(state.remainingMs)} · ${MODE_LABELS[state.mode]} — ${BASE_TITLE}` : BASE_TITLE;

  // Ask before a reload/close throws away a running focus session.
  const guard = state.running && state.mode === 'focus';
  if (guard && !guardOn) { window.addEventListener('beforeunload', onBeforeUnload); guardOn = true; }
  if (!guard && guardOn) { window.removeEventListener('beforeunload', onBeforeUnload); guardOn = false; }

  listeners.forEach(listener => listener());
}

function tick() {
  if (!state.running || state.endsAt === null) return;
  const remaining = Math.max(0, state.endsAt - Date.now());
  if (remaining === 0) { complete(); return; }
  if (Math.ceil(remaining / 1000) !== Math.ceil(state.remainingMs / 1000)) commit({ ...state, remainingMs: remaining });
}

const fresh = (s: TimerState, mode: Mode = s.mode): TimerState => ({
  ...s,
  mode,
  running: false,
  endsAt: null,
  remainingMs: s.durations[mode] * 60_000,
  startedAt: null,
});

function workedMs(s: TimerState) {
  const total = s.durations[s.mode] * 60_000;
  const left = s.running && s.endsAt !== null ? Math.max(0, s.endsAt - Date.now()) : s.remainingMs;
  return Math.min(total, Math.max(0, total - left));
}

function saveFocusLog(minutes: number, startedAt: string, taskId?: string) {
  const log: FocusLog = {
    id: uid(),
    ...(taskId ? { taskId } : {}),
    startedAt,
    endedAt: new Date().toISOString(),
    durationMinutes: minutes,
    mode: 'focus',
  };
  db.focusLogs.add(log).catch(() => toast('Could not save that focus session to local storage.', 'error'));
}

/** Logs the focus time worked so far in an unfinished session. Returns the minutes saved (0 if under a minute). */
function flushPartial(): number {
  if (state.mode !== 'focus' || !state.startedAt) return 0;
  const minutes = Math.round(workedMs(state) / 60_000);
  if (minutes < 1) return 0;
  saveFocusLog(minutes, state.startedAt, state.taskId);
  return minutes;
}

const announceSaved = (minutes: number) => { if (minutes) toast(`Saved ${formatDuration(minutes)} of focus time`, 'success'); };

function playChime() {
  if (!isSoundOn()) return;
  try {
    const Ctx: typeof AudioContext | undefined = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const start = ctx.currentTime;
    [660, 880].forEach((frequency, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = start + i * 0.2;
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.15, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.45);
    });
    window.setTimeout(() => { void ctx.close(); }, 1200);
  } catch {
    /* audio is optional */
  }
}

function complete() {
  let cycle = state.cycle;
  let next: Mode;
  let message: string;

  if (state.mode === 'focus') {
    const minutes = state.durations.focus;
    saveFocusLog(minutes, state.startedAt ?? new Date(Date.now() - minutes * 60_000).toISOString(), state.taskId);
    cycle += 1;
    const long = cycle >= SESSIONS_PER_CYCLE;
    next = long ? 'longBreak' : 'shortBreak';
    message = `Focus session done: ${formatDuration(minutes)} logged. Time for a ${long ? 'long' : 'short'} break.`;
  } else {
    if (state.mode === 'longBreak') cycle = 0;
    next = 'focus';
    message = 'Break over. Ready for the next focus session?';
  }

  commit({ ...fresh(state, next), cycle });
  playChime();
  toast(message, 'success', { duration: 6500 });
}

export const timer = {
  toggle() {
    if (state.running) {
      const remaining = Math.max(0, (state.endsAt ?? Date.now()) - Date.now());
      commit({ ...state, running: false, endsAt: null, remainingMs: remaining });
      return;
    }
    const remainingMs = state.remainingMs > 0 ? state.remainingMs : state.durations[state.mode] * 60_000;
    commit({ ...state, running: true, remainingMs, endsAt: Date.now() + remainingMs, startedAt: state.startedAt ?? new Date().toISOString() });
  },

  reset() {
    const saved = flushPartial();
    commit(fresh(state));
    announceSaved(saved);
  },

  setMode(mode: Mode) {
    if (mode === state.mode) return;
    const saved = flushPartial();
    commit(fresh(state, mode));
    announceSaved(saved);
  },

  nextMode() {
    timer.setMode(MODES[(MODES.indexOf(state.mode) + 1) % MODES.length]);
  },

  /** Attach (or, with no argument, detach) a task. Time worked so far is saved to the task it was spent on. */
  setTask(task?: Pick<Task, 'id' | 'title'>) {
    if (task?.id === state.taskId) return;
    let next = state;
    let saved = 0;
    if (state.mode === 'focus' && state.startedAt) {
      saved = flushPartial();
      next = fresh(state);
    }
    commit({ ...next, taskId: task?.id, taskTitle: task?.title });
    announceSaved(saved);
  },

  applyDurations(input: Durations, persist = true) {
    const saved = flushPartial();
    const clean: Durations = {
      focus: validMinutes(input.focus, state.durations.focus),
      shortBreak: validMinutes(input.shortBreak, state.durations.shortBreak),
      longBreak: validMinutes(input.longBreak, state.durations.longBreak),
    };
    if (persist) storage.set(DURATIONS_KEY, JSON.stringify(clean));
    commit(fresh({ ...state, durations: clean }));
    announceSaved(saved);
  },

  /** Re-read durations from storage (after a backup import or "reset timer defaults"). */
  reloadDurations() {
    timer.applyDurations(loadDurations(), false);
  },
};

/** Attach a task to the timer from anywhere in the app. */
export function focusOnTask(task: Pick<Task, 'id' | 'title'>) {
  timer.setTask(task);
  if (!state.running && state.mode !== 'focus') timer.setMode('focus');
  toast(`Timer ready for “${task.title}”`, 'info');
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const snapshot = () => state;

export const getTimerState = snapshot;
export const useTimer = () => useSyncExternalStore(subscribe, snapshot, snapshot);
