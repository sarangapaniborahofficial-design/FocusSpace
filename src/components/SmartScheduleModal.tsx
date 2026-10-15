import { AlertTriangle, ArrowRight, Calendar, Check, Clock3, Coffee, Sparkles, X, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  applySmartScheduleOrder,
  applySmartScheduleTimeBlocks,
  deferTasksToTomorrow,
  generateSmartSchedule,
  type ScheduledBlock,
  type SlotType,
} from '../lib/smartScheduler';
import { toast } from '../lib/toast';
import { formatDuration, priorityTone } from '../lib/utils';
import type { Category, Task } from '../types';

export function SmartScheduleModal({
  open,
  onClose,
  tasks,
  today,
  categories,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  today: string;
  categories: Category[];
  onApplied?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  // Compute plan on open
  const plan = useMemo(() => {
    return generateSmartSchedule(tasks, today);
  }, [tasks, today]);

  if (!open) return null;

  const slotBadge = (type: SlotType) => {
    switch (type) {
      case 'quick-win':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"><Zap size={11} /> Quick Win</span>;
      case 'deep-work':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/15 text-purple-600 dark:text-purple-400"><Sparkles size={11} /> Deep Work</span>;
      case 'fixed-anchor':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-400"><Calendar size={11} /> Fixed Time</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface-3 text-fg-muted">Standard</span>;
    }
  };

  const handleApplyOrder = async () => {
    setBusy(true);
    try {
      await applySmartScheduleOrder(plan);
      toast('Tasks reordered to optimized schedule!', 'success');
      onApplied?.();
      onClose();
    } catch {
      toast('Failed to apply schedule', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleTimeBlock = async () => {
    setBusy(true);
    try {
      await applySmartScheduleTimeBlocks(plan);
      await applySmartScheduleOrder(plan);
      toast('Day time-blocked and scheduled into calendar!', 'success');
      onApplied?.();
      onClose();
    } catch {
      toast('Failed to time-block day', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDefer = async (taskId: string) => {
    try {
      await deferTasksToTomorrow([taskId], today);
      toast('Task deferred to tomorrow', 'info');
      onApplied?.();
    } catch {
      toast('Failed to defer task', 'error');
    }
  };

  // Combine blocks and buffers for a chronological timeline display
  const timelineItems: ({ kind: 'task'; block: ScheduledBlock } | { kind: 'buffer'; startTime: string; endTime: string; duration: number; reason: string })[] = [];

  const allEvents = [
    ...plan.blocks.map(b => ({ kind: 'task' as const, time: b.startTime, block: b })),
    ...plan.buffers.map(buf => ({ kind: 'buffer' as const, time: buf.startTime, startTime: buf.startTime, endTime: buf.endTime, duration: buf.durationMinutes, reason: buf.reason })),
  ].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl border border-line bg-surface shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-line flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="size-6 rounded-md bg-accent text-accent-fg grid place-items-center">
                <Zap size={14} />
              </span>
              <h2 className="font-semibold text-lg">AI Smart Schedule Plan</h2>
            </div>
            <p className="text-xs text-fg-muted mt-1">
              Sequenced by cognitive load, quick-win momentum, and deadline urgency.
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg text-fg-muted hover:text-fg hover:bg-hover grid place-items-center transition"
          >
            <X size={17} />
          </button>
        </div>

        {/* Plan Highlights Metrics Bar */}
        <div className="px-5 py-3 border-b border-line bg-surface-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <span className="font-medium text-fg">
              {plan.blocks.length} Tasks · {formatDuration(plan.totalWorkMinutes)}
            </span>
            <span className="text-fg-muted flex items-center gap-1">
              <Coffee size={13} /> {formatDuration(plan.totalBufferMinutes)} buffers
            </span>
          </div>
          <div className="font-medium text-fg flex items-center gap-1">
            <Clock3 size={13} className="text-accent" /> Est. Finish: <span className="font-mono">{plan.projectedEndTime}</span>
          </div>
        </div>

        {/* Overbooked Warning Alert */}
        {plan.isOverbooked && (
          <div className="mx-5 mt-4 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
              <div>
                <div className="font-semibold">Day is over capacity by ~{formatDuration(plan.overbookedMinutes)}</div>
                <p className="text-[11px] opacity-90 mt-0.5">
                  You have more tasks than realistic working hours today. Consider pushing low-priority tasks:
                </p>
                {plan.suggestedDeferrals.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {plan.suggestedDeferrals.map(t => (
                      <button
                        key={t.id}
                        onClick={() => void handleDefer(t.id)}
                        className="h-6 px-2.5 rounded-md border border-amber-500/40 bg-surface/80 hover:bg-surface text-[11px] font-medium flex items-center gap-1 transition"
                      >
                        Push “{t.title}” to tomorrow <ArrowRight size={10} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Timeline */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          {allEvents.length === 0 ? (
            <div className="py-12 text-center text-sm text-fg-muted">
              No open tasks available to schedule for today.
            </div>
          ) : (
            allEvents.map((item, idx) => {
              if (item.kind === 'buffer') {
                return (
                  <div
                    key={`buf-${idx}`}
                    className="flex items-center gap-3 pl-3 pr-4 py-1.5 rounded-lg border border-dashed border-line/60 bg-surface/40 text-xs text-fg-subtle"
                  >
                    <span className="font-mono text-[11px] text-fg-muted w-24 shrink-0">
                      {item.startTime} – {item.endTime}
                    </span>
                    <Coffee size={13} className="text-fg-subtle shrink-0" />
                    <span className="italic">{item.reason} ({item.duration}m)</span>
                  </div>
                );
              }

              const { block } = item;
              const cat = categories.find(c => c.id === block.task.categoryId);

              return (
                <div
                  key={block.id}
                  className="p-3 rounded-xl border border-line bg-surface-2 hover:bg-hover transition-colors flex items-start gap-3"
                >
                  {/* Time Chip */}
                  <div className="w-24 shrink-0 pt-0.5">
                    <span className="font-mono text-xs font-semibold text-fg">
                      {block.startTime} – {block.endTime}
                    </span>
                    <div className="text-[10px] text-fg-muted mt-0.5">
                      {block.durationMinutes}m focus
                    </div>
                  </div>

                  {/* Task Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-fg truncate">
                        {block.task.title}
                      </span>
                      {slotBadge(block.slotType)}
                      {cat && (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-medium"
                          style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                        >
                          {cat.name}
                        </span>
                      )}
                      {block.task.priority && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${priorityTone(block.task.priority)}`}>
                          {block.task.priority}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                      💡 {block.rationale}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-line bg-surface flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-xl text-sm font-medium text-fg-muted hover:text-fg hover:bg-hover transition"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyOrder}
              disabled={busy || plan.blocks.length === 0}
              className="h-9 px-4 rounded-xl border border-line bg-surface-2 hover:bg-hover text-sm font-medium text-fg flex items-center gap-1.5 transition disabled:opacity-40"
              title="Reorders Today's list in this exact sequence"
            >
              <Check size={14} /> Apply Order Only
            </button>
            <button
              onClick={handleTimeBlock}
              disabled={busy || plan.blocks.length === 0}
              className="h-9 px-4 rounded-xl bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover flex items-center gap-1.5 transition keycap disabled:opacity-40"
              title="Reorders and assigns start times into your Calendar"
            >
              <Zap size={14} /> Time-Block My Day
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
