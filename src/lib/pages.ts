import { db } from '../db/db';
import type { FileBlob, JournalEntry, Page, PageFile, PageLink } from '../types';
import { MAX_FILE_BYTES, formatBytes, guessType } from './files';
import { toast } from './toast';
import { uid } from './utils';

export interface PageSnapshot { page: Page; files: PageFile[]; blobs: FileBlob[]; entries: JournalEntry[]; links: PageLink[]; }
export interface FileSnapshot { file: PageFile; blob: FileBlob | undefined; }

export async function createPage(input: { title?: string; categoryId?: string } = {}): Promise<Page> {
  const now = new Date().toISOString();
  const page: Page = { id: uid(), title: input.title ?? 'Untitled', description: '', ...(input.categoryId ? { categoryId: input.categoryId } : {}), createdAt: now, updatedAt: now };
  await db.pages.add(page);
  return page;
}

export const savePage = (id: string, changes: Partial<Pick<Page, 'title' | 'description' | 'categoryId'>>) =>
  db.pages.update(id, { ...changes, updatedAt: new Date().toISOString() });

/** Confirms a converted legacy note looks right, clearing the original Markdown and the migration banner. */
export const confirmLegacyPage = (id: string) => db.pages.update(id, { legacyMarkdown: undefined, legacyConfirmedAt: new Date().toISOString() });

/** Deletes a page with its files, journal entries and links. The snapshot lets the caller offer "Undo". */
export async function deletePage(id: string): Promise<PageSnapshot | null> {
  return db.transaction('rw', db.pages, db.files, db.fileBlobs, db.journalEntries, db.pageLinks, async () => {
    const page = await db.pages.get(id);
    if (!page) return null;
    const [files, entries, links] = await Promise.all([
      db.files.where('pageId').equals(id).toArray(),
      db.journalEntries.where('pageId').equals(id).toArray(),
      db.pageLinks.where('pageId').equals(id).toArray(),
    ]);
    const blobs = (await Promise.all(files.map(f => db.fileBlobs.get(f.id)))).filter((b): b is FileBlob => !!b);
    await db.fileBlobs.bulkDelete(files.map(f => f.id));
    await db.files.bulkDelete(files.map(f => f.id));
    await db.journalEntries.bulkDelete(entries.map(e => e.id));
    await db.pageLinks.bulkDelete(links.map(l => l.id));
    await db.pages.delete(id);
    return { page, files, blobs, entries, links };
  });
}

export async function restorePage(snapshot: PageSnapshot) {
  await db.transaction('rw', db.pages, db.files, db.fileBlobs, db.journalEntries, db.pageLinks, async () => {
    await db.pages.put(snapshot.page);
    await db.files.bulkPut(snapshot.files);
    await db.fileBlobs.bulkPut(snapshot.blobs);
    await db.journalEntries.bulkPut(snapshot.entries);
    await db.pageLinks.bulkPut(snapshot.links);
  });
}

export const getFileBlob = async (id: string) => (await db.fileBlobs.get(id))?.blob;

export async function deleteFile(id: string): Promise<FileSnapshot | null> {
  return db.transaction('rw', db.files, db.fileBlobs, async () => {
    const file = await db.files.get(id);
    if (!file) return null;
    const blob = await db.fileBlobs.get(id);
    await db.fileBlobs.delete(id);
    await db.files.delete(id);
    return { file, blob };
  });
}

export async function restoreFile(snapshot: FileSnapshot) {
  await db.transaction('rw', db.files, db.fileBlobs, async () => {
    await db.files.put(snapshot.file);
    if (snapshot.blob) await db.fileBlobs.put(snapshot.blob);
  });
}

/** Attaches files to a page. Oversized files are skipped; a full disk is reported instead of failing silently. */
export async function addFiles(pageId: string, incoming: File[]) {
  const accepted: File[] = [];
  for (const file of incoming) {
    if (file.size > MAX_FILE_BYTES) toast(`“${file.name}” is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_FILE_BYTES)} per file.`, 'error', { duration: 7000 });
    else accepted.push(file);
  }
  let added = 0;
  for (const file of accepted) {
    const id = uid();
    const meta: PageFile = { id, pageId, name: file.name || 'Untitled file', type: guessType(file.name, file.type), size: file.size, createdAt: new Date().toISOString() };
    try {
      await db.transaction('rw', db.files, db.fileBlobs, async () => {
        await db.fileBlobs.add({ id, blob: file });
        await db.files.add(meta);
      });
      added += 1;
    } catch (error) {
      const full = error instanceof Error && /quota/i.test(`${error.name} ${error.message}`);
      toast(full ? 'The browser has no more storage available for this site. Remove some files and try again.' : `Could not attach “${file.name}”.`, 'error', { duration: 7000 });
      if (full) break;
    }
  }
  if (added) {
    await db.pages.update(pageId, { updatedAt: new Date().toISOString() });
    toast(added === 1 ? 'File attached' : `${added} files attached`, 'success');
  }
  return added;
}
