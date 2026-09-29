import type { Category, FocusLog, Habit, Task } from '../types';
import { addDays, daysBetween, parseISODate, startOfWeek, toISODate } from './utils';

/* ---------- ranges & buckets ---------- */

export type RangeId = '7d' | '30d' | '12w';

export const RANGE_OPTIONS: { id: RangeId; label: string; unit: 'day' | 'week' }[] = [
  { id: '7d', label: '7 days', unit: 'day' },
  { id: '30d', label: '30 days', unit: 'day' },
  { id: '12w', label: '12 weeks', unit: 'week' },
];

export interface Bucket {
  key: string;
  /** First and last day covered, inclusive (YYYY-MM-DD). */
  start: string;
  end: string;
  /** Short axis label and a longer description for the hover readout. */
  label: string;
  long: string;
}

const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const monthDayFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const longDayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export function buildBuckets(range: RangeId, today: string): Bucket[] {
  if (range === '12w') {
    const thisWeek = startOfWeek(today);
    return Array.from({ length: 12 }, (_, i) => {
      const start = addDays(thisWeek, (i - 11) * 7);
      const label = monthDayFmt.format(parseISODate(start));
      return { key: start, start, end: addDays(start, 6), label, long: `Week of ${label}` };
    });
  }
  const n = range === '7d' ? 7 : 30;
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(today, i - (n - 1));
    const d = parseISODate(day);
    return { key: day, start: day, end: day, label: range === '7d' ? weekdayFmt.format(d) : monthDayFmt.format(d), long: longDayFmt.format(d) };
  });
}

/* ---------- dates on records ---------- */

const localDateOf = (iso: string | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : toISODate(d);
};

/** Day a task was completed. Tasks finished before `completedAt` existed fall back to their last edit. */
export const doneDate = (t: Task) => localDateOf(t.completedAt || t.updatedAt);
export const logDate = (l: FocusLog) => localDateOf(l.endedAt || l.startedAt);
const isDone = (t: Task) => t.status === 'Submitted/Done';
const inRange = (date: string, from: string, to: string) => date !== '' && date >= from && date <= to;

/* ---------- main aggregation ---------- */

export const UNASSIGNED_ID = '__unassigned__';
const OTHER_COLOR = '#71717a';

export interface BucketStat {
  bucket: Bucket;
  completed: number;
  focusMin: number;
  byCategory: Record<string, number>;
}
export interface CategoryRow { id: string; name: string; color: string; completed: number; focusMin: number; }
export interface TaskTimeRow { task: Task; category?: Category; totalMin: number; rangeMin: number; }

export interface Analytics {
  rangeStart: string;
  rangeEnd: string;
  lengthDays: number;
  buckets: BucketStat[];
  completed: number;
  prevCompleted: number;
  focusMin: number;
  prevFocusMin: number;
  /** Tasks due inside the range (up to today) and how many of those are done. */
  dueTotal: number;
  dueDone: number;
  /** Open tasks whose due date has already passed. */
  overdue: number;
  /** Categories (plus "Other" for orphans) that completed something in range, in legend order. */
  seriesCategories: { id: string; name: string; color: string }[];
  categoryRows: CategoryRow[];
  taskRows: TaskTimeRow[];
  hasActivity: boolean;
}

