import type { Recurrence, Task } from '../types';
import { addDays, daysBetween, parseISODate, toISODate } from './utils';

/* ---------- next due date ---------- */

const daysInMonth = (year: number, month0: number) => new Date(year, month0 + 1, 0).getDate();

function addMonths(date: string, months: number, anchorDay?: number) {
  const d = parseISODate(date);
  const total = d.getFullYear() * 12 + d.getMonth() + months;
  const year = Math.floor(total / 12);
  const month0 = total % 12;
  const day = Math.min(anchorDay ?? d.getDate(), daysInMonth(year, month0));
  return toISODate(new Date(year, month0, day, 12));
}

function step(rule: Recurrence, date: string): string {
  switch (rule.freq) {
    case 'daily': return addDays(date, rule.interval);
    case 'weekly': return addDays(date, 7 * rule.interval);
    case 'monthly': return addMonths(date, rule.interval, rule.anchorDay);
    case 'weekdays': {
      let next = addDays(date, 1);
      while ([0, 6].includes(parseISODate(next).getDay())) next = addDays(next, 1);
      return next;
    }
  }
}

/**
 * The next occurrence: the first one after the task's due date that is also strictly after today.
 * Finishing a daily task three days late gives tomorrow, not an instantly-overdue yesterday, and finishing
 * a future task early gives the occurrence after its due date. Jumps by whole periods first (so a task left
 * overdue for years doesn't require thousands of single-day steps), then steps the rest of the way one period
 * at a time so short months and weekday-skipping stay exact.
 */
export function nextDueDate(rule: Recurrence, dueDate: string, today: string): string {
  const floor = dueDate > today ? dueDate : today;

  if (rule.freq !== 'weekdays') {
    // Non-calendar-shaped periods (days, weeks) can be skipped by direct arithmetic.
    const periodDays = rule.freq === 'daily' ? rule.interval : rule.freq === 'weekly' ? 7 * rule.interval : null;
    if (periodDays !== null) {
      const behind = daysBetween(dueDate, floor);
      const periodsBehind = Math.max(0, Math.floor(behind / periodDays));
      let d = periodsBehind > 0 ? addDays(dueDate, periodsBehind * periodDays) : dueDate;
      while (d <= floor) d = step(rule, d);
      return d;
    }
    if (rule.freq === 'monthly') {
      // Estimate how many month-steps are needed, then correct by single steps (handles anchor-day clamping).
      const start = parseISODate(dueDate);
      const end = parseISODate(floor);
      const roughMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      const periodsBehind = Math.max(0, Math.floor(roughMonths / rule.interval) - 1);
      let d = periodsBehind > 0 ? addMonths(dueDate, periodsBehind * rule.interval, rule.anchorDay) : dueDate;
      while (d <= floor) d = step(rule, d);
      return d;
    }
  }

  // Weekdays-only has no fixed period length, but at most 5 calendar days pass per step, so this stays bounded.
  let d = dueDate;
  while (d <= floor) d = step(rule, d);
  return d;
}

/* ---------- presets used by the editor ---------- */

export type RepeatPreset = 'none' | 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly';
export const REPEAT_OPTIONS: { id: RepeatPreset; label: string }[] = [
  { id: 'none', label: 'Does not repeat' },
  { id: 'daily', label: 'Every day' },
  { id: 'weekdays', label: 'Every weekday (Mon to Fri)' },
  { id: 'weekly', label: 'Every week' },
  { id: 'biweekly', label: 'Every 2 weeks' },
  { id: 'monthly', label: 'Every month' },
];

export function presetOf(rule: Recurrence | undefined): RepeatPreset {
  if (!rule) return 'none';
  if (rule.freq === 'daily' && rule.interval === 1) return 'daily';
  if (rule.freq === 'weekdays') return 'weekdays';
  if (rule.freq === 'weekly' && rule.interval === 1) return 'weekly';
  if (rule.freq === 'weekly' && rule.interval === 2) return 'biweekly';
  if (rule.freq === 'monthly' && rule.interval === 1) return 'monthly';
  return 'none'; // custom rules from a backup are kept as-is until the user picks a preset
}

/** Builds the stored rule for a preset. Recurrence needs a due date to count from. */
export function ruleFromPreset(preset: RepeatPreset, dueDate: string, existing?: Recurrence): Recurrence | undefined {
  if (preset === 'none' || !dueDate) return undefined;
  if (existing && presetOf(existing) === preset) return existing; // keep e.g. a monthly anchor day
  switch (preset) {
    case 'daily': return { freq: 'daily', interval: 1 };
    case 'weekdays': return { freq: 'weekdays', interval: 1 };
    case 'weekly': return { freq: 'weekly', interval: 1 };
    case 'biweekly': return { freq: 'weekly', interval: 2 };
    case 'monthly': return { freq: 'monthly', interval: 1, anchorDay: parseISODate(dueDate).getDate() };
  }
}

export function describeRecurrence(rule: Recurrence): string {
  const n = rule.interval;
  switch (rule.freq) {
    case 'daily': return n === 1 ? 'Every day' : `Every ${n} days`;
    case 'weekdays': return 'Every weekday';
    case 'weekly': return n === 1 ? 'Every week' : `Every ${n} weeks`;
    case 'monthly': return n === 1 ? 'Every month' : `Every ${n} months`;
  }
}

/* ---------- the task created when a recurring task is completed ---------- */

export function buildNextInstance(done: Task, today: string, now: string, newId: string, newSubtaskId: () => string): Task | null {
  if (!done.recurrence || !done.dueDate) return null;
  return {
    ...done,
    id: newId,
    status: 'To Do',
    completedAt: undefined,
    spawnedNextId: undefined,
    dueDate: nextDueDate(done.recurrence, done.dueDate, today),
    subtasks: done.subtasks.map(s => ({ ...s, id: newSubtaskId(), completed: false })),
    createdAt: now,
    updatedAt: now,
  };
}
