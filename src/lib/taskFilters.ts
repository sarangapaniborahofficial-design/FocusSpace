import type { Priority, Status, Task } from '../types';
import { addDays } from './utils';

export interface TaskFilters {
  status: 'all' | 'open' | Status;
  priority: 'all' | Priority;
  due: 'any' | 'overdue' | 'today' | 'week' | 'none';
  /** '' = any tag */
  tag: string;
}
export const NO_FILTERS: TaskFilters = { status: 'all', priority: 'all', due: 'any', tag: '' };

export const countActiveFilters = (f: TaskFilters) =>
  (f.status !== 'all' ? 1 : 0) + (f.priority !== 'all' ? 1 : 0) + (f.due !== 'any' ? 1 : 0) + (f.tag ? 1 : 0);

export function applyFilters(tasks: Task[], f: TaskFilters, today: string): Task[] {
  const weekEnd = addDays(today, 6);
  return tasks.filter(t => {
    const done = t.status === 'Submitted/Done';
    if (f.status === 'open' && done) return false;
    if (f.status !== 'all' && f.status !== 'open' && t.status !== f.status) return false;
    if (f.priority !== 'all' && t.priority !== f.priority) return false;
    if (f.tag && (t.projectTag ?? '').trim() !== f.tag) return false;
    switch (f.due) {
      case 'overdue': return !done && !!t.dueDate && t.dueDate < today;
      case 'today': return t.dueDate === today;
      case 'week': return !!t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd;
      case 'none': return !t.dueDate;
      default: return true;
    }
  });
}

export type SortKey = 'dueDate' | 'priority' | 'title' | 'updated';
const RANK: Record<Priority, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

export function sortTasks(tasks: Task[], key: SortKey): Task[] {
  const dateKey = (t: Task) => `${t.dueDate || '9999-99-99'}${t.dueTime || '99:99'}`;
  return [...tasks].sort((a, b) => {
    switch (key) {
      case 'priority': return RANK[a.priority] - RANK[b.priority] || dateKey(a).localeCompare(dateKey(b));
      case 'title': return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      case 'updated': return b.updatedAt.localeCompare(a.updatedAt);
      default: return dateKey(a).localeCompare(dateKey(b)) || RANK[a.priority] - RANK[b.priority];
    }
  });
}
