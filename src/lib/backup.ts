import { db } from '../db/db';
import {
  normalizeCategory,
  normalizeTask,
  normalizeHabit,
  normalizeGoal,
  normalizeLog,
  normalizePage,
  normalizeJournalEntry,
  normalizePageLink,
  normalizeFile,
  normalizeList,
  type BackupFile,
} from './normalize';
import type { Category, FileBlob, FocusLog, Goal, Habit, JournalEntry, Page, PageFile, PageLink, Task } from '../types';
import { isoToday } from './utils';

export interface FocusSpaceBackupEnvelope {
  app: 'FocusSpace';
  version: 1;
  exportedAt: string;
  data: {
    categories: Category[];
    tasks: Task[];
    habits: Habit[];
    goals: Goal[];
    focusLogs: FocusLog[];
    pages: Page[];
    journalEntries: JournalEntry[];
    pageLinks: PageLink[];
    files: PageFile[];
    fileBlobs?: { id: string; base64: string }[];
  };
}

export interface ImportCounts {
  categories: number;
  tasks: number;
  habits: number;
  goals: number;
  focusLogs: number;
  pages: number;
  journalEntries: number;
  pageLinks: number;
  files: number;
  fileBlobs: number;
}

export interface ImportResult {
  success: boolean;
  imported: ImportCounts;
  skipped: Partial<ImportCounts>;
  error?: string;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBlob(base64: string, mimeType = 'application/octet-stream'): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Serializes the entire local database to a single JSON envelope.
 */
export async function exportFullBackup(): Promise<string> {
  const [
    categories,
    tasks,
    habits,
    goals,
    focusLogs,
    pages,
    journalEntries,
    pageLinks,
    files,
    rawBlobs,
  ] = await Promise.all([
    db.categories.toArray(),
    db.tasks.toArray(),
    db.habits.toArray(),
    db.goals.toArray(),
    db.focusLogs.toArray(),
    db.pages.toArray(),
    db.journalEntries.toArray(),
    db.pageLinks.toArray(),
    db.files.toArray(),
    db.fileBlobs.toArray(),
  ]);

  const serializedBlobs: { id: string; base64: string }[] = [];
  for (const b of rawBlobs) {
    if (b.blob) {
      const base64 = await blobToBase64(b.blob);
      serializedBlobs.push({ id: b.id, base64 });
    }
  }

  const envelope: FocusSpaceBackupEnvelope = {
    app: 'FocusSpace',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      categories,
      tasks,
      habits,
      goals,
      focusLogs,
      pages,
      journalEntries,
      pageLinks,
      files,
      fileBlobs: serializedBlobs,
    },
  };

  return JSON.stringify(envelope, null, 2);
}

/**
 * Downloads full backup JSON to user's local disk.
 */
