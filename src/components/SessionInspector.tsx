import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Mic, Volume2, VolumeX } from 'lucide-react';
import { db } from '../db/db';
import { toggleHabitDay } from '../lib/habitActions';
import { openTaskEditor } from '../lib/taskEditor';
import { timer, useTimer } from '../lib/timer';
import { isoToday } from '../lib/utils';
import { soundscape, useSoundscape } from '../lib/soundscape';
import { useDictation } from '../voice/useDictation';
import type { Task, Subtask } from '../types';

export function SessionInspector({
  selectedTaskId,
}: {
  selectedTaskId?: string | null;
}) {
  const today = isoToday();
  const timerState = useTimer();

  const activeTask = useLiveQuery(
    () => (timerState.taskId ? db.tasks.get(timerState.taskId) : undefined),
    [timerState.taskId]
  );

  const selectedTask = useLiveQuery(
    () => (selectedTaskId ? db.tasks.get(selectedTaskId) : undefined),
    [selectedTaskId]
  );

  const allTasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const habits = useLiveQuery(() => db.habits.filter(h => h.active).toArray(), []) ?? [];
  const catMap = React.useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  // Current session focus task: active timer task OR user-selected task OR first open task
  const currentTask: Task | null = React.useMemo(() => {
    if (activeTask) return activeTask;
    if (selectedTask) return selectedTask;
    const open = allTasks.filter(t => t.status !== 'Submitted/Done');
    return open[0] || allTasks[0] || null;
  }, [activeTask, selectedTask, allTasks]);

  const category = currentTask ? catMap.get(currentTask.categoryId) : null;
  const subtasks = currentTask?.subtasks || [];
  const completedCount = subtasks.filter(s => s.completed).length;
  const progressPct = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;
  const habitsDone = habits.filter(h => h.completions.includes(today)).length;

  const currentSoundscape = useSoundscape();
  const { isListening, toggle: toggleDictation } = useDictation();

  const handleToggleSubtask = async (subtaskId: string) => {
    if (!currentTask) return;
    const updated = subtasks.map(s =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    await db.tasks.update(currentTask.id, {
      subtasks: updated,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleScratchpadChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!currentTask) return;
    const val = e.target.value;
    await db.tasks.update(currentTask.id, {
      notes: val,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <aside className="w-[320px] xl:w-[340px] shrink-0 h-full rounded-2xl bg-surface border border-line overflow-y-auto p-5 flex flex-col justify-between select-none gap-4">
      {/* Top Section: Active Task, Subtasks & Scratchpad */}
      <div className="space-y-4">
        {/* Header */}
        <div className="text-[11px] font-mono uppercase tracking-wider text-fg-muted font-bold">
          This session
        </div>

        {currentTask ? (
          <>
            <div>
              <div
                onClick={() => openTaskEditor(currentTask.id)}
                className="font-bold text-base sm:text-lg text-fg truncate cursor-pointer hover:underline underline-offset-4"
              >
                {currentTask.title}
              </div>
              <div className="text-xs text-fg-muted mt-0.5 truncate flex items-center gap-1.5">
                {category && (
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                )}
                <span>{category ? category.name : 'General'}</span>
                <span>·</span>
                <span>#{currentTask.projectTag || 'Focus'}</span>
                <span>·</span>
                <span>{currentTask.estimatedDuration || 30}m</span>
              </div>
            </div>

            {/* Subtasks Box */}
            <div className="bg-surface-2 border border-line rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between items-center text-xs text-fg-muted">
                <span className="font-medium">Subtasks</span>
                <span className="font-mono text-fg font-semibold">
                  {completedCount}/{subtasks.length}
                </span>
              </div>
              <div className="h-1.5 bg-surface border border-line rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {subtasks.length > 0 && (
                <div className="space-y-1.5 pt-1 max-h-32 overflow-y-auto">
                  {subtasks.slice(0, 5).map(s => (
                    <div
                      key={s.id}
                      onClick={() => handleToggleSubtask(s.id)}
                      className="flex items-center gap-2 text-xs cursor-pointer text-fg-muted hover:text-fg"
                    >
                      <button
                        type="button"
                        className={`size-3.5 rounded border flex items-center justify-center shrink-0 transition ${
                          s.completed
                            ? 'bg-accent text-accent-fg border-accent'
                            : 'border-line-strong hover:border-line'
                        }`}
                      >
                        {s.completed && <Check size={10} strokeWidth={3} />}
                      </button>
                      <span className={`truncate ${s.completed ? 'line-through opacity-60' : ''}`}>
                        {s.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scratchpad */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-fg-muted font-bold">
                  Scratchpad
                </div>
                <button
                  onClick={toggleDictation}
                  className={`text-[11px] flex items-center gap-1 cursor-pointer transition ${
                    isListening ? 'text-rose-500 animate-pulse font-bold' : 'text-fg-muted hover:text-accent-text'
                  }`}
                >
                  <Mic size={11} />
                  <span>{isListening ? 'Listening…' : 'Dictate'}</span>
                </button>
              </div>
              <textarea
                value={currentTask.notes || ''}
                onChange={handleScratchpadChange}
                placeholder="Jot a thought. It saves to the task."
                rows={4}
                className="w-full bg-surface-2 border border-line rounded-xl p-3 text-xs text-fg placeholder:text-fg-subtle outline-none focus:border-line-strong transition resize-none leading-relaxed"
              />
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-xs text-fg-muted">
            No task active. Select or add a task to begin.
          </div>
        )}
      </div>

      {/* Bottom Section: Ambient Audio & Daily Habits */}
      <div className="space-y-3 pt-3 border-t border-line">
        {/* Ambient Audio Pill */}
        <button
          onClick={() => soundscape.toggle()}
          className="w-full flex items-center justify-between text-xs text-fg-muted hover:text-fg cursor-pointer transition p-2.5 rounded-xl bg-surface-2 border border-line hover:bg-hover"
        >
          <div className="flex items-center gap-2">
            {currentSoundscape.isPlaying ? (
              <Volume2 size={14} className="text-accent-text animate-pulse" />
            ) : (
              <VolumeX size={14} className="text-fg-muted" />
            )}
            <span className="font-medium">
              Ambient: {currentSoundscape.type === 'off' ? 'Brown noise' : currentSoundscape.type}
            </span>
          </div>
          <span className="font-mono text-[11px] text-fg font-semibold">
            {currentSoundscape.isPlaying ? `${Math.round(currentSoundscape.volume * 100)}%` : 'Off'}
          </span>
        </button>

        {/* Daily Habits */}
        {habits.length > 0 && (
          <div>
            <div className="flex items-center justify-between text-[11px] text-fg-muted mb-2 font-mono uppercase tracking-wider font-bold">
              <span>Daily habits</span>
              <span>
                {habitsDone}/{habits.length}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {habits.map(h => {
                const done = h.completions.includes(today);
                return (
                  <button
                    key={h.id}
                    onClick={() => void toggleHabitDay(h.id, today)}
                    className={`px-2 py-1.5 rounded-lg border text-left text-xs truncate flex items-center gap-1.5 cursor-pointer transition ${
                      done
                        ? 'border-accent/40 bg-accent/15 text-accent-text font-semibold'
                        : 'border-line bg-surface-2 text-fg-muted hover:text-fg hover:bg-hover'
                    }`}
                  >
                    <span
                      className="size-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: h.color }}
                    />
                    <span className="truncate">{h.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
