import { useLiveQuery } from 'dexie-react-hooks';
import { Headphones, Pause, Play, RotateCcw, Settings2, TimerReset, Volume2, X } from 'lucide-react';
import { useState } from 'react';
import { db } from '../db/db';
import { SOUNDSCAPES, soundscape, useSoundscape } from '../lib/soundscape';
import { useToday } from '../lib/hooks';
import {
  DEFAULT_DURATIONS,
  MODES,
  MODE_LABELS,
  SESSIONS_PER_CYCLE,
  formatClock,
  isSoundOn,
  setSoundOn,
  timer,
  useTimer,
  type Durations,
} from '../lib/timer';
import { addDays, formatDuration, toISODate } from '../lib/utils';

const DIAL_SIZE = 212;
const DIAL_STROKE = 8;
const DIAL_R = (DIAL_SIZE - DIAL_STROKE * 2) / 2;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * (DIAL_R - 6);

const PRECOMPUTED_TICKS = Array.from({ length: 36 }, (_, i) => {
  const angle = (i * 10 * Math.PI) / 180;
  return {
    i,
    threshold: i / 36,
    x1: DIAL_SIZE / 2 + (DIAL_R + 6) * Math.cos(angle),
    y1: DIAL_SIZE / 2 + (DIAL_R + 6) * Math.sin(angle),
    x2: DIAL_SIZE / 2 + (DIAL_R + (i % 3 === 0 ? 1 : 3)) * Math.cos(angle),
    y2: DIAL_SIZE / 2 + (DIAL_R + (i % 3 === 0 ? 1 : 3)) * Math.sin(angle),
    strokeWidth: i % 3 === 0 ? 2 : 1,
  };
});

