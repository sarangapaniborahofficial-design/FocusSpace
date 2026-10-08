import { useLiveQuery } from 'dexie-react-hooks';
import { Pause, Play, RotateCcw, Settings2, TimerReset, X, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { db } from '../db/db';
import { useToday } from '../lib/hooks';
import {
  DEFAULT_DURATIONS, MODES, MODE_LABELS, SESSIONS_PER_CYCLE, formatClock, isSoundOn, setSoundOn, timer, useTimer,
  type Durations,
} from '../lib/timer';
import { addDays, formatDuration, toISODate } from '../lib/utils';

/**
 * The timer itself lives in lib/timer.ts and keeps running when this view is unmounted.
 * Attach a task with the "Focus" buttons on task cards.
 */
export function Pomodoro() {
  const s = useTimer();
  const today = useToday();
  const taskId = s.taskId;

  const task = useLiveQuery(async () => (taskId ? db.tasks.get(taskId) : undefined), [taskId]);
  const taskLogs = useLiveQuery(async () => (taskId ? db.focusLogs.where('taskId').equals(taskId).toArray() : []), [taskId]) ?? [];
  const recentLogs = useLiveQuery(() => db.focusLogs.where('startedAt').aboveOrEqual(addDays(today, -1)).toArray(), [today]) ?? [];

  const [customizing, setCustomizing] = useState(false);
  const [draft, setDraft] = useState<Durations>(s.durations);
  const [sound, setSound] = useState(isSoundOn);

  const totalMs = s.durations[s.mode] * 60_000;
  const progress = Math.max(0, Math.min(1, 1 - s.remainingMs / totalMs));

  const focusToday = recentLogs
    .filter(l => l.mode === 'focus' && toISODate(new Date(l.endedAt || l.startedAt)) === today)
    .reduce((sum, l) => sum + l.durationMinutes, 0);
  const taskActual = taskLogs.filter(l => l.mode === 'focus').reduce((sum, l) => sum + l.durationMinutes, 0);
  const estimate = task?.estimatedDuration ?? 0;

  const openCustomize = () => { setDraft(s.durations); setSound(isSoundOn()); setCustomizing(v => !v); };
  const apply = () => {
    timer.applyDurations(draft);
    setSoundOn(sound);
    setCustomizing(false);
  };

  return (
    <section className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-[var(--card-bg)] shadow-sm p-5 relative">
      <div className="absolute top-4 right-4 text-zinc-400 cursor-pointer hover:text-zinc-600"><MoreHorizontal size={18}/></div>
      
      <div className="flex">
        {/* Left Side */}
        <div className="flex-1 flex flex-col justify-between">
          <h2 className="font-semibold text-lg mb-6">Pomodoro Timer</h2>
          
          <div className="text-4xl font-bold tracking-tight mb-6 text-zinc-800 dark:text-zinc-100">{formatClock(s.remainingMs)}</div>
          
          <div className="flex gap-2">
            <button onClick={() => timer.toggle()} className="h-8 px-4 rounded-lg bg-[var(--accent)]/30 text-[var(--text-primary)] dark:text-zinc-100 text-sm font-medium flex items-center gap-2">
              {s.running ? <Pause size={14}/> : <Play size={14}/>} {s.running ? 'Pause' : 'Play'}
            </button>
            <button onClick={() => timer.reset()} className="h-8 px-4 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
              <RotateCcw size={14} /> Stop
            </button>
          </div>
        </div>
        
        {/* Right Side */}
        <div className="w-[120px] flex flex-col items-center shrink-0 border-l border-zinc-100 dark:border-zinc-800 pl-5">
           <div className="relative size-20 mb-3">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                 <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="12" className="text-zinc-100 dark:text-zinc-800" />
                 <circle cx="50" cy="50" r="40" fill="none" stroke="var(--accent-peach)" strokeWidth="12" strokeDasharray={`${progress * 251} 251`} className="transition-all duration-1000" strokeLinecap="round" />
              </svg>
              {/* Inner square */}
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="size-4 rounded-sm bg-[var(--accent)]/50 border border-[var(--accent)]"></div>
              </div>
           </div>
           <div className="text-xs font-medium text-center text-zinc-800 dark:text-zinc-200 whitespace-nowrap">Focus Session #{s.cycle}</div>
           <div className="text-[10px] text-zinc-500 mt-1 whitespace-nowrap">Status: <span className="text-emerald-600 dark:text-emerald-400 font-medium capitalize">{s.mode}</span></div>
        </div>
      </div>
    </section>
  );
}
