import type { Priority, Task } from '../types';
import { doneDate } from './analytics';
import { addDays, daysBetween } from './utils';

const RANK: Record<Priority, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
const isOpen = (t: Task) => t.status !== 'Submitted/Done';
const toMin = (time: string) => { const [h, m] = time.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

export interface NextUp { task: Task; reason: string; }
export interface TodayPlan {
  /** Open tasks whose due date has passed, most important first. */
  overdue: Task[];
  /** Open tasks due today: timed ones by time, then the rest by priority. */
  today: Task[];
  /** Tasks finished today (including overdue ones you cleared). */
  done: Task[];
  /** Open tasks due in the next three days. */
  upcoming: Task[];
  plannedMinutes: number;
  next: NextUp | null;
}

export function pickNext(candidates: Task[], today: string, nowTime: string): NextUp | null {
  if (!candidates.length) return null;
  const nowMin = toMin(nowTime);

  // 1. Something scheduled around now (started up to 30 minutes ago, or starting within two hours).
  const soon = candidates
    .filter(t => t.dueDate === today && t.dueTime && toMin(t.dueTime) >= nowMin - 30 && toMin(t.dueTime) <= nowMin + 120)
    .sort((a, b) => a.dueTime.localeCompare(b.dueTime))[0];
  if (soon) return { task: soon, reason: toMin(soon.dueTime) <= nowMin ? `Scheduled for ${soon.dueTime}, happening now` : `Scheduled for ${soon.dueTime}` };

  // 2. Otherwise the most important thing: priority, then overdue before today, then oldest.
  const best = [...candidates].sort((a, b) =>
    RANK[a.priority] - RANK[b.priority]
    || a.dueDate.localeCompare(b.dueDate)
    || (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'))[0];
  const late = best.dueDate < today ? daysBetween(best.dueDate, today) : 0;
  if (late > 0) return { task: best, reason: `Overdue by ${late} ${late === 1 ? 'day' : 'days'}` };
  if (best.dueTime && toMin(best.dueTime) < nowMin - 30) return { task: best, reason: `Was due at ${best.dueTime}` };
  if (best.priority === 'Urgent' || best.priority === 'High') return { task: best, reason: `${best.priority} priority, due today` };
  return { task: best, reason: 'Due today' };
}

export function buildTodayPlan(tasks: Task[], today: string, nowTime: string): TodayPlan {
  const byImportance = (a: Task, b: Task) => RANK[a.priority] - RANK[b.priority] || a.dueDate.localeCompare(b.dueDate) || (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99');

  const overdue = tasks.filter(t => isOpen(t) && !!t.dueDate && t.dueDate < today).sort(byImportance);
  const dueToday = tasks
    .filter(t => isOpen(t) && t.dueDate === today)
    .sort((a, b) => {
      if (!!a.dueTime !== !!b.dueTime) return a.dueTime ? -1 : 1; // timed first
      return a.dueTime && b.dueTime ? a.dueTime.localeCompare(b.dueTime) : RANK[a.priority] - RANK[b.priority];
    });
  const done = tasks.filter(t => !isOpen(t) && doneDate(t) === today).sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt));
  const horizon = addDays(today, 3);
  const upcoming = tasks
    .filter(t => isOpen(t) && !!t.dueDate && t.dueDate > today && t.dueDate <= horizon)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'));

  return {
    overdue, today: dueToday, done, upcoming,
    plannedMinutes: [...overdue, ...dueToday].reduce((sum, t) => sum + (t.estimatedDuration || 0), 0),
    next: pickNext([...overdue, ...dueToday], today, nowTime),
  };
}
