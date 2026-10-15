import { Orbit, Pause, Play } from 'lucide-react';
import { MODE_LABELS, formatClock, timer, useTimer } from '../lib/timer';
import { Ring } from './ui';

/** Compact orbital telemetry pill docked bottom-right outside the Home view. */
export function MiniTimer({ onOpen }: { onOpen: () => void }) {
  const s = useTimer();
  if (!s.running && !s.startedAt && !s.taskId) return null;
  const total = s.durations[s.mode] * 60_000;
  const progress = 1 - s.remainingMs / total;

  return (
    <div className="pop-in fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-2xl border border-line-strong bg-surface/95 backdrop-blur-xl pl-3.5 pr-2.5 py-2 shadow-pop keycap">
      <button onClick={onOpen} className="flex items-center gap-3 text-left min-w-0 rounded-xl" aria-label="Open focus view">
        <Ring value={progress} size={34} stroke={3.5}>
          <Orbit size={12} className="text-accent-text" />
        </Ring>
        <span className="min-w-0">
          <span className="block font-mono text-sm font-bold leading-none tabular-nums text-fg">{formatClock(s.remainingMs)}</span>
          <span className="block text-[10px] font-mono uppercase tracking-wider text-fg-muted mt-1 max-w-[160px] truncate">
            {s.taskTitle ?? MODE_LABELS[s.mode]}
          </span>
        </span>
      </button>
      <button
        onClick={() => timer.toggle()}
        aria-label={s.running ? 'Pause timer' : 'Start timer'}
        className="size-9 rounded-xl bg-accent text-accent-fg grid place-items-center hover:bg-accent-hover keycap"
      >
        {s.running ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}
      </button>
    </div>
  );
}
