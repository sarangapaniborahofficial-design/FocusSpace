import { useSyncExternalStore } from 'react';
import { isoToday, storage } from './utils';
import { toast } from './toast';
import { getElectronAPI } from './runtime';
import { isActivityWatchRunning, fetchActivityWatchSummary } from './activityWatch';
import { hudBridge } from './hudBridge';
import { getTimerState } from './timer';

let lastNudgeTime = 0;

export function playAcousticNudge() {
  const now = Date.now();
  if (now - lastNudgeTime < 120_000) return; // rate limit: max once every 2 minutes
  lastNudgeTime = now;

  try {
    const Ctx: typeof AudioContext | undefined = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const start = ctx.currentTime;
    // Gentle warm two-tone acoustic nudge (440Hz -> 554.37Hz C#5)
    [440, 554.37].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = start + idx * 0.16;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.08, at + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.4);
    });
    setTimeout(() => { void ctx.close(); }, 1000);
  } catch {}
}

export interface ScreenTimeSettings {
  dailyLimitMinutes: number; // 0 = disabled, default 240 (4 hours)
  breakReminderMinutes: number; // 0 = disabled, default 45 minutes
  idleTimeoutSeconds: number; // default 90 seconds
  soundAlert: boolean;
}

export interface DayUsage {
  date: string; // YYYY-MM-DD
  totalSeconds: number;
  sections: Record<string, number>;
  sessionsCount: number;
}

export interface SystemAppRecord {
  name: string;
  displayName: string;
  title?: string;
  seconds: number;
  category: string;
  isCurrent?: boolean;
}

export interface ScreenTimeState {
  todaySeconds: number;
  currentSessionSeconds: number;
  isIdle: boolean;
  activeSection: string;
  dailyLimitMinutes: number;
  breakReminderMinutes: number;
  limitReached: boolean;
  limitWarningReached: boolean; // 80% threshold
  breakReminderDue: boolean;
  sections: Record<string, number>;
  weeklyHistory: Array<{ date: string; seconds: number }>;
  systemApps: SystemAppRecord[];
  hasSystemTracking: boolean;
  activeAppName: string;
}

const STORAGE_SETTINGS_KEY = 'focusspace-screentime-settings-v1';
const STORAGE_LOGS_KEY = 'focusspace-screentime-logs-v1';

const DEFAULT_SETTINGS: ScreenTimeSettings = {
  dailyLimitMinutes: 240, // 4 hours
  breakReminderMinutes: 45, // 45 minutes continuous work
  idleTimeoutSeconds: 90,
  soundAlert: true,
};

class ScreenTimerEngine {
  private settings: ScreenTimeSettings;
  private today: string;
  private todaySeconds = 0;
  private currentSessionSeconds = 0;
  private isIdle = false;
  private activeSection = 'home';
  private sections: Record<string, number> = {};
  private history: Record<string, DayUsage> = {};
  private lastActivityTimestamp = Date.now();
  private tickInterval: any = null;
  private saveInterval: any = null;
  private listeners: Set<() => void> = new Set();
  private warned80Percent = false;
  private warned100Percent = false;
  private warnedBreak = false;
  private systemApps: SystemAppRecord[] = [];
  private hasSystemTracking = false;
  private activeAppName = 'FocusSpace';
  private systemPollInterval: any = null;
  private snapshot: ScreenTimeState;

  constructor() {
    this.today = isoToday();
    this.settings = this.loadSettings();
    this.history = this.loadHistory();

    const todayUsage = this.history[this.today] || {
      date: this.today,
      totalSeconds: 0,
      sections: {},
      sessionsCount: 1,
    };
    this.todaySeconds = todayUsage.totalSeconds;
    this.sections = { ...todayUsage.sections };

    this.snapshot = this.computeSnapshot();

    if (typeof window !== 'undefined') {
      this.attachActivityListeners();
      this.startTimer();
    }
  }