export async function downloadBackupFile(): Promise<void> {
  const json = await exportFullBackup();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `focusspace-backup-${isoToday()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses and validates an incoming backup JSON, runs normalization across all records,
 * and executes an atomic Dexie transaction to restore the database.
 */
export async function importFullBackup(jsonString: string): Promise<ImportResult> {
  let raw: any;
  try {
    raw = JSON.parse(jsonString);
  } catch (err: any) {
    return {
      success: false,
      imported: { categories: 0, tasks: 0, habits: 0, goals: 0, focusLogs: 0, pages: 0, journalEntries: 0, pageLinks: 0, files: 0, fileBlobs: 0 },
      skipped: {},
      error: `Invalid JSON: ${err?.message || 'Syntax error'}`,
    };
  }

  if (!raw || typeof raw !== 'object' || raw.app !== 'FocusSpace' || !raw.data || typeof raw.data !== 'object') {
    return {
      success: false,
      imported: { categories: 0, tasks: 0, habits: 0, goals: 0, focusLogs: 0, pages: 0, journalEntries: 0, pageLinks: 0, files: 0, fileBlobs: 0 },
      skipped: {},
      error: 'Unrecognized backup file. Expected a FocusSpace backup envelope.',
    };
  }

  const d = raw.data;

  const cleanCategories = normalizeList(d.categories, normalizeCategory);
  const cleanTasks = normalizeList(d.tasks, normalizeTask);
  const cleanHabits = normalizeList(d.habits, normalizeHabit);
  const cleanGoals = normalizeList(d.goals, normalizeGoal);
  const cleanLogs = normalizeList(d.focusLogs, normalizeLog);
  const cleanPages = normalizeList(d.pages, normalizePage);
  const cleanJournal = normalizeList(d.journalEntries, normalizeJournalEntry);
  const cleanLinks = normalizeList(d.pageLinks, normalizePageLink);

  // Normalize files
  const cleanFiles = normalizeList(d.files, (f: any) => {
    if (!f || typeof f.id !== 'string' || typeof f.pageId !== 'string') return null;
    return {
      id: f.id,
      pageId: f.pageId,
      name: typeof f.name === 'string' && f.name ? f.name : 'Untitled file',
      type: typeof f.type === 'string' && f.type ? f.type : 'application/octet-stream',
      size: typeof f.size === 'number' && f.size >= 0 ? f.size : 0,
      createdAt: typeof f.createdAt === 'string' ? f.createdAt : new Date().toISOString(),
    } as PageFile;
  });

  // Reconstruct blobs from base64
  const cleanBlobs: FileBlob[] = [];
  let skippedBlobs = 0;
  if (Array.isArray(d.fileBlobs)) {
    for (const b of d.fileBlobs) {
      if (b && typeof b.id === 'string' && typeof b.base64 === 'string') {
        try {
          const blob = base64ToBlob(b.base64);
          cleanBlobs.push({ id: b.id, blob });
        } catch {
          skippedBlobs++;
        }
      } else {
        skippedBlobs++;
      }
    }
  }

  // Atomic restore inside transaction
  await db.transaction(
    'rw',
    [
      db.categories,
      db.tasks,
      db.habits,
      db.goals,
      db.focusLogs,
      db.pages,
      db.journalEntries,
      db.pageLinks,
      db.files,
      db.fileBlobs,
    ],
    async () => {
      await Promise.all([
        db.categories.clear(),
        db.tasks.clear(),
        db.habits.clear(),
        db.goals.clear(),
        db.focusLogs.clear(),
        db.pages.clear(),
        db.journalEntries.clear(),
        db.pageLinks.clear(),
        db.files.clear(),
        db.fileBlobs.clear(),
      ]);

      if (cleanCategories.items.length) await db.categories.bulkAdd(cleanCategories.items);
      if (cleanTasks.items.length) await db.tasks.bulkAdd(cleanTasks.items);
      if (cleanHabits.items.length) await db.habits.bulkAdd(cleanHabits.items);
      if (cleanGoals.items.length) await db.goals.bulkAdd(cleanGoals.items);
      if (cleanLogs.items.length) await db.focusLogs.bulkAdd(cleanLogs.items);
      if (cleanPages.items.length) await db.pages.bulkAdd(cleanPages.items);
      if (cleanJournal.items.length) await db.journalEntries.bulkAdd(cleanJournal.items);
      if (cleanLinks.items.length) await db.pageLinks.bulkAdd(cleanLinks.items);
      if (cleanFiles.items.length) await db.files.bulkAdd(cleanFiles.items);
      if (cleanBlobs.length) await db.fileBlobs.bulkAdd(cleanBlobs);
    }
  );

  return {
    success: true,
    imported: {
      categories: cleanCategories.items.length,
      tasks: cleanTasks.items.length,
      habits: cleanHabits.items.length,
      goals: cleanGoals.items.length,
      focusLogs: cleanLogs.items.length,
      pages: cleanPages.items.length,
      journalEntries: cleanJournal.items.length,
      pageLinks: cleanLinks.items.length,
      files: cleanFiles.items.length,
      fileBlobs: cleanBlobs.length,
    },
    skipped: {
      categories: cleanCategories.skipped,
      tasks: cleanTasks.skipped,
      habits: cleanHabits.skipped,
      goals: cleanGoals.skipped,
      focusLogs: cleanLogs.skipped,
      pages: cleanPages.skipped,
      journalEntries: cleanJournal.skipped,
      pageLinks: cleanLinks.skipped,
      files: cleanFiles.skipped,
      fileBlobs: skippedBlobs,
    },
  };
}
