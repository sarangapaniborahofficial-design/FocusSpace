import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../db/db';
import { exportFullBackup, importFullBackup } from '../backup';
import type {
  Category,
  FocusLog,
  Goal,
  Habit,
  JournalEntry,
  Page,
  PageFile,
  PageLink,
  Task,
} from '../../types';
import { storage } from '../utils';

describe('Phase 1.2: Automated Backup Round-Trip Test across all 10 Dexie tables', () => {
  beforeEach(async () => {
    // Clear all 10 tables before test run
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

  it('preserves all 10 tables, exact blob MIME types & bytes, and rejects schemaVersion > 4', async () => {
    // 1. Seed all 10 tables
    const category: Category = {
      id: 'cat-core',
      name: 'Engineering',
      color: '#3b82f6',
      icon: 'Code',
    };

    const task: Task = {
      id: 'task-001',
      title: 'Native Windows hardening',
      categoryId: 'cat-core',
      projectTag: 'Desktop',
      priority: 'Urgent',
      status: 'In Progress',
      estimatedDuration: 60,
      dueDate: '2026-10-16',
      dueTime: '18:00',
      subtasks: [{ id: 'sub-1', title: 'Scaffold Tauri', completed: true }],
      notes: 'Ensure all tests pass',
      colorCode: '#3b82f6',
      createdAt: '2026-10-16T10:00:00.000Z',
      updatedAt: '2026-10-16T10:00:00.000Z',
    };

    const habit: Habit = {
      id: 'habit-001',
      name: 'Focus Block 90m',
      color: '#10b981',
      active: true,
      completions: ['2026-10-15', '2026-10-16'],
    };

    const goal: Goal = {
      id: 'goal-001',
      categoryId: 'cat-core',
      title: 'Ship v1.0 Desktop',
      metricLabel: 'tasks',
      currentValue: 1,
      targetValue: 1,
      goalType: 'tasks-completed',
      createdAt: '2026-10-16T10:00:00.000Z',
      updatedAt: '2026-10-16T10:00:00.000Z',
    };

    const focusLog: FocusLog = {
      id: 'log-001',
      taskId: 'task-001',
      startedAt: '2026-10-16T11:00:00.000Z',
      endedAt: '2026-10-16T11:25:00.000Z',
      durationMinutes: 25,
      mode: 'focus',
    };

    const page: Page = {
      id: 'page-001',
      title: 'Tauri Architecture Spec',
      description: 'Native Windows v2 specifications',
      createdAt: '2026-10-16T09:00:00.000Z',
      updatedAt: '2026-10-16T09:30:00.000Z',
    };

    const journalEntry: JournalEntry = {
      id: 'jrn-001',
      pageId: 'page-001',
      date: '2026-10-16',
      content: { type: 'doc', content: [{ type: 'paragraph', text: 'Implemented Phase 1.2 round trip' }] },
      plainText: 'Implemented Phase 1.2 round trip',
      createdAt: '2026-10-16T12:00:00.000Z',
      updatedAt: '2026-10-16T12:00:00.000Z',
    };

    const pageLink: PageLink = {
      id: 'link-001',
      pageId: 'page-001',
      targetId: 'task-001',
      kind: 'task',
      createdAt: '2026-10-16T12:00:00.000Z',
    };

    const fileMeta1: PageFile = {
      id: 'file-pdf-001',
      pageId: 'page-001',
      name: 'Architecture.pdf',
      type: 'application/pdf',
      size: 4,
      createdAt: '2026-10-16T12:00:00.000Z',
    };

    const fileMeta2: PageFile = {
      id: 'file-png-001',
      pageId: 'page-001',
      name: 'Diagram.png',
      type: 'image/png',
      size: 4,
      createdAt: '2026-10-16T12:00:00.000Z',
    };

    // PDF binary: %PDF (0x25, 0x50, 0x44, 0x46)
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    // PNG binary: \x89PNG (0x89, 0x50, 0x4e, 0x47)
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const pngBlob = new Blob([pngBytes], { type: 'image/png' });

    await db.categories.add(category);
    await db.tasks.add(task);
    await db.habits.add(habit);
    await db.goals.add(goal);
    await db.focusLogs.add(focusLog);
    await db.pages.add(page);
    await db.journalEntries.add(journalEntry);
    await db.pageLinks.add(pageLink);
    await db.files.bulkAdd([fileMeta1, fileMeta2]);
    await db.fileBlobs.bulkAdd([
      { id: 'file-pdf-001', blob: pdfBlob },
      { id: 'file-png-001', blob: pngBlob },
    ]);

    storage.set('focusspace-theme', 'onyx');
    storage.set('focusspace-layout', 'cockpit');

    // Verify all 10 tables are populated
    expect(await db.categories.count()).toBe(1);
    expect(await db.tasks.count()).toBe(1);
    expect(await db.habits.count()).toBe(1);
    expect(await db.goals.count()).toBe(1);
    expect(await db.focusLogs.count()).toBe(1);
    expect(await db.pages.count()).toBe(1);
    expect(await db.journalEntries.count()).toBe(1);
    expect(await db.pageLinks.count()).toBe(1);
    expect(await db.files.count()).toBe(2);
    expect(await db.fileBlobs.count()).toBe(2);

    // 2. Export full backup
    const backupJson = await exportFullBackup();
    const envelope = JSON.parse(backupJson);
    expect(envelope.schemaVersion).toBe(4);
    expect(envelope.settings.theme).toBe('onyx');
    expect(envelope.settings.layout).toBe('cockpit');

    // Wipe all 10 tables + storage
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
    storage.set('focusspace-theme', 'solaris');
    storage.set('focusspace-layout', 'orbital');

    // Confirm completely empty
    expect(await db.categories.count()).toBe(0);
    expect(await db.tasks.count()).toBe(0);
    expect(await db.fileBlobs.count()).toBe(0);

    // 3. Import backup
    const result = await importFullBackup(backupJson);
    expect(result.success).toBe(true);

    // Assert row counts across all 10 tables match exactly
    expect(await db.categories.count()).toBe(1);
    expect(await db.tasks.count()).toBe(1);
    expect(await db.habits.count()).toBe(1);
    expect(await db.goals.count()).toBe(1);
    expect(await db.focusLogs.count()).toBe(1);
    expect(await db.pages.count()).toBe(1);
    expect(await db.journalEntries.count()).toBe(1);
    expect(await db.pageLinks.count()).toBe(1);
    expect(await db.files.count()).toBe(2);
    expect(await db.fileBlobs.count()).toBe(2);

    // Assert settings restored
    expect(storage.get('focusspace-theme')).toBe('onyx');
    expect(storage.get('focusspace-layout')).toBe('cockpit');

    // Assert exact byte + MIME-type equality on both blobs
    const restoredPdf = await db.fileBlobs.get('file-pdf-001');
    expect(restoredPdf).toBeDefined();
    expect(restoredPdf?.blob.type).toBe('application/pdf');
    const restoredPdfBuffer = await restoredPdf!.blob.arrayBuffer();
    expect(new Uint8Array(restoredPdfBuffer)).toEqual(pdfBytes);

    const restoredPng = await db.fileBlobs.get('file-png-001');
    expect(restoredPng).toBeDefined();
    expect(restoredPng?.blob.type).toBe('image/png');
    const restoredPngBuffer = await restoredPng!.blob.arrayBuffer();
    expect(new Uint8Array(restoredPngBuffer)).toEqual(pngBytes);

    // 4. Test schema rejection when schemaVersion: 99
    const invalidSchemaJson = JSON.stringify({
      ...envelope,
      schemaVersion: 99,
    });
    const invalidResult = await importFullBackup(invalidSchemaJson);
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error).toContain('newer database schema version 99');
  });
});