  private loadSettings(): ScreenTimeSettings {
    try {
      const raw = storage.get(STORAGE_SETTINGS_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {}
    return { ...DEFAULT_SETTINGS };
  }

  private loadHistory(): Record<string, DayUsage> {
    try {
      const raw = storage.get(STORAGE_LOGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  }

  private saveHistory() {
    try {
      this.history[this.today] = {
        date: this.today,
        totalSeconds: this.todaySeconds,
        sections: { ...this.sections },
        sessionsCount: (this.history[this.today]?.sessionsCount || 0) + 1,
      };

      // Prune history to keep only the last 30 days
      const keys = Object.keys(this.history).sort();
      if (keys.length > 30) {
        const toDelete = keys.slice(0, keys.length - 30);
        toDelete.forEach(k => delete this.history[k]);
      }

      storage.set(STORAGE_LOGS_KEY, JSON.stringify(this.history));
    } catch {}
  }

  private attachActivityListeners() {
    const onUserActivity = () => {
      this.lastActivityTimestamp = Date.now();
      if (this.isIdle) {
        this.isIdle = false;
        this.updateSnapshot();
      }
    };

    window.addEventListener('mousemove', onUserActivity, { passive: true });
    window.addEventListener('mousedown', onUserActivity, { passive: true });
    window.addEventListener('keydown', onUserActivity, { passive: true });
    window.addEventListener('wheel', onUserActivity, { passive: true });
    window.addEventListener('touchstart', onUserActivity, { passive: true });

    window.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.isIdle = true;
        this.saveHistory();
        this.updateSnapshot();
      } else {
        this.lastActivityTimestamp = Date.now();
        this.isIdle = false;
        this.updateSnapshot();
      }
    });

    window.addEventListener('beforeunload', () => {
      this.saveHistory();
    });
  }

  private startTimer() {
    this.tickInterval = setInterval(() => {
      this.tick();
    }, 1000);

    // Persist every 15 seconds
    this.saveInterval = setInterval(() => {
      this.saveHistory();
    }, 15000);

    // Poll system-wide applications every 2.5 seconds
    void this.pollSystemApps();
    this.systemPollInterval = setInterval(() => {
      void this.pollSystemApps();
    }, 2500);
  }

  private async pollSystemApps() {
    try {
      const electron = getElectronAPI();
      if (electron?.getSystemApps) {
        const res = await electron.getSystemApps();
        if (res && res.supported) {
          const apps = res.apps || [];
          const activeApp = res.activeApp || 'FocusSpace';
          const changed =
            this.activeAppName !== activeApp ||
            !this.hasSystemTracking ||
            this.systemApps.length !== apps.length ||
            (apps[0]?.seconds !== this.systemApps[0]?.seconds);

          this.hasSystemTracking = true;
          this.activeAppName = activeApp;
          this.systemApps = apps;
          if (changed) {
            this.updateSnapshot();
          }

          // Context-Aware Focus Guard check:
          const timerState = getTimerState();
          if (timerState.running && timerState.mode === 'focus') {
            if (res.isDistraction && res.distractionSeconds && res.distractionSeconds >= 120) {
              hudBridge.send({
                type: 'FOCUS_NUDGE',
                v: 1,
                active: true,
                appName: activeApp,
                distractionSeconds: res.distractionSeconds,
              });
              playAcousticNudge();
            } else if (!res.isDistraction) {
              hudBridge.send({
                type: 'FOCUS_NUDGE',
                v: 1,
                active: false,
              });
            }
          }
          return;
        }
      }

      // Check local ActivityWatch daemon as fallback/enhancement
      const awRunning = await isActivityWatchRunning();
      if (awRunning) {
        const awSummary = await fetchActivityWatchSummary(this.today);
        if (awSummary.length > 0) {
          const changed =
            !this.hasSystemTracking ||
            this.systemApps.length !== awSummary.length ||
            (awSummary[0]?.seconds !== this.systemApps[0]?.seconds);

          this.hasSystemTracking = true;
          this.systemApps = awSummary;
          if (changed) {
            this.updateSnapshot();
          }
        }
      }
    } catch {}
  }

  private tick() {
    const now = Date.now();
    const curDate = isoToday();

    // Day change rollover
    if (curDate !== this.today) {
      this.saveHistory();
      this.today = curDate;
      this.todaySeconds = 0;
      this.currentSessionSeconds = 0;
      this.sections = {};
      this.warned80Percent = false;
      this.warned100Percent = false;
      this.warnedBreak = false;
    }

    // Check idle threshold
    const idleLimitMs = (this.settings.idleTimeoutSeconds || 90) * 1000;
    const isCurrentlyIdle = now - this.lastActivityTimestamp > idleLimitMs || (typeof document !== 'undefined' && document.hidden);

    if (isCurrentlyIdle !== this.isIdle) {
      this.isIdle = isCurrentlyIdle;
      if (this.isIdle) {
        // Reset current continuous session when idle for longer than 3 minutes
        if (now - this.lastActivityTimestamp > 180000) {
          this.currentSessionSeconds = 0;
          this.warnedBreak = false;
        }
      }
    }

    if (!this.isIdle) {
      this.todaySeconds += 1;
      this.currentSessionSeconds += 1;
      this.sections[this.activeSection] = (this.sections[this.activeSection] || 0) + 1;

      // Limit and Reminder Checks
      this.checkLimitsAndReminders();
    }

    this.updateSnapshot();
  }

  private checkLimitsAndReminders() {
    const limitSec = this.settings.dailyLimitMinutes * 60;
    const breakSec = this.settings.breakReminderMinutes * 60;

    // 80% daily limit warning
    if (limitSec > 0 && !this.warned80Percent && this.todaySeconds >= limitSec * 0.8) {
      this.warned80Percent = true;
      const remMin = Math.round((limitSec - this.todaySeconds) / 60);
      toast(`Screen Time: 80% of daily limit reached (${remMin} mins remaining).`, 'info');
    }

    // 100% daily limit reached
    if (limitSec > 0 && !this.warned100Percent && this.todaySeconds >= limitSec) {
      this.warned100Percent = true;
      toast(`Daily Screen Time Limit (${this.settings.dailyLimitMinutes}m) reached! Consider wrapping up.`, 'error');
    }

    // Continuous session break reminder (e.g. 45 mins)
    if (breakSec > 0 && !this.warnedBreak && this.currentSessionSeconds >= breakSec) {
      this.warnedBreak = true;
      const mins = Math.round(this.currentSessionSeconds / 60);
      toast(`Eye & Posture Break: You have been active for ${mins} minutes. Look 20ft away for 20s.`, 'info');
    }
  }

  private computeWeeklyHistory(): Array<{ date: string; seconds: number }> {
    const list: Array<{ date: string; seconds: number }> = [];
    const todayObj = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayObj);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const sec = iso === this.today ? this.todaySeconds : (this.history[iso]?.totalSeconds || 0);
      list.push({ date: iso, seconds: sec });
    }
    return list;
  }

  private computeSnapshot(): ScreenTimeState {
    const limitSec = this.settings.dailyLimitMinutes * 60;
    const breakSec = this.settings.breakReminderMinutes * 60;

    return {
      todaySeconds: this.todaySeconds,
      currentSessionSeconds: this.currentSessionSeconds,
      isIdle: this.isIdle,
      activeSection: this.activeSection,
      dailyLimitMinutes: this.settings.dailyLimitMinutes,
      breakReminderMinutes: this.settings.breakReminderMinutes,
      limitReached: limitSec > 0 && this.todaySeconds >= limitSec,
      limitWarningReached: limitSec > 0 && this.todaySeconds >= limitSec * 0.8,
      breakReminderDue: breakSec > 0 && this.currentSessionSeconds >= breakSec,
      sections: { ...this.sections },
      weeklyHistory: this.computeWeeklyHistory(),
      systemApps: this.systemApps,
      hasSystemTracking: this.hasSystemTracking,
      activeAppName: this.activeAppName,
    };
  }

  private updateSnapshot() {
    this.snapshot = this.computeSnapshot();
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch (err) {
        console.error('Error in screenTimer listener:', err);
      }
    });
  }

  /** Strict reference equality getter for useSyncExternalStore */
  getState(): ScreenTimeState {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setSection(section: string) {
    if (this.activeSection !== section) {
      this.activeSection = section;
      this.updateSnapshot();
    }
  }

  setDailyLimit(minutes: number) {
    const val = Math.max(0, Math.min(1440, minutes));
    if (this.settings.dailyLimitMinutes !== val) {
      this.settings.dailyLimitMinutes = val;
      storage.set(STORAGE_SETTINGS_KEY, JSON.stringify(this.settings));
      this.warned80Percent = this.todaySeconds >= val * 60 * 0.8;
      this.warned100Percent = this.todaySeconds >= val * 60;
      this.updateSnapshot();
    }
  }

  setBreakReminder(minutes: number) {
    const val = Math.max(0, Math.min(240, minutes));
    if (this.settings.breakReminderMinutes !== val) {
      this.settings.breakReminderMinutes = val;
      storage.set(STORAGE_SETTINGS_KEY, JSON.stringify(this.settings));
      this.warnedBreak = false;
      this.updateSnapshot();
    }
  }

  resetCurrentSession() {
    this.currentSessionSeconds = 0;
    this.warnedBreak = false;
    this.updateSnapshot();
    toast('Session timer reset. Enjoy your fresh focus block!', 'info');
  }

  resetTodayUsage() {
    this.todaySeconds = 0;
    this.currentSessionSeconds = 0;
    this.sections = {};
    this.warned80Percent = false;
    this.warned100Percent = false;
    this.warnedBreak = false;
    this.saveHistory();
    this.updateSnapshot();
    toast('Today\'s screen time logs have been reset.', 'info');
  }
}

export const screenTimer = new ScreenTimerEngine();

export function useScreenTimer(): ScreenTimeState {
  return useSyncExternalStore(
    onStoreChange => screenTimer.subscribe(onStoreChange),
    () => screenTimer.getState()
  );
}

export function formatScreenTimeClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
