import { db } from '../db/db';
import type { JournalEntry, RichTextDoc } from '../types';
import { emptyDoc, isEmptyDoc, richTextToPlainText } from './richtext';
import { isoToday, uid } from './utils';

/** All entries for a page, newest first. */
export const listEntries = (pageId: string) => db.journalEntries.where('pageId').equals(pageId).toArray().then(rows => rows.sort((a, b) => b.date.localeCompare(a.date)));

/**
 * The entry for a given day (default: today), creating an empty one if it doesn't exist yet.
 * "Write today's entry" always continues the same entry rather than piling up several per day.
 */
export async function getOrCreateEntry(pageId: string, date = isoToday()): Promise<JournalEntry> {
  return db.transaction('rw', db.journalEntries, async () => {
    const existing = await db.journalEntries.where('[pageId+date]').equals([pageId, date]).first();
    if (existing) return existing;
    const now = new Date().toISOString();
    const entry: JournalEntry = { id: uid(), pageId, date, content: emptyDoc(), plainText: '', createdAt: now, updatedAt: now };
    await db.journalEntries.add(entry);
    return entry;
  });
}

export async function saveEntry(id: string, content: RichTextDoc) {
  await (db.journalEntries as any).update(id, { content, plainText: richTextToPlainText(content), updatedAt: new Date().toISOString() });
  const entry = await db.journalEntries.get(id);
  if (entry) await db.pages.update(entry.pageId, { updatedAt: new Date().toISOString() });
}

export interface EntrySnapshot { entry: JournalEntry; }

/** An entry left completely empty (never written in) is dropped rather than kept as a blank row. */
export const shouldDropEmptyEntry = (entry: JournalEntry) => isEmptyDoc(entry.content);

export async function deleteEntry(id: string): Promise<EntrySnapshot | null> {
  const entry = await db.journalEntries.get(id);
  if (!entry) return null;
  await db.journalEntries.delete(id);
  return { entry };
}

export const restoreEntry = (snapshot: EntrySnapshot) => db.journalEntries.put(snapshot.entry);
