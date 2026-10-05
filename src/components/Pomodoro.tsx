import { useLiveQuery } from 'dexie-react-hooks';
import { Pause, Play, RotateCcw, Settings2, TimerReset, X } from 'lucide-react';
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
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[.18em] text-zinc-300">Pomodoro</div>
          <div className="text-sm text-zinc-500 mt-1">
            {taskId ? <>Working on <span className="text-zinc-700">{task?.title ?? s.taskTitle}</span></> : 'Pick “Focus” on a task to attach time to it.'}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={openCustomize} aria-label="Customize timer durations" aria-expanded={customizing} title="Customize timer durations" className="size-8 rounded-lg grid place-items-center text-zinc-300 hover:text-zinc-700 hover:bg-zinc-100">
            <Settings2 size={15} />
          </button>
          {taskId && <button onClick={() => timer.setTask(undefined)} className="text-xs text-zinc-300 hover:text-zinc-600 px-1">Clear</button>}
        </div>
      </div>

      {taskId && estimate > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-[11px] text-zinc-300 mb-1">
            <span>{formatDuration(taskActual)} focused</span>
            <span>{formatDuration(estimate)} estimated</span>
          </div>
          <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-[width] duration-500 ${taskActual > estimate ? 'bg-amber-400' : 'bg-zinc-500'}`} style={{ width: `${Math.min(100, (taskActual / estimate) * 100)}%` }} />
          </div>
        </div>
      )}

      {customizing && (
        <div className="pop-in mb-5 rounded-xl border border-zinc-100 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium text-zinc-700">Timer settings</div>
              <div className="text-xs text-zinc-300 mt-0.5">Durations can be 1–240 minutes. Applying resets the current timer.</div>
            </div>
            <button onClick={() => setCustomizing(false)} aria-label="Close timer settings" className="text-zinc-300 hover:text-zinc-600"><X size={15} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map(mode => (
              <label key={mode} className="text-xs text-zinc-400">
                <span className="block mb-1">{MODE_LABELS[mode]}</span>
                <div className="flex items-center rounded-lg border border-zinc-100 bg-zinc-50 px-2">
                  <input type="number" min={1} max={240} value={draft[mode]} onChange={e => setDraft(d => ({ ...d, [mode]: Number(e.target.value) }))} className="w-full bg-transparent py-2 text-sm text-zinc-700 outline-none" />
                  <span className="text-[10px] text-zinc-200">min</span>
                </div>
              </label>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-zinc-500 cursor-pointer">
            <input type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)} className="accent-zinc-500" />
            Play a chime when a timer ends
          </label>
          <div className="flex justify-between items-center mt-3">
            <button onClick={() => setDraft({ ...DEFAULT_DURATIONS })} className="text-xs text-zinc-300 hover:text-zinc-600">Restore 25 / 5 / 15</button>
            <button onClick={apply} className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-white">Apply</button>
          </div>
        </div>
      )}

      <div className="flex gap-1 p-1 bg-white rounded-lg mb-5" role="tablist" aria-label="Timer mode">
        {MODES.map(mode => (
          <button key={mode} role="tab" aria-selected={s.mode === mode} onClick={() => timer.setMode(mode)} className={`flex-1 py-1.5 rounded-md text-xs transition-colors ${s.mode === mode ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-300 hover:text-zinc-600'}`}>
            {MODE_LABELS[mode]} · {s.durations[mode]}m
          </button>
        ))}
      </div>

      <div className="relative mx-auto size-48 rounded-full grid place-items-center" style={{ background: `conic-gradient(var(--ring-fill) ${progress * 360}deg, var(--ring-track) 0deg)` }}>
        <div className="size-44 rounded-full bg-white grid place-items-center">
          <div className="text-center">
            <div role="timer" aria-label={`${MODE_LABELS[s.mode]} time remaining`} className="font-mono text-4xl tracking-tight tabular-nums">{formatClock(s.remainingMs)}</div>
            <div className="text-[10px] uppercase tracking-[.18em] text-zinc-300 mt-1">{s.running ? MODE_LABELS[s.mode] : s.startedAt ? 'Paused' : MODE_LABELS[s.mode]}</div>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-2 mt-5">
        <button onClick={() => timer.reset()} aria-label="Reset timer" title="Reset" className="size-10 rounded-full border border-zinc-100 grid place-items-center text-zinc-400 hover:text-white">
          <RotateCcw size={16} />
        </button>
        <button onClick={() => timer.toggle()} aria-label={s.running ? 'Pause timer' : 'Start timer'} title={s.running ? 'Pause (Space)' : 'Start (Space)'} className="size-12 rounded-full bg-[var(--accent)] text-[#121214] grid place-items-center hover:bg-white">
          {s.running ? <Pause size={19} /> : <Play size={19} fill="currentColor" />}
        </button>
        <button onClick={() => timer.nextMode()} aria-label="Skip to next timer" title="Next timer" className="size-10 rounded-full border border-zinc-100 grid place-items-center text-zinc-400 hover:text-white">
          <TimerReset size={16} />
        </button>
      </div>

      <div className="mt-5 flex items-center justify-between text-xs text-zinc-300">
        <div className="flex items-center gap-1.5" title={`${Math.min(s.cycle, SESSIONS_PER_CYCLE)} of ${SESSIONS_PER_CYCLE} sessions before a long break`}>
          {Array.from({ length: SESSIONS_PER_CYCLE }, (_, i) => <span key={i} className={`size-1.5 rounded-full ${i < s.cycle ? 'dot-on' : 'dot-off'}`} />)}
        </div>
        <span>{focusToday > 0 ? `${formatDuration(focusToday)} focused today` : 'No focus time logged today'}</span>
      </div>
    </div>
  );
}
