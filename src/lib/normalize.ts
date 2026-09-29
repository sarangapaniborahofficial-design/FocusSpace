import type { Category, FocusLog, Habit, JournalEntry, Page, PageFile, PageLink, PageLinkKind, Priority, Recurrence, Status, Subtask, Task } from '../types';
import { richTextToPlainText, sanitizeDoc } from './richtext';
import { uid } from './utils';

/**
 * Backup files can be old, hand-edited or partially corrupt. These helpers coerce each record into
 * the shape the UI relies on (for example `task.subtasks.filter(...)` must never see `undefined`),
 * and return null for records that cannot be repaired.
 */

const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Urgent'];
const STATUSES: Status[] = ['To Do', 'In Progress', 'Submitted/Done'];
const MODES: FocusLog['mode'][] = ['focus', 'shortBreak', 'longBreak'];

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback: number) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
const dateOnly = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '');
const timeOnly = (v: unknown) => (typeof v === 'string' && /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : '');
const timestamp = (v: unknown, fallback: string) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : fallback);

const FREQS: Recurrence['freq'][] = ['daily', 'weekdays', 'weekly', 'monthly'];
function normalizeRecurrence(raw: any): Recurrence | undefined {
  if (!raw || !FREQS.includes(raw.freq)) return undefined;
  const interval = Math.min(52, Math.max(1, Math.round(num(raw.interval, 1))));
  const anchor = Math.round(num(raw.anchorDay, 0));
  return { freq: raw.freq, interval, ...(raw.freq === 'monthly' && anchor >= 1 && anchor <= 31 ? { anchorDay: anchor } : {}) };
}

export function normalizeCategory(raw: any): Category | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.name !== 'string' || !raw.name.trim()) return null;
  return { id: raw.id, name: raw.name.trim(), color: str(raw.color, '#a1a1aa'), ...(typeof raw.icon === 'string' ? { icon: raw.icon } : {}) };
}

export function normalizeTask(raw: any): Task | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.title !== 'string' || typeof raw.categoryId !== 'string') return null;
  const now = new Date().toISOString();
  const status: Status = STATUSES.includes(raw.status) ? raw.status : 'To Do';
  const estimate = num(raw.estimatedDuration, 30);
  const subtasks: Subtask[] = Array.isArray(raw.subtasks)
    ? raw.subtasks
        .filter((s: any) => s && typeof s.title === 'string')
        .map((s: any) => ({ id: str(s.id) || uid(), title: s.title as string, completed: Boolean(s.completed) }))
    : [];
  return {
    id: raw.id,
    title: raw.title,
    categoryId: raw.categoryId,
    projectTag: str(raw.projectTag),
    priority: PRIORITIES.includes(raw.priority) ? raw.priority : 'Medium',
    status,
    estimatedDuration: estimate > 0 ? Math.round(estimate) : 30,
    dueDate: dateOnly(raw.dueDate),
    dueTime: timeOnly(raw.dueTime),
    subtasks,
    notes: str(raw.notes),
    colorCode: str(raw.colorCode, '#a1a1aa'),
    createdAt: timestamp(raw.createdAt, now),
    updatedAt: timestamp(raw.updatedAt, now),
    completedAt: status === 'Submitted/Done' && typeof raw.completedAt === 'string' && !Number.isNaN(Date.parse(raw.completedAt)) ? raw.completedAt : undefined,
    ...(normalizeRecurrence(raw.recurrence) && dateOnly(raw.dueDate) ? { recurrence: normalizeRecurrence(raw.recurrence) } : {}),
    ...(typeof raw.spawnedNextId === 'string' ? { spawnedNextId: raw.spawnedNextId } : {}),
  };
}

