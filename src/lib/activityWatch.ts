/**
 * ActivityWatch Local Integration Client
 *
 * ActivityWatch (https://activitywatch.net/) is an open-source, local-first,
 * privacy-focused automated time tracker that runs locally on port 5600.
 *
 * If ActivityWatch is running on the user's system, FocusSpace can seamlessly
 * sync detailed window titles, browser tabs, and application usage.
 */

export interface ActivityWatchBucket {
  id: string;
  name: string;
  type: string;
  client: string;
  hostname: string;
}

export interface ActivityWatchEvent {
  id: number;
  timestamp: string;
  duration: number; // in seconds
  data: {
    app?: string;
    title?: string;
    url?: string;
  };
}

export interface ActivityWatchAppSummary {
  name: string;
  displayName: string;
  seconds: number;
  category: string;
}

const AW_BASE_URL = 'http://127.0.0.1:5600/api/0';

/**
 * Checks if the local ActivityWatch server daemon is reachable.
 */
export async function isActivityWatchRunning(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${AW_BASE_URL}/info`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetches today's window activity events from ActivityWatch and returns aggregated app usage.
 */
export async function fetchActivityWatchSummary(dateIso: string): Promise<ActivityWatchAppSummary[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    // Find the active window bucket
    const bucketsRes = await fetch(`${AW_BASE_URL}/buckets`, { signal: controller.signal });
    if (!bucketsRes.ok) return [];
    const buckets: Record<string, ActivityWatchBucket> = await bucketsRes.json();

    const windowBucketKey = Object.keys(buckets).find(k => k.startsWith('aw-watcher-window'));
    if (!windowBucketKey) return [];

    // Query events for today
    const startOfDay = new Date(`${dateIso}T00:00:00Z`).toISOString();
    const endOfDay = new Date(`${dateIso}T23:59:59Z`).toISOString();

    const eventsRes = await fetch(
      `${AW_BASE_URL}/buckets/${windowBucketKey}/events?start=${encodeURIComponent(startOfDay)}&end=${encodeURIComponent(endOfDay)}&limit=1000`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!eventsRes.ok) return [];
    const events: ActivityWatchEvent[] = await eventsRes.json();

    const appMap: Record<string, number> = {};
    for (const ev of events) {
      const app = ev.data.app || 'Unknown';
      const dur = Math.max(0, ev.duration || 0);
      appMap[app] = (appMap[app] || 0) + dur;
    }

    return Object.entries(appMap)
      .map(([name, seconds]) => ({
        name,
        displayName: name,
        seconds: Math.round(seconds),
        category: 'System Activity',
      }))
      .sort((a, b) => b.seconds - a.seconds);
  } catch {
    return [];
  }
}
