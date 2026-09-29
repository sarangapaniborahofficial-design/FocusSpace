import { storage } from './utils';

export const LAST_BACKUP_KEY = 'focusspace-last-backup';
const SNOOZE_KEY = 'focusspace-backup-snooze';

export const lastBackupAt = () => storage.get(LAST_BACKUP_KEY);
export const daysSince = (iso: string | null, now = Date.now()) => (iso && !Number.isNaN(Date.parse(iso)) ? Math.floor((now - Date.parse(iso)) / 86_400_000) : null);
export const snoozeBackupReminder = (days = 7, now = Date.now()) => storage.set(SNOOZE_KEY, new Date(now + days * 86_400_000).toISOString());
const snoozedUntil = () => storage.get(SNOOZE_KEY);

/** Should the app nudge the user to back up? Only when there is something worth protecting. */
export function shouldRemindBackup(input: { records: number; lastBackup: string | null; snoozedUntil: string | null; now?: number }) {
  const now = input.now ?? Date.now();
  if (input.records < 5) return false;
  if (input.snoozedUntil && Date.parse(input.snoozedUntil) > now) return false;
  const age = daysSince(input.lastBackup, now);
  return age === null || age >= 14;
}
export const currentReminderState = () => ({ lastBackup: lastBackupAt(), snoozedUntil: snoozedUntil() });
