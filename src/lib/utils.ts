export const uid = () => crypto.randomUUID();

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * YYYY-MM-DD in the user's *local* timezone.
 * `Date#toISOString()` returns the UTC date instead, which is still "yesterday" for the first hours
 * of every local day east of UTC (for example India before 05:30) and would put tasks, habits and
 * analytics on the wrong day.
 */
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isoToday = () => toISODate(new Date());

/** Parsed at local noon so day arithmetic never trips over DST changes. */
export const parseISODate = (date: string) => new Date(`${date}T12:00:00`);

export const addDays = (date: string, n: number) => {
  const d = parseISODate(date);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

export const daysBetween = (from: string, to: string) =>
  Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86_400_000);

/** 0 = Sunday, 1 = Monday. Shared by analytics and the calendar so both agree on what a week is. */
export const WEEK_STARTS_ON = 1;

export const startOfWeek = (date: string) => {
  const d = parseISODate(date);
  d.setDate(d.getDate() - ((d.getDay() - WEEK_STARTS_ON + 7) % 7));
  return toISODate(d);
};

export const formatMinutes = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

/** 25 -> "25m", 60 -> "1h", 95 -> "1h 35m" */
export const formatDuration = (minutes: number) => {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
};

export const dateLabel = (date: string) => new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`));

export const relativeDay = (date: string, today = isoToday()) => {
  if (!date) return 'No date';
  const diff = daysBetween(today, date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return dateLabel(date);
};

export const priorityTone = (p: string) => ({
  Low: 'text-fg-muted bg-surface-3',
  Medium: 'text-sky-700 dark:text-sky-300 bg-sky-500/15',
  High: 'text-amber-700 dark:text-amber-300 bg-amber-500/15',
  Urgent: 'text-rose-700 dark:text-rose-400 bg-rose-500/15 font-medium',
}[p] ?? 'text-fg-muted bg-surface-3');

const memoryStorage = new Map<string, string>();

/** localStorage that never throws (private mode, blocked storage, quota, test runners). */
export const storage = {
  get(key: string): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch { /* fallback to memory */ }
    return memoryStorage.get(key) ?? null;
  },
  set(key: string, value: string) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
        return;
      }
    } catch { /* fallback to memory */ }
    memoryStorage.set(key, value);
  },
  remove(key: string) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
        return;
      }
    } catch { /* fallback to memory */ }
    memoryStorage.delete(key);
  },
};