export function computeAnalytics(input: {
  tasks: Task[];
  categories: Category[];
  logs: FocusLog[];
  range: RangeId;
  /** 'all' or a category id. */
  categoryId: string;
  today: string;
}): Analytics {
  const { tasks, categories, logs, range, categoryId, today } = input;

  const buckets = buildBuckets(range, today);
  const span = range === '12w' ? 7 : 1;
  const rangeStart = buckets[0].start;
  const rangeEnd = today;
  const lengthDays = daysBetween(rangeStart, rangeEnd) + 1;
  const prevStart = addDays(rangeStart, -lengthDays);
  const prevEnd = addDays(rangeStart, -1);

  const stats: BucketStat[] = buckets.map(bucket => ({ bucket, completed: 0, focusMin: 0, byCategory: {} }));
  const bucketIndex = (date: string) => {
    const i = Math.floor(daysBetween(rangeStart, date) / span);
    return i >= 0 && i < stats.length ? i : -1;
  };

  const categoryById = new Map(categories.map(c => [c.id, c]));
  const taskById = new Map(tasks.map(t => [t.id, t]));
  const scoped = categoryId === 'all' ? tasks : tasks.filter(t => t.categoryId === categoryId);

  // Completed tasks
  let completed = 0;
  let prevCompleted = 0;
  const completedByCategory = new Map<string, number>();
  for (const task of scoped) {
    if (!isDone(task)) continue;
    const date = doneDate(task);
    if (inRange(date, rangeStart, rangeEnd)) {
      completed += 1;
      completedByCategory.set(task.categoryId, (completedByCategory.get(task.categoryId) ?? 0) + 1);
      const i = bucketIndex(date);
      if (i >= 0) {
        stats[i].completed += 1;
        stats[i].byCategory[task.categoryId] = (stats[i].byCategory[task.categoryId] ?? 0) + 1;
      }
    } else if (inRange(date, prevStart, prevEnd)) {
      prevCompleted += 1;
    }
  }

  // Focus time
  let focusMin = 0;
  let prevFocusMin = 0;
  const focusByCategory = new Map<string, number>();
  const focusByTask = new Map<string, { total: number; range: number }>();
  for (const log of logs) {
    if (log.mode !== 'focus') continue;
    const task = log.taskId ? taskById.get(log.taskId) : undefined;
    if (categoryId !== 'all' && task?.categoryId !== categoryId) continue;
    const date = logDate(log);
    const minutes = Math.max(0, log.durationMinutes || 0);
    if (task) {
      const entry = focusByTask.get(task.id) ?? { total: 0, range: 0 };
      entry.total += minutes;
      if (inRange(date, rangeStart, rangeEnd)) entry.range += minutes;
      focusByTask.set(task.id, entry);
    }
    if (inRange(date, rangeStart, rangeEnd)) {
      focusMin += minutes;
      const key = task ? task.categoryId : UNASSIGNED_ID;
      focusByCategory.set(key, (focusByCategory.get(key) ?? 0) + minutes);
      const i = bucketIndex(date);
      if (i >= 0) stats[i].focusMin += minutes;
    } else if (inRange(date, prevStart, prevEnd)) {
      prevFocusMin += minutes;
    }
  }

  // Due / overdue
  let dueTotal = 0;
  let dueDone = 0;
  let overdue = 0;
  for (const task of scoped) {
    if (inRange(task.dueDate, rangeStart, rangeEnd)) {
      dueTotal += 1;
      if (isDone(task)) dueDone += 1;
    }
    if (!isDone(task) && task.dueDate && task.dueDate < today) overdue += 1;
  }

  // Legend / series (only categories that actually completed something)
  const seriesIds = new Set<string>();
  stats.forEach(s => Object.keys(s.byCategory).forEach(id => seriesIds.add(id)));
  const seriesCategories = [
    ...categories.filter(c => seriesIds.has(c.id)).map(c => ({ id: c.id, name: c.name, color: c.color })),
    ...Array.from(seriesIds).filter(id => !categoryById.has(id)).map(id => ({ id, name: 'Other', color: OTHER_COLOR })),
  ];

  // Category breakdown
  const rowCategories = categoryId === 'all' ? categories : categories.filter(c => c.id === categoryId);
  const categoryRows: CategoryRow[] = rowCategories
    .map(c => ({ id: c.id, name: c.name, color: c.color, completed: completedByCategory.get(c.id) ?? 0, focusMin: focusByCategory.get(c.id) ?? 0 }))
    .filter(r => r.completed > 0 || r.focusMin > 0);
  const unassigned = focusByCategory.get(UNASSIGNED_ID) ?? 0;
  if (categoryId === 'all' && unassigned > 0) {
    categoryRows.push({ id: UNASSIGNED_ID, name: 'No task attached', color: OTHER_COLOR, completed: 0, focusMin: unassigned });
  }
  categoryRows.sort((a, b) => b.focusMin - a.focusMin || b.completed - a.completed);

  // Estimate vs actual
  const taskRows: TaskTimeRow[] = [];
  for (const [id, entry] of focusByTask) {
    if (entry.range <= 0) continue;
    const task = taskById.get(id);
    if (task) taskRows.push({ task, category: categoryById.get(task.categoryId), totalMin: entry.total, rangeMin: entry.range });
  }
  taskRows.sort((a, b) => b.rangeMin - a.rangeMin);

  return {
    rangeStart, rangeEnd, lengthDays, buckets: stats,
    completed, prevCompleted, focusMin, prevFocusMin,
    dueTotal, dueDone, overdue,
    seriesCategories, categoryRows, taskRows: taskRows.slice(0, 6),
    hasActivity: completed > 0 || focusMin > 0,
  };
}

