import { db } from '../db/db';
import { blobToBase64 } from './files';
import { DURATIONS_KEY } from './timer';
import { toast } from './toast';
import { isoToday, storage, uid } from './utils';

const DB_NAME = 'FocusSpaceFolderSyncDB';
const STORE_NAME = 'handles';
const KEY_DIR = 'sync-dir';
const KEY_LAST_SYNC = 'focusspace-last-folder-sync';

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getSavedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) return null;
  try {
    const idb = await openHandleDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY_DIR);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const idb = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(handle, KEY_DIR);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearDirectoryHandle(): Promise<void> {
  const idb = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(KEY_DIR);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: 'readwrite' as const };
  if ((await (handle as any).queryPermission(opts)) === 'granted') {
    return true;
  }
  if ((await (handle as any).requestPermission(opts)) === 'granted') {
    return true;
  }
  return false;
}

/**
 * Builds the canonical full JSON backup payload for FocusSpace.
 */
export async function buildBackupPayload(): Promise<string> {
  const [categories, tasks, habits, focusLogs, pages, files, blobs, journalEntries, pageLinks] = await Promise.all([
    db.categories.toArray(),
    db.tasks.toArray(),
    db.habits.toArray(),
    db.focusLogs.toArray(),
    db.pages.toArray(),
    db.files.toArray(),
    db.fileBlobs.toArray(),
    db.journalEntries.toArray(),
    db.pageLinks.toArray(),
  ]);

  const blobMap = new Map(blobs.map(b => [b.id, b.blob]));
  const embeddedFiles = await Promise.all(
    files.map(async f => {
      const blob = blobMap.get(f.id);
      return blob ? { ...f, data: await blobToBase64(blob) } : null;
    })
  );

  const payload = {
    app: 'FocusSpace',
    version: 3,
    exportedAt: new Date().toISOString(),
    filesIncluded: true,
    pomodoroDurations: storage.get(DURATIONS_KEY),
    theme: storage.get('focusspace-theme') ?? 'nocturne',
    categories,
    tasks,
    habits,
    focusLogs,
    pages,
    files: embeddedFiles.filter(Boolean),
    journalEntries,
    pageLinks,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Writes the latest backup JSON snapshot to the connected local folder.
 */
export async function syncToDirectory(handle?: FileSystemDirectoryHandle): Promise<{ filename: string }> {
  const dirHandle = handle ?? (await getSavedDirectoryHandle());
  if (!dirHandle) {
    throw new Error('No local sync folder selected.');
  }

  const hasPerm = await verifyPermission(dirHandle);
  if (!hasPerm) {
    throw new Error('Permission to write to the sync folder was denied.');
  }

  const payload = await buildBackupPayload();
  const dateStr = isoToday();
  const filename = `focusspace-backup-${dateStr}.json`;

  // 1. Write dated snapshot
  const datedFile = await dirHandle.getFileHandle(filename, { create: true });
  const writableDated = await (datedFile as any).createWritable();
  await writableDated.write(payload);
  await writableDated.close();

  // 2. Write latest pointer
  const latestFile = await dirHandle.getFileHandle('focusspace-latest.json', { create: true });
  const writableLatest = await (latestFile as any).createWritable();
  await writableLatest.write(payload);
  await writableLatest.close();

  const now = new Date().toISOString();
  storage.set(KEY_LAST_SYNC, now);

  return { filename };
}

export function getLastSyncTime(): string | null {
  return storage.get(KEY_LAST_SYNC);
}