export function normalizeHabit(raw: any): Habit | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  const completions: string[] = Array.isArray(raw.completions)
    ? Array.from(new Set<string>(raw.completions.map(dateOnly).filter(Boolean)))
    : [];
  return {
    id: raw.id,
    name: raw.name,
    color: str(raw.color, '#a1a1aa'),
    active: raw.active !== false,
    completions,
    ...(typeof raw.targetLabel === 'string' ? { targetLabel: raw.targetLabel } : {}),
  };
}

export function normalizeLog(raw: any): FocusLog | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.startedAt !== 'string' || Number.isNaN(Date.parse(raw.startedAt))) return null;
  return {
    id: raw.id,
    ...(typeof raw.taskId === 'string' ? { taskId: raw.taskId } : {}),
    startedAt: raw.startedAt,
    endedAt: timestamp(raw.endedAt, raw.startedAt),
    durationMinutes: Math.max(0, Math.round(num(raw.durationMinutes, 0))),
    mode: MODES.includes(raw.mode) ? raw.mode : 'focus',
  };
}

/** Normalizes a list, drops unrepairable records and duplicate ids. Returns the clean list and how many were skipped. */
export function normalizeList<T extends { id: string }>(raw: unknown, fn: (item: any) => T | null): { items: T[]; skipped: number } {
  const source = Array.isArray(raw) ? raw : [];
  const byId = new Map<string, T>();
  for (const item of source) {
    const clean = fn(item);
    if (clean && !byId.has(clean.id)) byId.set(clean.id, clean);
  }
  return { items: Array.from(byId.values()), skipped: source.length - byId.size };
}

export function normalizePage(raw: any): Page | null {
  if (!raw || typeof raw.id !== 'string') return null;
  const now = new Date().toISOString();
  return {
    id: raw.id,
    ...(typeof raw.categoryId === 'string' ? { categoryId: raw.categoryId } : {}),
    title: typeof raw.title === 'string' ? raw.title : 'Untitled',
    description: typeof raw.description === 'string' ? raw.description : '',
    createdAt: timestamp(raw.createdAt, now),
    updatedAt: timestamp(raw.updatedAt, now),
    ...(typeof raw.legacyMarkdown === 'string' && raw.legacyMarkdown ? { legacyMarkdown: raw.legacyMarkdown } : {}),
    ...(typeof raw.legacyConfirmedAt === 'string' && !Number.isNaN(Date.parse(raw.legacyConfirmedAt)) ? { legacyConfirmedAt: raw.legacyConfirmedAt } : {}),
  };
}

export function normalizeJournalEntry(raw: any): JournalEntry | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.pageId !== 'string' || typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null;
  const now = new Date().toISOString();
  const content = sanitizeDoc(raw.content);
  return { id: raw.id, pageId: raw.pageId, date: raw.date, content, plainText: typeof raw.plainText === 'string' ? raw.plainText : richTextToPlainText(content), createdAt: timestamp(raw.createdAt, now), updatedAt: timestamp(raw.updatedAt, now) };
}

const LINK_KINDS: PageLinkKind[] = ['task', 'habit', 'goal'];
export function normalizePageLink(raw: any): PageLink | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.pageId !== 'string' || typeof raw.targetId !== 'string' || !LINK_KINDS.includes(raw.kind)) return null;
  return { id: raw.id, pageId: raw.pageId, kind: raw.kind, targetId: raw.targetId, createdAt: timestamp(raw.createdAt, new Date().toISOString()) };
}

/** A file record from a backup: metadata plus its bytes as base64. */
export type BackupFile = PageFile & { data: string };

export function normalizeFile(raw: any): BackupFile | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.pageId !== 'string' || typeof raw.data !== 'string') return null;
  return {
    id: raw.id,
    pageId: raw.pageId,
    name: typeof raw.name === 'string' && raw.name ? raw.name : 'Untitled file',
    type: typeof raw.type === 'string' && raw.type ? raw.type : 'application/octet-stream',
    size: Math.max(0, Math.round(num(raw.size, 0))),
    createdAt: timestamp(raw.createdAt, new Date().toISOString()),
    data: raw.data,
  };
}
