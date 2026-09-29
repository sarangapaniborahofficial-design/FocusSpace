import type { JournalEntry, Page } from '../types';
import { markdownToRichText, richTextToPlainText } from './richtext';
import { toISODate, uid } from './utils';

/** A v2 page record, before this migration runs (it had `content`, no `description`). */
export interface LegacyPageV2 { id: string; categoryId?: string; title: string; content?: string; createdAt: string; updatedAt: string; }

export interface V3Migration { pagePatch: Partial<Page>; entry: JournalEntry | null; }

/**
 * The actual transformation behind the v2 -> v3 Dexie upgrade (kept separate from the Dexie
 * `upgrade()` callback so it can be unit-tested directly, without needing a real IndexedDB).
 * For one legacy page: what to patch on it, and the first journal entry to create (if it had text).
 */
export function migratePageToV3(legacy: LegacyPageV2, newId: () => string = uid): V3Migration {
  const markdown = (legacy.content ?? '').trim();
  if (!markdown) return { pagePatch: { description: '' }, entry: null };

  const richText = markdownToRichText(legacy.content!);
  const dateSource = legacy.updatedAt || legacy.createdAt;
  const parsed = dateSource ? new Date(dateSource) : new Date();
  const date = toISODate(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
  const now = legacy.updatedAt || legacy.createdAt || new Date().toISOString();

  return {
    pagePatch: { description: '', legacyMarkdown: legacy.content },
    entry: { id: newId(), pageId: legacy.id, date, content: richText, plainText: richTextToPlainText(richText), createdAt: now, updatedAt: now },
  };
}
