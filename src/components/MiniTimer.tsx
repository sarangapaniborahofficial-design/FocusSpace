import { Pause, Play } from 'lucide-react';
import { MODE_LABELS, formatClock, timer, useTimer } from '../lib/timer';
import { Ring } from './ui';

/** Compact timer docked bottom-right so a running session stays visible outside the Home view. */
export function MiniTimer({ onOpen }: { onOpen: () => void }) {
  const s = useTimer();
  if (!s.running && !s.startedAt && !s.taskId) return null;
  const total = s.durations[s.mode] * 60_000;
  const progress = 1 - s.remainingMs / total;

  return (
    <div className="pop-in fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-zinc-200 bg-white/95 backdrop-blur pl-3 pr-2 py-2 shadow-2xl shadow-black/40">
      <button onClick={onOpen} className="flex items-center gap-3 text-left min-w-0 rounded-full" aria-label="Open focus view">
        <Ring value={progress} size={32} stroke={3.5} />
        <span className="min-w-0">
          <span className="block font-mono text-sm leading-none tabular-nums">{formatClock(s.remainingMs)}</span>
          <span className="block text-[11px] text-zinc-400 mt-1 max-w-[150px] truncate">{s.taskTitle ?? MODE_LABELS[s.mode]}</span>
        </span>
      </button>
      <button onClick={() => timer.toggle()} aria-label={s.running ? 'Pause timer' : 'Start timer'} className="size-9 rounded-full bg-[var(--accent)] text-[#121214] grid place-items-center hover:bg-white">
        {s.running ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}
      </button>
    </div>
  );
}