/* ---------- habits ---------- */

export interface HabitStat {
  habit: Habit;
  current: number;
  best: number;
  doneToday: boolean;
  /** Share of the last 30 days (including today) with a check-in, 0..1. */
  rate30: number;
  /** Oldest to newest, ending today. */
  last14: boolean[];
}

/**
 * `current` counts consecutive days ending today, or ending yesterday if today isn't checked off yet,
 * so a streak isn't shown as broken until a full day has actually been missed.
 */
export function computeStreaks(completions: string[], today: string) {
  const days = new Set(completions);
  let current = 0;
  let cursor = days.has(today) ? today : addDays(today, -1);
  while (days.has(cursor)) { current += 1; cursor = addDays(cursor, -1); }

  let best = 0;
  let run = 0;
  let prev = '';
  for (const day of Array.from(days).sort()) {
    run = prev && daysBetween(prev, day) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return { current, best };
}

export function habitStats(habits: Habit[], today: string): HabitStat[] {
  return habits
    .filter(h => h.active)
    .map(habit => {
      const days = new Set(habit.completions);
      const { current, best } = computeStreaks(habit.completions, today);
      const windowStart = addDays(today, -29);
      let hits = 0;
      for (const d of days) if (inRange(d, windowStart, today)) hits += 1;
      const last14 = Array.from({ length: 14 }, (_, i) => days.has(addDays(today, i - 13)));
      return { habit, current, best, doneToday: days.has(today), rate30: hits / 30, last14 };
    });
}

/* ---------- this week vs goals ---------- */

export interface WeekProgress {
  start: string;
  daysLeft: number;
  tasksDone: number;
  focusMin: number;
  checkins: number;
  /** Active habits x 7 days. */
  habitTarget: number;
}

export function weekProgress(tasks: Task[], logs: FocusLog[], habits: Habit[], today: string): WeekProgress {
  const start = startOfWeek(today);
  const tasksDone = tasks.filter(t => isDone(t) && inRange(doneDate(t), start, today)).length;
  const focusMin = logs
    .filter(l => l.mode === 'focus' && inRange(logDate(l), start, today))
    .reduce((sum, l) => sum + Math.max(0, l.durationMinutes || 0), 0);
  const active = habits.filter(h => h.active);
  const checkins = active.reduce((sum, h) => sum + new Set(h.completions.filter(d => inRange(d, start, today))).size, 0);
  return { start, daysLeft: Math.max(0, 6 - daysBetween(start, today)), tasksDone, focusMin, checkins, habitTarget: active.length * 7 };
}

/* ---------- one habit's history ---------- */

export interface HabitHistory {
  /** `weeks` columns of 7 days each (week start first), oldest column first. */
  weeks: { date: string; done: boolean; future: boolean }[][];
  current: number;
  best: number;
  total: number;
  thisWeek: number;
  lastWeek: number;
  rate30: number;
  rate90: number;
}

export function habitHistory(habit: Habit, today: string, weekCount = 12): HabitHistory {
  const days = new Set(habit.completions);
  const thisWeekStart = startOfWeek(today);
  const first = addDays(thisWeekStart, -(weekCount - 1) * 7);
  const weeks = Array.from({ length: weekCount }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => { const date = addDays(first, w * 7 + d); return { date, done: days.has(date), future: date > today }; }));
  const count = (from: string, to: string) => { let n = 0; for (const d of days) if (inRange(d, from, to)) n += 1; return n; };
  const { current, best } = computeStreaks(habit.completions, today);
  return {
    weeks, current, best, total: days.size,
    thisWeek: count(thisWeekStart, today),
    lastWeek: count(addDays(thisWeekStart, -7), addDays(thisWeekStart, -1)),
    rate30: count(addDays(today, -29), today) / 30,
    rate90: count(addDays(today, -89), today) / 90,
  };
}
