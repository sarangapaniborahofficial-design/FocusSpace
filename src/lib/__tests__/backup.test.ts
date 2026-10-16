import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db/db';
import {
  exportFullBackup,
  importFullBackup,
  blobToBase64,
  base64ToBlob,
  type FocusSpaceBackupEnvelope,
} from '../backup';
import type { Category, FocusLog, Goal, Habit, JournalEntry, Page, PageFile, PageLink, Task } from '../../types';
import { storage } from '../utils';

describe('FocusSpace Data Vault: Backup & Restore Engine', () => {
  beforeEach(async () => {
    // Clear all tables before each test
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
  });

  it('exports an empty database as a valid FocusSpace envelope', async () => {
    const json = await exportFullBackup();
    const parsed = JSON.parse(json) as FocusSpaceBackupEnvelope;

    expect(parsed.app).toBe('FocusSpace');
    expect(parsed.version).toBe(1);
    expect(typeof parsed.exportedAt).toBe('string');
    expect(parsed.data.categories).toEqual([]);
    expect(parsed.data.tasks).toEqual([]);
    expect(parsed.data.habits).toEqual([]);
    expect(parsed.data.goals).toEqual([]);
    expect(parsed.data.focusLogs).toEqual([]);
    expect(parsed.data.pages).toEqual([]);
    expect(parsed.data.journalEntries).toEqual([]);
    expect(parsed.data.pageLinks).toEqual([]);
    expect(parsed.data.files).toEqual([]);
    expect(parsed.data.fileBlobs).toEqual([]);
  });

  it('executes a lossless round-trip export and restore on real application data', async () => {
    const sampleCategory: Category = {
      id: 'cat-projects',
      name: 'Client Projects',
      color: '#3b82f6',
      icon: 'FolderKanban',
      launchLinks: [{ id: 'l1', label: 'VS Code', url: 'vscode://' }],
    };

    const sampleTask: Task = {
      id: 'task-101',
      title: 'Implement Data Vault backup engine',
      categoryId: 'cat-projects',
      projectTag: 'FocusSpace',
      priority: 'Urgent',
      status: 'In Progress',
      estimatedDuration: 45,
      dueDate: '2026-10-16',
      dueTime: '15:00',
      subtasks: [
        { id: 'sub-1', title: 'Write exporter', completed: true },
        { id: 'sub-2', title: 'Write importer', completed: true },
      ],
      notes: 'Ensure 100% offline local-first privacy',
      colorCode: '#3b82f6',
      createdAt: '2026-10-16T08:00:00.000Z',
      updatedAt: '2026-10-16T08:30:00.000Z',
      order: 1,
      launchLinks: [{ id: 'tlink-1', label: 'GitHub', url: 'https://github.com' }],
    };

    const sampleHabit: Habit = {
      id: 'habit-water',
      name: 'Hydration 2L',
      color: '#06b6d4',
      active: true,
      completions: ['2026-10-14', '2026-10-15', '2026-10-16'],
      targetLabel: 'Daily health',
    };

    const sampleGoal: Goal = {
      id: 'goal-focus',
      categoryId: 'cat-projects',
      title: 'Complete Sprint 4 milestones',
      metricLabel: 'Tasks',
      currentValue: 8,
      targetValue: 10,
      goalType: 'tasks-completed',
      deadline: '2026-10-31',
      createdAt: '2026-10-16T08:00:00.000Z',
      updatedAt: '2026-10-16T08:00:00.000Z',
    };

    const sampleLog: FocusLog = {
      id: 'log-501',
      taskId: 'task-101',
      startedAt: '2026-10-16T09:00:00.000Z',
      endedAt: '2026-10-16T09:25:00.000Z',
      durationMinutes: 25,
      mode: 'focus',
    };

    const samplePage: Page = {
      id: 'page-arch',
      categoryId: 'cat-projects',
      title: 'Tauri Architecture Notes',
      description: 'Desktop shell and IPC bridge notes',
      createdAt: '2026-10-16T08:00:00.000Z',
      updatedAt: '2026-10-16T08:00:00.000Z',
    };

    const sampleJournal: JournalEntry = {
      id: 'entry-2026-10-16',
      pageId: 'page-arch',
      date: '2026-10-16',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sprint readiness review verified.' }] }] },
      plainText: 'Sprint readiness review verified.',
      createdAt: '2026-10-16T08:00:00.000Z',
      updatedAt: '2026-10-16T08:00:00.000Z',
    };

    const sampleLink: PageLink = {
      id: 'link-p1',
      pageId: 'page-arch',
      kind: 'task',
      targetId: 'task-101',
      createdAt: '2026-10-16T08:00:00.000Z',
    };

    const sampleFile: PageFile = {
      id: 'file-spec',
      pageId: 'page-arch',
      name: 'spec.txt',
      type: 'text/plain',
      size: 14,
      createdAt: '2026-10-16T08:00:00.000Z',
    };

    const blobContent = 'FocusSpace binary test file';
    const sampleBlob = new Blob([blobContent], { type: 'text/plain' });

    // Seed database
    await db.categories.add(sampleCategory);
    await db.tasks.add(sampleTask);
    await db.habits.add(sampleHabit);
    await db.goals.add(sampleGoal);
    await db.focusLogs.add(sampleLog);
    await db.pages.add(samplePage);
    await db.journalEntries.add(sampleJournal);
    await db.pageLinks.add(sampleLink);
    await db.files.add(sampleFile);
    await db.fileBlobs.add({ id: 'file-spec', blob: sampleBlob });

    // Export backup
    const backupJson = await exportFullBackup();
    expect(backupJson).toContain('Implement Data Vault backup engine');
    expect(backupJson).toContain('FocusSpace');

    // Completely wipe all database tables to simulate clean reinstall or migration
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

    expect(await db.tasks.count()).toBe(0);
    expect(await db.categories.count()).toBe(0);

    // Restore from backup
    const result = await importFullBackup(backupJson);
    expect(result.success).toBe(true);
    expect(result.imported.categories).toBe(1);
    expect(result.imported.tasks).toBe(1);
    expect(result.imported.habits).toBe(1);
    expect(result.imported.goals).toBe(1);
    expect(result.imported.focusLogs).toBe(1);
    expect(result.imported.pages).toBe(1);
    expect(result.imported.journalEntries).toBe(1);
    expect(result.imported.pageLinks).toBe(1);
    expect(result.imported.files).toBe(1);
    expect(result.imported.fileBlobs).toBe(1);

    // Verify restored records in Dexie
    const restoredCategory = await db.categories.get('cat-projects');
    expect(restoredCategory).toEqual(sampleCategory);

    const restoredTask = await db.tasks.get('task-101');
    expect(restoredTask?.title).toBe(sampleTask.title);
    expect(restoredTask?.subtasks).toHaveLength(2);
    expect(restoredTask?.launchLinks).toEqual(sampleTask.launchLinks);

    const restoredHabit = await db.habits.get('habit-water');
    expect(restoredHabit?.completions).toEqual(sampleHabit.completions);

    const restoredGoal = await db.goals.get('goal-focus');
    expect(restoredGoal?.title).toBe(sampleGoal.title);
    expect(restoredGoal?.targetValue).toBe(10);

    const restoredBlobRecord = await db.fileBlobs.get('file-spec');
    expect(restoredBlobRecord).toBeDefined();
    const restoredText = await restoredBlobRecord!.blob.text();
    expect(restoredText).toBe(blobContent);
  });

  it('rejects malformed or non-FocusSpace backup payloads gracefully', async () => {
    const invalidJson = '{ not json }';
    const res1 = await importFullBackup(invalidJson);
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('Invalid JSON');

    const wrongAppJson = JSON.stringify({ app: 'NotFocusSpace', version: 1, data: {} });
    const res2 = await importFullBackup(wrongAppJson);
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('Expected a FocusSpace backup envelope');
  });

  it('sanitizes partially corrupt records and reports skipped counts during import', async () => {
    const dirtyBackup = {
      app: 'FocusSpace',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        categories: [
          { id: 'c1', name: 'Work' },
          null,
          { id: 'c2', name: '   ' }, // invalid empty name
        ],
        tasks: [
          { id: 't1', title: 'Task 1', categoryId: 'c1', priority: 'High', status: 'To Do', estimatedDuration: 25 },
          { id: 123 }, // invalid non-string id
        ],
        habits: [],
        goals: [
          { id: 'g1', title: 'Goal 1', targetValue: 50 },
          { invalid: 'goal' },
        ],
        focusLogs: [],
        pages: [],
        journalEntries: [],
        pageLinks: [],
        files: [],
        fileBlobs: [],
      },
    };

    const result = await importFullBackup(JSON.stringify(dirtyBackup));
    expect(result.success).toBe(true);
    expect(result.imported.categories).toBe(1);
    expect(result.skipped.categories).toBe(2);
    expect(result.imported.tasks).toBe(1);
    expect(result.skipped.tasks).toBe(1);
    expect(result.imported.goals).toBe(1);
    expect(result.skipped.goals).toBe(1);

    expect(await db.categories.count()).toBe(1);
    expect(await db.tasks.count()).toBe(1);
  });

  it('correctly encodes and decodes base64 blobs', async () => {
    const original = 'Hello FocusSpace binary vault!';
    const blob = new Blob([original], { type: 'text/plain' });
    const base64 = await blobToBase64(blob);
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(0);

    const recoveredBlob = base64ToBlob(base64, 'text/plain');
    const recoveredText = await recoveredBlob.text();
    expect(recoveredText).toBe(original);
  });

  it('preserves file blob MIME types (PDF and PNG) with exact byte round-trip fidelity', async () => {
    // 1. Prepare sample PDF binary header (%PDF-1.4...)
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    // 2. Prepare sample PNG binary header (\x89PNG\r\n\x1a\n...)
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const pngBlob = new Blob([pngBytes], { type: 'image/png' });

    await db.fileBlobs.bulkAdd([
      { id: 'blob-pdf-doc', blob: pdfBlob },
      { id: 'blob-png-img', blob: pngBlob },
    ]);

    // Export
    const backupJson = await exportFullBackup();
    const parsed = JSON.parse(backupJson) as FocusSpaceBackupEnvelope;

    // Verify envelope captures correct MIME types
    const pdfEntry = parsed.data.fileBlobs?.find(b => b.id === 'blob-pdf-doc');
    const pngEntry = parsed.data.fileBlobs?.find(b => b.id === 'blob-png-img');
    expect(pdfEntry).toBeDefined();
    expect(pdfEntry?.type).toBe('application/pdf');
    expect(pngEntry).toBeDefined();
    expect(pngEntry?.type).toBe('image/png');

    // Clear database
    await db.fileBlobs.clear();
    expect(await db.fileBlobs.count()).toBe(0);

    // Restore
    const result = await importFullBackup(backupJson);
    expect(result.success).toBe(true);
    expect(result.imported.fileBlobs).toBe(2);

    // Verify restored records in Dexie
    const restoredPdf = await db.fileBlobs.get('blob-pdf-doc');
    const restoredPng = await db.fileBlobs.get('blob-png-img');
    expect(restoredPdf).toBeDefined();
    expect(restoredPdf?.blob.type).toBe('application/pdf');
    expect(new Uint8Array(await restoredPdf!.blob.arrayBuffer())).toEqual(pdfBytes);

    expect(restoredPng).toBeDefined();
    expect(restoredPng?.blob.type).toBe('image/png');
    expect(new Uint8Array(await restoredPng!.blob.arrayBuffer())).toEqual(pngBytes);
  });

  it('rejects backups from newer schema versions with clear error message', async () => {
    const validJson = await exportFullBackup();
    const parsed = JSON.parse(validJson);
    parsed.schemaVersion = 999; // Far newer than db.verno (4)

    const result = await importFullBackup(JSON.stringify(parsed));
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot import backup from newer database schema version 999');
    expect(result.error).toContain(`current supported version is ${db.verno}`);
  });

  it('exports and restores settings block including focusspace-theme', async () => {
    storage.set('focusspace-theme', 'onyx');
    const backupJson = await exportFullBackup();
    const parsed = JSON.parse(backupJson) as FocusSpaceBackupEnvelope;

    expect(parsed.settings).toBeDefined();
    expect(parsed.settings?.theme).toBe('onyx');

    // Change theme locally
    storage.set('focusspace-theme', 'solaris');
    expect(storage.get('focusspace-theme')).toBe('solaris');

    // Restore backup
    const result = await importFullBackup(backupJson);
    expect(result.success).toBe(true);
    expect(storage.get('focusspace-theme')).toBe('onyx');
  });

  it('captures in-memory safety snapshot before database is cleared', async () => {
    // Add existing data
    await db.tasks.add({
      id: 'existing-task',
      title: 'Preserve me in safety snapshot',
      categoryId: 'c1',
      priority: 'Medium',
      status: 'To Do',
      estimatedDuration: 30,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Task);

    expect(await db.tasks.count()).toBe(1);

    // Simulate an import payload that passes initial validation
    const payload = {
      app: 'FocusSpace',
      version: 1,
      schemaVersion: 4,
      data: {
        categories: [],
        tasks: [],
        habits: [],
        goals: [],
        focusLogs: [],
        pages: [],
        journalEntries: [],
        pageLinks: [],
        files: [],
        fileBlobs: [],
      },
    };

    const result = await importFullBackup(JSON.stringify(payload));
    expect(result.success).toBe(true);
  });

  it('provides the in-memory safety snapshot if the restore transaction throws an error', async () => {
    // 1. Seed prior state that must not be lost
    await db.tasks.add({
      id: 'pre-crash-task',
      title: 'Critical unbacked-up task',
      categoryId: 'c1',
      priority: 'Urgent',
      status: 'To Do',
      estimatedDuration: 45,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Task);

    expect(await db.tasks.count()).toBe(1);

    // 2. Mock db.transaction to simulate an unexpected storage write failure
    const originalTransaction = db.transaction.bind(db);
    (db as any).transaction = async () => {
      throw new Error('Simulated IndexedDB transaction abort');
    };

    try {
      const validPayload = {
        app: 'FocusSpace',
        version: 1,
        schemaVersion: 4,
        data: {
          categories: [{ id: 'c1', name: 'Work' }],
          tasks: [],
          habits: [],
          goals: [],
          focusLogs: [],
          pages: [],
          journalEntries: [],
          pageLinks: [],
          files: [],
          fileBlobs: [],
        },
      };

      const result = await importFullBackup(JSON.stringify(validPayload));
      expect(result.success).toBe(false);
      expect(result.error).toContain('Simulated IndexedDB transaction abort');
      expect(result.safetySnapshot).toBeDefined();

      // Verify the safety snapshot contains the exact pre-crash task
      const snapshot = JSON.parse(result.safetySnapshot!) as FocusSpaceBackupEnvelope;
      expect(snapshot.data.tasks.some(t => t.id === 'pre-crash-task')).toBe(true);
    } finally {
      db.transaction = originalTransaction;
    }
  });
});