export function Pomodoro() {
  const s = useTimer();
  const sc = useSoundscape();
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

  const openCustomize = () => {
    setDraft(s.durations);
    setSound(isSoundOn());
    setCustomizing(v => !v);
  };
  const apply = () => {
    timer.applyDurations(draft);
    setSoundOn(sound);
    setCustomizing(false);
  };

  return (
    <div className="atelier-card rounded-3xl p-5 overflow-hidden relative">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[.18em] text-fg-muted font-mono">Pomodoro</div>
          <div className="text-sm text-fg-muted mt-1">
            {taskId ? (
              <>
                Working on <span className="text-fg font-medium">{task?.title ?? s.taskTitle}</span>
              </>
            ) : (
              'Pick “Focus” on a task to attach time to it.'
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={openCustomize}
            aria-label="Customize timer durations"
            aria-expanded={customizing}
            title="Customize timer durations"
            className="size-8 rounded-xl border border-line bg-surface-2 grid place-items-center text-fg-muted hover:text-fg hover:bg-hover keycap"
          >
            <Settings2 size={15} />
          </button>
          {taskId && (
            <button
              onClick={() => timer.setTask(undefined)}
              className="h-8 px-2.5 rounded-xl border border-line bg-surface-2 text-xs text-fg-muted hover:text-fg"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {taskId && estimate > 0 && (
        <div className="mb-4 p-3 rounded-2xl bg-surface-2 border border-line">
          <div className="flex justify-between text-[11px] text-fg-muted mb-1.5 font-mono">
            <span>{formatDuration(taskActual)} focused</span>
            <span>{formatDuration(estimate)} estimated</span>
          </div>
          <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                taskActual > estimate ? 'bg-amber-400' : 'bg-accent'
              }`}
              style={{ width: `${Math.min(100, (taskActual / estimate) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {customizing && (
        <div className="pop-in mb-5 rounded-2xl border border-line bg-surface-2 p-4 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium text-fg">Timer settings</div>
              <div className="text-xs text-fg-muted mt-0.5">Durations can be 1–240 minutes. Applying resets the current timer.</div>
            </div>
            <button onClick={() => setCustomizing(false)} aria-label="Close timer settings" className="text-fg-muted hover:text-fg">
              <X size={15} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map(mode => (
              <label key={mode} className="text-xs text-fg-muted">
                <span className="block mb-1 truncate">{MODE_LABELS[mode]}</span>
                <div className="flex items-center rounded-xl border border-line bg-surface px-2">
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={draft[mode]}
                    onChange={e => setDraft(d => ({ ...d, [mode]: Number(e.target.value) }))}
                    className="w-full bg-transparent py-1.5 text-sm font-mono text-fg outline-none"
                  />
                  <span className="text-[10px] text-fg-subtle">min</span>
                </div>
              </label>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-fg-muted cursor-pointer">
            <input type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)} className="accent-accent" />
            Play a chime when a timer ends
          </label>
          <div className="flex justify-between items-center mt-3 pt-2 border-t border-line">
            <button onClick={() => setDraft({ ...DEFAULT_DURATIONS })} className="text-xs text-fg-muted hover:text-fg">
              Restore 25 / 5 / 15
            </button>
            <button onClick={apply} className="rounded-xl bg-accent text-accent-fg px-3 py-1.5 text-xs font-semibold hover:bg-accent-hover keycap">
              Apply
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-surface-2 rounded-2xl border border-line mb-5" role="tablist" aria-label="Timer mode">
        {MODES.map(mode => (
          <button
            key={mode}
            role="tab"
            aria-selected={s.mode === mode}
            onClick={() => timer.setMode(mode)}
            className={`py-1.5 px-2 rounded-xl text-xs transition-all ${
              s.mode === mode
                ? 'bg-surface text-fg font-semibold shadow-xs border border-line'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            {MODE_LABELS[mode]} · {s.durations[mode]}m
          </button>
        ))}
      </div>

      {/* Tactile 36-Tick Rotary Dial */}
      <div className="relative mx-auto flex items-center justify-center my-2" style={{ width: DIAL_SIZE, height: DIAL_SIZE }}>
        <svg width={DIAL_SIZE} height={DIAL_SIZE} className="-rotate-90" aria-hidden="true">
          {PRECOMPUTED_TICKS.map(t => (
            <line
              key={t.i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.threshold <= progress ? 'var(--ring-fill)' : 'var(--c-line-strong)'}
              strokeWidth={t.strokeWidth}
              strokeLinecap="round"
            />
          ))}
          <circle
            cx={DIAL_SIZE / 2}
            cy={DIAL_SIZE / 2}
            r={DIAL_R - 6}
            fill="none"
            strokeWidth={DIAL_STROKE}
            style={{ stroke: 'var(--ring-track)' }}
          />
          <circle
            cx={DIAL_SIZE / 2}
            cy={DIAL_SIZE / 2}
            r={DIAL_R - 6}
            fill="none"
            strokeWidth={DIAL_STROKE}
            strokeLinecap="round"
            strokeDasharray={DIAL_CIRCUMFERENCE}
            strokeDashoffset={DIAL_CIRCUMFERENCE * (1 - progress)}
            style={{
              stroke: 'var(--ring-fill)',
              transition: 'stroke-dashoffset .3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </svg>

        <div className="absolute inset-5 rounded-full bg-surface-2/80 border border-line grid place-items-center shadow-inner">
          <div className="text-center px-2">
            <div
              role="timer"
              aria-label={`${MODE_LABELS[s.mode]} time remaining`}
              className="font-mono text-4xl font-bold tracking-tight tabular-nums text-fg"
            >
              {formatClock(s.remainingMs)}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-fg-muted mt-1.5">
              {s.running ? MODE_LABELS[s.mode] : s.startedAt ? 'Paused' : MODE_LABELS[s.mode]}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center items-center gap-3 mt-5">
        <button
          onClick={() => timer.reset()}
          aria-label="Reset timer"
          title="Reset"
          className="size-11 rounded-2xl border border-line bg-surface-2 grid place-items-center text-fg-muted hover:text-fg hover:bg-hover keycap"
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={() => timer.toggle()}
          aria-label={s.running ? 'Pause timer' : 'Start timer'}
          title={s.running ? 'Pause (Space)' : 'Start (Space)'}
          className="h-12 px-6 rounded-2xl bg-accent text-accent-fg font-semibold text-sm flex items-center gap-2 hover:bg-accent-hover keycap"
        >
          {s.running ? (
            <>
              <Pause size={18} />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play size={18} fill="currentColor" />
              <span>Start</span>
            </>
          )}
        </button>
        <button
          onClick={() => timer.nextMode()}
          aria-label="Skip to next timer"
          title="Next timer"
          className="size-11 rounded-2xl border border-line bg-surface-2 grid place-items-center text-fg-muted hover:text-fg hover:bg-hover keycap"
        >
          <TimerReset size={16} />
        </button>
      </div>

      {/* Procedural Soundscape Bar */}
      <div className="mt-4 p-3 rounded-2xl bg-surface-2 border border-line">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-fg">
            <Headphones size={13} className={sc.isPlaying ? 'text-accent-text animate-pulse' : 'text-fg-subtle'} />
            <span>Soundscape</span>
          </div>
          {sc.type !== 'off' && (
            <div className="flex items-center gap-1.5 text-xs text-fg-muted">
              <Volume2 size={12} className="text-fg-subtle" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={sc.volume}
                onChange={e => soundscape.setVolume(parseFloat(e.target.value))}
                className="w-16 h-1 accent-accent rounded-lg cursor-pointer"
                title={`Volume: ${Math.round(sc.volume * 100)}%`}
              />
              <span className="text-[10px] font-mono w-6 text-right tabular-nums">{Math.round(sc.volume * 100)}%</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {SOUNDSCAPES.map(s => {
            const active = sc.type === s.id;
            return (
              <button
                key={s.id}
                onClick={() => soundscape.setType(s.id)}
                title={s.desc}
                className={`py-1.5 px-1 rounded-xl text-[11px] font-medium text-center transition ${
                  active
                    ? 'bg-accent text-accent-fg font-semibold keycap shadow-sm'
                    : 'bg-surface text-fg-muted hover:text-fg hover:bg-hover'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 pt-3.5 border-t border-line flex items-center justify-between text-xs text-fg-muted">
        <div
          className="flex items-center gap-1.5"
          title={`${Math.min(s.cycle, SESSIONS_PER_CYCLE)} of ${SESSIONS_PER_CYCLE} sessions before a long break`}
        >
          {Array.from({ length: SESSIONS_PER_CYCLE }, (_, i) => (
            <span key={i} className={`w-2.5 h-1.5 rounded-full ${i < s.cycle ? 'dot-on' : 'dot-off'}`} />
          ))}
        </div>
        <span>{focusToday > 0 ? `${formatDuration(focusToday)} focused today` : 'No focus time logged today'}</span>
      </div>
    </div>
  );
}
