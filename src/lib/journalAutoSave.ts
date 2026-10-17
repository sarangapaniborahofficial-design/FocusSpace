import { db } from '../db/db';
import { generateDailySummaryDoc } from './journalSummary';
import { richTextToPlainText } from './richtext';
import { toast } from './toast';
import { isoToday, storage, uid } from './utils';
import { getElectronAPI, isElectron } from './runtime';
import type { JournalEntry } from '../types';

/** Reserved page identifier for all automated & manual daily journal reviews */
export const DAILY_JOURNAL_PAGE_ID = '__daily_journal__';

/**
 * Calculates milliseconds until 23:59:00 local time today.
 * If already past 23:59:00, calculates until 23:59:00 tomorrow.
 */
export function getMsUntilMidnight(now = new Date()): number {
  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    0,
    0
  );
  if (now.getTime() >= target.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - now.getTime();
}

/**
 * Returns yesterday's date in local YYYY-MM-DD format.
 */
export function getYesterdayIso(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Ensures the reserved daily journal page record exists in db.pages so Dexie updates and joins succeed.
 */
async function ensureDailyJournalPage() {
  const exists = await db.pages.get(DAILY_JOURNAL_PAGE_ID);
  if (!exists) {
    const now = new Date().toISOString();
    await db.pages.put({
      id: DAILY_JOURNAL_PAGE_ID,
      title: 'Daily Journal',
      description: 'Automated daily reflection snapshots and personal journal logs.',
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Generates and saves a rich-text daily review snapshot for the specified date.
 * If an entry already exists for that date under __daily_journal__, it updates it;
 * otherwise it creates a new JournalEntry.
 */
export async function saveDailyJournalSnapshot(
  date = isoToday(),
  isManual = false
): Promise<JournalEntry> {
  await ensureDailyJournalPage();
  const summaryDoc = await generateDailySummaryDoc(date);
  const plainText = richTextToPlainText(summaryDoc);
  const now = new Date().toISOString();

  const existing = await db.journalEntries
    .where('[pageId+date]')
    .equals([DAILY_JOURNAL_PAGE_ID, date])
    .first();

  let entry: JournalEntry;

  if (existing) {
    await (db.journalEntries as any).update(existing.id, {
      content: summaryDoc,
      plainText,
      updatedAt: now,
    });
    entry = {
      ...existing,
      content: summaryDoc,
      plainText,
      updatedAt: now,
    };
  } else {
    entry = {
      id: uid(),
      pageId: DAILY_JOURNAL_PAGE_ID,
      date,
      content: summaryDoc,
      plainText,
      createdAt: now,
      updatedAt: now,
    };
    await db.journalEntries.add(entry);
  }

  await db.pages.update(DAILY_JOURNAL_PAGE_ID, { updatedAt: now });

  if (isManual) {
    toast('Daily reflection snapshot captured!', 'success');
  }

  return entry;
}

/**
 * Next-morning boot catch-up:
 * If the user's laptop was closed or asleep before 23:59:00 yesterday,
 * checks if yesterday had activity (completed tasks, focus sessions, or habits).
 * If activity existed and no journal entry was written for yesterday,
 * auto-generates yesterday's snapshot so reflections are never lost.
 */
export async function checkMissedMidnightSnapshot(): Promise<boolean> {
  const yesterday = getYesterdayIso();
  const existing = await db.journalEntries
    .where('[pageId+date]')
    .equals([DAILY_JOURNAL_PAGE_ID, yesterday])
    .first();

  if (existing) return false;

  const [tasks, habits, logs] = await Promise.all([
    db.tasks.toArray(),
    db.habits.toArray(),
    db.focusLogs.toArray(),
  ]);

  const hadCompletedTasks = tasks.some(t => {
    if (t.status !== 'Submitted/Done') return false;
    const completedDay = t.completedAt ? t.completedAt.slice(0, 10) : t.updatedAt?.slice(0, 10);
    return completedDay === yesterday;
  });

  const hadFocusLogs = logs.some(
    l => l.startedAt?.slice(0, 10) === yesterday && l.mode === 'focus'
  );

  const hadHabits = habits.some(
    h => h.active && h.completions.includes(yesterday)
  );

  if (hadCompletedTasks || hadFocusLogs || hadHabits) {
    await saveDailyJournalSnapshot(yesterday, false);
    return true;
  }

  return false;
}

/**
 * Takes an automated native desktop vault snapshot into app_data/Backups.
 */
export async function takeNativeVaultSnapshot(): Promise<string | null> {
  const api = getElectronAPI();
  if (!api) return null;
  try {
    const { exportFullBackup } = await import('./backup');
    const payload = await exportFullBackup();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `focusspace-${isoToday()}-${timeStr}.json`;
    const secondaryDir = storage.get('focusspace-secondary-vault-dir') || undefined;
    const res = await api.writeSnapshot(filename, payload, secondaryDir);
    storage.set('focusspace-last-native-backup', now.toISOString());
    return res.path;
  } catch (err) {
    console.error('Failed to take native vault snapshot:', err);
    return null;
  }
}

/**
 * Boot check: Takes a snapshot on boot if the newest snapshot is older than 24h.
 */
export async function checkBootVaultSnapshot(): Promise<void> {
  if (!isElectron()) return;
  try {
    const lastBackupStr = storage.get('focusspace-last-native-backup');
    const now = Date.now();
    const isOld = !lastBackupStr || (now - new Date(lastBackupStr).getTime() > 24 * 3600 * 1000);
    if (isOld) {
      await takeNativeVaultSnapshot();
    }
  } catch (err) {
    console.error('Boot vault snapshot check failed:', err);
  }
}

/**
 * Initializes the automated daily journal engine:
 * 1. Executes next-morning boot catch-up for any missed snapshots.
 * 2. Schedules a timer at 23:59:00 local time every day.
 * Returns an unmount cleanup function.
 */
export function initJournalAutoSave(): () => void {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let isMounted = true;

  // Run catch-up asynchronously on boot
  void checkMissedMidnightSnapshot().catch(err => {
    console.error('Failed to run missed midnight journal catch-up:', err);
  });

  if (isElectron()) {
    void checkBootVaultSnapshot();
  }

  const scheduleNext = () => {
    if (!isMounted) return;
    const ms = getMsUntilMidnight();
    timerId = setTimeout(async () => {
      try {
        await saveDailyJournalSnapshot(isoToday(), false);
        if (isElectron()) {
          await takeNativeVaultSnapshot();
        }
      } catch (err) {
        console.error('Failed to auto-save daily journal at 11:59 PM:', err);
      }
      scheduleNext();
    }, ms);
  };

  scheduleNext();

  return () => {
    isMounted = false;
    if (timerId) clearTimeout(timerId);
  };
}
