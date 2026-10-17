import React, { useState } from 'react';
import {
  Clock,
  Timer,
  AlertTriangle,
  RotateCcw,
  Coffee,
  CheckCircle2,
  X,
  Sliders,
  BarChart2,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { screenTimer, useScreenTimer, formatScreenTimeClock } from '../lib/screenTimer';
import { Ring } from './ui';

const SECTION_LABELS: Record<string, { label: string; color: string }> = {
  home: { label: 'Today / Master', color: 'bg-emerald-500' },
  calendar: { label: 'Calendar Planner', color: 'bg-blue-500' },
  journal: { label: 'Daily Journal', color: 'bg-amber-500' },
  pages: { label: 'Knowledge Base', color: 'bg-indigo-500' },
  review: { label: 'Weekly Review', color: 'bg-purple-500' },
  analytics: { label: 'Telemetry & Stats', color: 'bg-cyan-500' },
  settings: { label: 'Settings & Hub', color: 'bg-stone-500' },
  category: { label: 'Category Spaces', color: 'bg-rose-500' },
};

const DAILY_LIMIT_PRESETS = [
  { label: 'Off', minutes: 0 },
  { label: '2 hrs', minutes: 120 },
  { label: '3 hrs', minutes: 180 },
  { label: '4 hrs', minutes: 240 },
  { label: '6 hrs', minutes: 360 },
  { label: '8 hrs', minutes: 480 },
];

const BREAK_REMINDER_PRESETS = [
  { label: 'Off', minutes: 0 },
  { label: '20 min (20-20-20)', minutes: 20 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '60 min', minutes: 60 },
];

export function ScreenTimeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const state = useScreenTimer();
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');

  if (!open) return null;

  const limitSeconds = state.dailyLimitMinutes * 60;
  const progressRatio = limitSeconds > 0 ? Math.min(1, state.todaySeconds / limitSeconds) : 0;
  const percent = limitSeconds > 0 ? Math.round((state.todaySeconds / limitSeconds) * 100) : 0;

  // Aggregate and sort section times
  const totalSectionSeconds = Math.max(1, state.todaySeconds);
  const sectionEntries = Object.entries(state.sections)
    .filter(([_, sec]) => sec > 10)
    .sort((a, b) => b[1] - a[1]);

  const maxWeeklySeconds = Math.max(
    ...state.weeklyHistory.map(h => h.seconds),
    state.dailyLimitMinutes * 60,
    3600
  );

  return (
    <div
      className="fade-in fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm grid place-items-center p-3 sm:p-5 select-none"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Screen Time & Digital Wellbeing"
        onClick={e => e.stopPropagation()}
        className="pop-in w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl border border-line-strong bg-surface text-fg shadow-2xl p-5 sm:p-6 space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <span className="size-10 rounded-2xl bg-accent text-accent-fg grid place-items-center keycap shadow-sm">
              <Clock size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold tracking-tight text-fg">
                Screen Time & Digital Wellbeing
              </h2>
              <p className="text-xs text-fg-muted">
                Offline active usage tracker, continuous session reminders, and limits.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="size-8 rounded-xl border border-line bg-surface-2 hover:bg-hover text-fg-muted hover:text-fg grid place-items-center cursor-pointer transition"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 rounded-2xl bg-surface-2 border border-line text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-1.5 px-3 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-accent text-accent-fg shadow-xs'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            <BarChart2 size={14} />
            <span>Usage Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-1.5 px-3 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-accent text-accent-fg shadow-xs'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            <Sliders size={14} />
            <span>Limits & Reminders</span>
          </button>
        </div>

        {activeTab === 'overview' ? (
          <div className="space-y-5">
            {/* Primary Metrics Card */}
            <div className="p-4 sm:p-5 rounded-3xl bg-surface-2 border border-line flex flex-col sm:flex-row items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Ring value={limitSeconds > 0 ? progressRatio : 1} size={84} stroke={7}>
                    <div className="text-center">
                      <div className="text-sm font-bold font-mono text-fg">{percent}%</div>
                      <div className="text-[9px] font-mono uppercase text-fg-subtle">of limit</div>
                    </div>
                  </Ring>
                </div>
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-fg-subtle">
                    Today's Active Usage
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-fg">
                    {formatScreenTimeClock(state.todaySeconds)}
                  </div>
                  <div className="text-xs text-fg-muted mt-0.5 flex items-center gap-1.5">
                    {state.dailyLimitMinutes > 0 ? (
                      <>
                        <span>Limit: {formatScreenTimeClock(limitSeconds)}</span>
                        {state.limitReached ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/15 text-rose-500 font-semibold flex items-center gap-1">
                            <AlertTriangle size={11} /> Reached
                          </span>
                        ) : state.limitWarningReached ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-500 font-semibold">
                            80% Warning
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-500 font-semibold flex items-center gap-1">
                            <ShieldCheck size={11} /> Healthy
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-fg-subtle">No daily limit configured</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Current Continuous Session Pill */}
              <div className="p-3.5 rounded-2xl bg-surface border border-line flex flex-col items-start gap-2 w-full sm:w-auto shrink-0">
                <div className="flex items-center justify-between w-full gap-3">
                  <span className="text-[10px] font-mono uppercase text-fg-subtle flex items-center gap-1">
                    <Timer size={12} className="text-accent" />
                    <span>Current Block</span>
                  </span>
                  <button
                    onClick={() => screenTimer.resetCurrentSession()}
                    title="Take a short break and reset session counter"
                    className="text-[10px] font-semibold text-accent-text hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Coffee size={11} /> Break Now
                  </button>
                </div>
                <div className="text-lg font-bold font-mono text-fg">
                  {formatScreenTimeClock(state.currentSessionSeconds)}
                </div>
                {state.breakReminderMinutes > 0 && (
                  <div className="text-[10px] text-fg-muted font-mono">
                    Break every {state.breakReminderMinutes}m
                  </div>
                )}
              </div>
            </div>

            {/* Past 7-Day Usage History Bar Chart */}
            <div className="p-4 sm:p-5 rounded-3xl bg-surface-2 border border-line space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-fg flex items-center gap-1.5">
                  <Calendar size={13} className="text-accent" />
                  <span>Past 7-Day Usage</span>
                </span>
                <span className="text-[10px] font-mono text-fg-subtle uppercase">
                  Daily Active Minutes
                </span>
              </div>

              <div className="h-28 flex items-end justify-between gap-2 pt-2 px-1">
                {state.weeklyHistory.map((day, idx) => {
                  const dayHeightRatio = maxWeeklySeconds > 0 ? Math.min(1, day.seconds / maxWeeklySeconds) : 0;
                  const dayHeightPx = Math.max(6, Math.round(dayHeightRatio * 80));
                  const isToday = idx === state.weeklyHistory.length - 1;
                  const dayName = new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });

                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5 group">
                      <div className="text-[10px] font-mono text-fg-muted opacity-0 group-hover:opacity-100 transition truncate">
                        {Math.round(day.seconds / 60)}m
                      </div>
                      <div className="w-full max-w-[32px] bg-surface rounded-t-lg overflow-hidden flex items-end h-[80px]">
                        <div
                          style={{ height: `${dayHeightPx}px` }}
                          className={`w-full rounded-t-md transition-all duration-500 ${
                            isToday
                              ? 'bg-accent shadow-xs'
                              : 'bg-fg-muted/30 group-hover:bg-fg-muted/50'
                          }`}
                        />
                      </div>
                      <div className={`text-[10px] font-mono ${isToday ? 'font-bold text-accent-text' : 'text-fg-subtle'}`}>
                        {dayName}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Workspaces & Sections Breakdown */}
            <div className="p-4 sm:p-5 rounded-3xl bg-surface-2 border border-line space-y-3">
              <div className="text-xs font-bold text-fg">Active Workspaces Breakdown</div>
              {sectionEntries.length === 0 ? (
                <div className="text-xs text-fg-subtle py-2">
                  No workspace usage recorded yet today. Time will appear as you navigate.
                </div>
              ) : (
                <div className="space-y-2">
                  {sectionEntries.map(([secId, secSeconds]) => {
                    const info = SECTION_LABELS[secId] || { label: secId, color: 'bg-accent' };
                    const secRatio = (secSeconds / totalSectionSeconds) * 100;
                    return (
                      <div key={secId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-fg">{info.label}</span>
                          <span className="font-mono text-fg-muted text-[11px]">
                            {formatScreenTimeClock(secSeconds)} ({Math.round(secRatio)}%)
                          </span>
                        </div>
                        <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                          <div
                            style={{ width: `${secRatio}%` }}
                            className={`h-full rounded-full transition-all duration-300 ${info.color}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Limits & Reminders Configuration Tab */
          <div className="space-y-5">
            {/* Daily Limit Configuration */}
            <div className="p-4 sm:p-5 rounded-3xl bg-surface-2 border border-line space-y-3">
              <div>
                <div className="text-xs font-bold text-fg">Daily Screen Time Limit</div>
                <div className="text-[11px] text-fg-subtle">
                  Receive gentle reminders at 80% and a notification when your daily cap is reached.
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                {DAILY_LIMIT_PRESETS.map(preset => (
                  <button
                    key={preset.minutes}
                    onClick={() => screenTimer.setDailyLimit(preset.minutes)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      state.dailyLimitMinutes === preset.minutes
                        ? 'bg-accent text-accent-fg border-accent shadow-xs'
                        : 'bg-surface border-line text-fg-muted hover:text-fg hover:border-line-strong'
                    }`}
                  >
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Continuous Session Break Reminder */}
            <div className="p-4 sm:p-5 rounded-3xl bg-surface-2 border border-line space-y-3">
              <div>
                <div className="text-xs font-bold text-fg">Continuous Work Break Reminder</div>
                <div className="text-[11px] text-fg-subtle">
                  Alerts you after uninterrupted focus to rest your eyes and stretch your posture.
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {BREAK_REMINDER_PRESETS.map(preset => (
                  <button
                    key={preset.minutes}
                    onClick={() => screenTimer.setBreakReminder(preset.minutes)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      state.breakReminderMinutes === preset.minutes
                        ? 'bg-accent text-accent-fg border-accent shadow-xs'
                        : 'bg-surface border-line text-fg-muted hover:text-fg hover:border-line-strong'
                    }`}
                  >
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Reset Today's Logs */}
            <div className="p-4 rounded-3xl bg-surface-2 border border-line flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-fg">Clear Today's Usage Logs</div>
                <div className="text-[11px] text-fg-subtle">Resets today's active counters to 0.</div>
              </div>
              <button
                onClick={() => {
                  if (window.confirm('Reset today\'s screen time logs to 0?')) {
                    screenTimer.resetTodayUsage();
                  }
                }}
                className="h-8 px-3 rounded-xl border border-rose-500/30 hover:bg-rose-500/10 text-rose-500 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw size={12} />
                <span>Reset Today</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
