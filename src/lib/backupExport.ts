import { db } from '../db/db';
import { backupParts } from './backup';
import { blobToBase64, formatBytes } from './files';
import { GOALS_KEY } from './goals';
import { getFileBlob } from './pages';
import { DURATIONS_KEY } from './timer';
import { toast } from './toast';
import { storage } from './utils';

export { LAST_BACKUP_KEY, lastBackupAt, daysSince, snoozeBackupReminder, shouldRemindBackup, currentReminderState } from './backupReminder';
import { LAST_BACKUP_KEY } from './backupReminder';

export const BACKUP_FILE_LIMIT = 150 * 1024 * 1024;

/** Builds and downloads the full JSON backup. Returns false if it could not be created. */
export async function exportBackup(options: { includeFiles: boolean; theme: string }): Promise<boolean> {
  try {
    const [categories, tasks, habits, focusLogs, pages, files, journalEntries, pageLinks] = await Promise.all([db.categories.toArray(), db.tasks.toArray(), db.habits.toArray(), db.focusLogs.toArray(), db.pages.toArray(), db.files.toArray(), db.journalEntries.toArray(), db.pageLinks.toArray()]);
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    const tooBig = options.includeFiles && totalBytes > BACKUP_FILE_LIMIT;
    if (tooBig) {
      toast(`Attached files total ${formatBytes(totalBytes)}, too much to embed in one JSON backup (limit ${formatBytes(BACKUP_FILE_LIMIT)}). Untick "Include attached files" to export everything else, and download the big files from their pages.`, 'error', { duration: 10000 });
      return false;
    }
    const embed = options.includeFiles && files.length > 0;
    const payload = {
      app: 'FocusSpace', version: 3, exportedAt: new Date().toISOString(),
      categories, tasks, habits, focusLogs, pages, journalEntries, pageLinks, filesIncluded: embed || files.length === 0,
      pomodoroDurations: storage.get(DURATIONS_KEY), goals: storage.get(GOALS_KEY), theme: storage.get('focusspace-theme') ?? options.theme,
    };
    const entries: string[] | null = embed ? [] : null;
    let missing = 0;
    if (entries) {
      for (const file of files) {
        const blob = await getFileBlob(file.id);
        if (!blob) { missing += 1; continue; }
        entries.push(JSON.stringify({ ...file, data: await blobToBase64(blob) }));
      }
    }
    const url = URL.createObjectURL(new Blob(backupParts(payload, entries), { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url;
    a.download = `focusspace-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    storage.set(LAST_BACKUP_KEY, new Date().toISOString());
    toast(missing ? `Backup downloaded, but ${missing} attached ${missing === 1 ? 'file was' : 'files were'} unreadable and left out.` : 'Backup downloaded', missing ? 'info' : 'success', { duration: missing ? 8000 : undefined });
    return true;
  } catch (error) {
    toast(error instanceof Error ? `Could not create the backup: ${error.message}` : 'Could not create the backup.', 'error', { duration: 8000 });
    return false;
  }
}
