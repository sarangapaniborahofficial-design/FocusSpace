import Dexie, { type Table } from 'dexie';
import type { Category, FileBlob, FocusLog, Habit, JournalEntry, Page, PageFile, PageLink, Status, Task } from '../types';
import { migratePageToV3 } from '../lib/migrateV3';
import { uid, isoToday } from '../lib/utils';

class FocusSpaceDB extends Dexie {
  tasks!: Table<Task, string>; categories!: Table<Category, string>; habits!: Table<Habit, string>; focusLogs!: Table<FocusLog, string>;
  pages!: Table<Page, string>; files!: Table<PageFile, string>; fileBlobs!: Table<FileBlob, string>;
  journalEntries!: Table<JournalEntry, string>; pageLinks!: Table<PageLink, string>;
  constructor() {
    super('FocusSpaceDB');
    const v1 = { tasks: 'id, categoryId, status, priority, dueDate, dueTime, projectTag', categories: 'id, name', habits: 'id, active', focusLogs: 'id, taskId, startedAt, mode' };
    this.version(1).stores(v1);
    // v2 adds category pages and their attached files (existing data is untouched).
    const v2 = { ...v1, pages: 'id, categoryId, updatedAt', files: 'id, pageId', fileBlobs: 'id' };
    this.version(2).stores(v2);
    /**
     * v3 turns each page from a single Markdown note into a dashboard + chronological journal:
     * - `pages` gains `description` and drops `content` (a category becomes optional, and a page
     *   is no longer required to belong to one).
     * - `journalEntries` (one per page per day) holds the actual writing, as rich-text JSON.
     * - `pageLinks` references tasks/habits/goals a page is about, without copying them.
     * Existing pages are migrated, not discarded: each one keeps its title and category, and its old
     * Markdown text becomes a first journal entry (dated to when it was last edited) — converted to
     * rich text, but also kept verbatim on the page as `legacyMarkdown` until confirmed. A page with no
     * text yet gets an empty journal and no legacy banner.
     */
    this.version(3).stores({ ...v2, pages: 'id, categoryId, updatedAt', journalEntries: 'id, pageId, date, [pageId+date]', pageLinks: 'id, pageId, targetId' }).upgrade(async tx => {
      const legacyPages = await tx.table('pages').toArray();
      for (const legacy of legacyPages as (Page & { content?: string })[]) {
        // The transformation itself (Markdown -> rich text, what becomes the first journal entry) is a
        // pure function in lib/migrateV3.ts, unit-tested there; this loop is just the Dexie plumbing.
        const { pagePatch, entry } = migratePageToV3(legacy, uid);
        // The old `content` field is left in place rather than deleted (Dexie's handling of an explicit
        // `undefined` value in `update()` isn't worth relying on); the new code never reads it again.
        await tx.table('pages').update(legacy.id, pagePatch);
        if (entry) await tx.table('journalEntries').add(entry);
      }
    });
  }
}
export const db = new FocusSpaceDB();

/**
 * Returns a copy of the task with a new status. Keeps `completedAt` in step so analytics can tell
 * *when* something was finished rather than when it was last edited.
 */
export function withStatus(task: Task, status: Status): Task {
  const now = new Date().toISOString();
  return {
    ...task,
    status,
    completedAt: status === 'Submitted/Done' ? (task.completedAt ?? now) : undefined,
    updatedAt: now,
  };
}

export async function seedDatabase() {
  // Cheap early exit for the common case (already seeded).
  if (await db.categories.count()) return;
  const categories: Category[] = [
    { id: 'academics', name: 'Academics', color: '#60a5fa' },
    { id: 'fitness', name: 'Fitness', color: '#34d399' },
    { id: 'career', name: 'Career', color: '#a78bfa' },
    { id: 'personal', name: 'Personal', color: '#f59e0b' },
    { id: 'projects', name: 'Side Projects', color: '#f472b6' },
  ];
  const today = isoToday();
  const tasks: Task[] = [
    { id: uid(), title: 'Finish Data Structures problem set', categoryId: 'academics', projectTag: 'CS101', priority: 'High', status: 'In Progress', estimatedDuration: 90, dueDate: today, dueTime: '18:00', subtasks: [{id: uid(), title: 'Trees', completed: true}, {id: uid(), title: 'Graphs', completed: false}], notes: 'Review complexity before submission.', colorCode: '#60a5fa', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: uid(), title: 'Zone 2 run', categoryId: 'fitness', projectTag: 'Running', priority: 'Medium', status: 'To Do', estimatedDuration: 50, dueDate: today, dueTime: '07:00', subtasks: [], notes: '', colorCode: '#34d399', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: uid(), title: 'Build dashboard shell', categoryId: 'projects', projectTag: 'FocusSpace', priority: 'Urgent', status: 'In Progress', estimatedDuration: 120, dueDate: today, dueTime: '20:00', subtasks: [{id: uid(), title: 'Sidebar', completed: true}, {id: uid(), title: 'Task cards', completed: false}], notes: '', colorCode: '#f472b6', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];
  const habits: Habit[] = [
    { id: uid(), name: 'Morning movement', color: '#34d399', active: true, completions: [], targetLabel: '20 min' },
    { id: uid(), name: 'Read / study', color: '#60a5fa', active: true, completions: [], targetLabel: '20 min' },
    { id: uid(), name: 'Review flashcards', color: '#a78bfa', active: true, completions: [], targetLabel: '10 min' },
  ];
  // Re-check inside the transaction: React StrictMode runs startup effects twice in dev, and two
  // concurrent first-run seeds must not collide on the fixed category ids.
  await db.transaction('rw', db.categories, db.tasks, db.habits, async () => {
    if (await db.categories.count()) return;
    await db.categories.bulkAdd(categories); await db.tasks.bulkAdd(tasks); await db.habits.bulkAdd(habits);
  });
}
