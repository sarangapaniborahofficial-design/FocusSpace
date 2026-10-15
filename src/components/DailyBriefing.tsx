import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlarmClock,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileText,
  Flame,
  Moon,
  Sparkles,
  Sun,
  Sunrise,
  Trophy,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { db } from '../db/db';
import { createPage } from '../lib/pages';
import { generateDailySummaryDoc } from '../lib/journalSummary';
import { focusOnTask } from '../lib/timer';
import { toast } from '../lib/toast';
import { addDays, formatDuration } from '../lib/utils';
import type { Task } from '../types';
import { Ring } from './ui';

export type BriefingMode = 'auto' | 'morning' | 'midday' | 'evening';

export function DailyBriefing({
  today,
  openCount,
  totalCount,
  completionRatio,
  plannedMinutes,
  habitsDone,
  totalHabits,
  nextTask,
  onNavigate,
  onOpenSchedule,
}: {
  today: string;
  openCount: number;
  totalCount: number;
  completionRatio: number;
  plannedMinutes: number;
  habitsDone: number;
  totalHabits: number;
  nextTask?: { task: Task; reason: string } | null;
  onNavigate?: (view: string) => void;
  onOpenSchedule?: () => void;
}) {
  const [modeOverride, setModeOverride] = useState<BriefingMode>('auto');

  const currentHour = new Date().getHours();
  const activeMode = useMemo(() => {
    if (modeOverride !== 'auto') return modeOverride;
    if (currentHour >= 5 && currentHour < 12) return 'morning';
    if (currentHour >= 12 && currentHour < 18) return 'midday';
    return 'evening';
  }, [modeOverride, currentHour]);

  const overdueTasks = useLiveQuery(
    () => db.tasks.filter(t => t.status !== 'Submitted/Done' && !!t.dueDate && t.dueDate < today).toArray(),
    [today]
  ) ?? [];

  const focusLogs = useLiveQuery(
    () => db.focusLogs.filter(l => l.startedAt?.slice(0, 10) === today && l.mode === 'focus').toArray(),
    [today]
  ) ?? [];
  const focusMinutesLogged = focusLogs.reduce((sum, l) => sum + (l.durationMinutes || 0), 0);

  // 1-Click Roll Over unfinished tasks to tomorrow
  const rollOverOverdue = async () => {
    if (overdueTasks.length === 0) {
      toast('No overdue tasks to roll over.', 'info');
      return;
    }
    const tomorrow = addDays(today, 1);
    try {
      await db.transaction('rw', db.tasks, async () => {
        for (const t of overdueTasks) {
          await db.tasks.update(t.id, { dueDate: tomorrow, updatedAt: new Date().toISOString() });
        }
      });
      toast(`Rolled over ${overdueTasks.length} task${overdueTasks.length === 1 ? '' : 's'} to tomorrow`, 'success');
    } catch {
      toast('Could not roll over tasks.', 'error');
    }
  };

  // 1-Click Log Daily Summary to Journal
  const logSummaryToJournal = async () => {
    try {
      const summaryDoc = await generateDailySummaryDoc(today);
      const pages = await db.pages.toArray();
      let journalPage = pages.find(p => p.title.toLowerCase().includes('daily') || p.title.toLowerCase().includes('journal'));
      if (!journalPage) {
        journalPage = await createPage({ title: 'Daily Journal' });
      }

      // Check if an entry for today already exists on this page
      const existing = await db.journalEntries
        .where('pageId')
        .equals(journalPage.id)
        .filter(e => e.date === today)
        .first();

      if (existing) {
        await db.journalEntries.put({
          ...existing,
          content: summaryDoc,
          updatedAt: new Date().toISOString(),
        });
        toast('Updated today’s entry in Daily Journal', 'success');
      } else {
        await db.journalEntries.add({
          id: `entry-${Date.now()}`,
          pageId: journalPage.id,
          date: today,
          content: summaryDoc,
          plainText: `Daily Log for ${today}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        toast('Logged daily summary to Daily Journal', 'success');
      }

      if (onNavigate) {
        onNavigate('pages');
      }
    } catch (err) {
      console.error(err);
      toast('Could not log summary to journal.', 'error');
    }
  };

  return (
    <div className="atelier-card rounded-3xl p-5 sm:p-7 overflow-hidden">
      {/* Mode Controls & Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="index-chip text-fg-subtle flex items-center gap-1.5">
              {activeMode === 'morning' && <Sunrise size={12} className="text-amber-500" />}
              {activeMode === 'midday' && <Sun size={12} className="text-amber-400" />}
              {activeMode === 'evening' && <Moon size={12} className="text-indigo-400" />}
              <span>{activeMode.toUpperCase()} BRIEFING</span>
            </span>

            {/* Mode override pills */}
            <div className="flex items-center p-0.5 rounded-lg bg-surface-2 border border-line text-[10px] font-mono">
              <button
                onClick={() => setModeOverride('auto')}
                className={`px-1.5 py-0.5 rounded transition ${modeOverride === 'auto' ? 'bg-inv text-on-inv font-semibold' : 'text-fg-muted hover:text-fg'}`}
              >
                Auto
              </button>
              <button
                onClick={() => setModeOverride('morning')}
                className={`px-1.5 py-0.5 rounded transition ${activeMode === 'morning' && modeOverride !== 'auto' ? 'bg-inv text-on-inv font-semibold' : 'text-fg-muted hover:text-fg'}`}
              >
                Morning
              </button>
              <button
                onClick={() => setModeOverride('midday')}
                className={`px-1.5 py-0.5 rounded transition ${activeMode === 'midday' && modeOverride !== 'auto' ? 'bg-inv text-on-inv font-semibold' : 'text-fg-muted hover:text-fg'}`}
              >
                Midday
              </button>
              <button
                onClick={() => setModeOverride('evening')}
                className={`px-1.5 py-0.5 rounded transition ${activeMode === 'evening' && modeOverride !== 'auto' ? 'bg-inv text-on-inv font-semibold' : 'text-fg-muted hover:text-fg'}`}
              >
                Evening
              </button>
            </div>
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-fg leading-none">
            {activeMode === 'morning' && 'Good morning. Make today count.'}
            {activeMode === 'midday' && 'Midday Execution. Stay in flow.'}
            {activeMode === 'evening' && 'Evening Wrap-Up & Reflection.'}
          </h1>

          <p className="text-xs sm:text-sm text-fg-muted">
            {new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())}
            {activeMode === 'morning' && plannedMinutes > 0 && ` · ${formatDuration(plannedMinutes)} planned across ${openCount} open tasks`}
            {activeMode === 'midday' && ` · ${totalCount - openCount} completed · ${openCount} remaining`}
            {activeMode === 'evening' && ` · ${formatDuration(focusMinutesLogged)} logged in deep focus today`}
          </p>
        </div>

        {/* Metric Summary Rings */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
          <div className="rounded-2xl border border-line bg-surface-2 p-3.5 flex items-center gap-3">
            <Ring value={completionRatio} size={38} stroke={4}>
              <span className="text-[10px] font-mono font-bold">{Math.round(completionRatio * 100)}%</span>
            </Ring>
            <div>
              <div className="text-lg font-bold font-mono tabular-nums leading-none">
                {totalCount > 0 ? (
                  <>
                    {totalCount - openCount}
                    <span className="text-fg-muted">/{totalCount}</span>
                  </>
                ) : (
                  '-'
                )}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-fg-subtle mt-1">Completed</div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface-2 p-3.5">
            <div className="flex items-center justify-between text-fg-muted">
              <span className="text-[10px] font-mono uppercase tracking-wider">Planned</span>
              <Clock3 size={13} className="text-accent-text" />
            </div>
            <div className="text-lg font-bold font-mono tabular-nums mt-1.5">
              {openCount ? formatDuration(plannedMinutes) : '0m'}
            </div>
            <div className="text-[10px] text-fg-subtle font-mono">{openCount} open tasks</div>
          </div>

          <div className="rounded-2xl border border-line bg-surface-2 p-3.5">
            <div className="flex items-center justify-between text-fg-muted">
              <span className="text-[10px] font-mono uppercase tracking-wider">Habits</span>
              <Flame size={13} className="text-amber-500" />
            </div>
            <div className="text-lg font-bold font-mono tabular-nums mt-1.5">
              {habitsDone}/{totalHabits}
            </div>
            <div className="text-[10px] text-fg-subtle font-mono">done today</div>
          </div>

          {onNavigate && (
            <button
              onClick={() => onNavigate('review')}
              className="rounded-2xl border border-line bg-surface-2 hover:bg-hover p-3.5 text-left transition flex flex-col justify-between group keycap"
            >
              <div className="flex items-center justify-between w-full text-fg-muted">
                <span className="text-[10px] font-mono uppercase tracking-wider">Reflection</span>
                <Trophy size={13} className="text-accent-text group-hover:scale-110 transition-transform" />
              </div>
              <div className="flex items-center justify-between w-full mt-1.5">
                <span className="text-xs font-semibold text-fg">Weekly Review</span>
                <ArrowUpRight size={14} className="text-fg-muted" />
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Action Tray according to active mode */}
      <div className="mt-5 pt-4 border-t border-line/70 flex flex-wrap items-center justify-between gap-3">
        {activeMode === 'morning' && (
          <>
            <div className="flex items-center gap-2 text-xs text-fg-soft">
              <Sparkles size={14} className="text-accent-text shrink-0" />
              <span>Morning kickoff: Review priorities, review your focus block, and time-block open tasks.</span>
            </div>
            <div className="flex items-center gap-2">
              {onOpenSchedule && (
                <button
                  onClick={onOpenSchedule}
                  className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover flex items-center gap-1.5 transition keycap"
                >
                  <Zap size={13} /> Time-Block Day
                </button>
              )}
            </div>
          </>
        )}

        {activeMode === 'midday' && (
          <>
            <div className="flex items-center gap-2 text-xs text-fg-soft">
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              <span>
                {openCount > 0
                  ? `${openCount} tasks left on the docket. Maintain momentum on your primary goal.`
                  : 'All scheduled tasks completed for today. Great execution!'}
              </span>
            </div>
            {nextTask && (
              <button
                onClick={() => focusOnTask(nextTask.task)}
                className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover flex items-center gap-1.5 transition keycap"
              >
                Focus Next: {nextTask.task.title.slice(0, 20)}… <ArrowRight size={13} />
              </button>
            )}
          </>
        )}

        {activeMode === 'evening' && (
          <>
            <div className="flex items-center gap-2 text-xs text-fg-soft">
              <Moon size={14} className="text-indigo-400 shrink-0" />
              <span>
                Day complete. Review accomplishments, roll over remaining tasks, and log your reflection.
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {overdueTasks.length > 0 && (
                <button
                  onClick={() => void rollOverOverdue()}
                  className="h-8 px-3 rounded-xl border border-line bg-surface hover:bg-hover text-xs font-medium text-fg flex items-center gap-1.5 transition keycap"
                  title="Move unfinished tasks to tomorrow"
                >
                  <AlarmClock size={13} className="text-amber-500" /> Roll Over ({overdueTasks.length})
                </button>
              )}
              <button
                onClick={() => void logSummaryToJournal()}
                className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover flex items-center gap-1.5 transition keycap"
              >
                <FileText size={13} /> Log Summary to Journal
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
