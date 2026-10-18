import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlarmClock,
  AlertCircle,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Inbox,
  Mic,
  Play,
  Plus,
  Sparkles,
  Target,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { db } from '../db/db';
import { computeStreaks } from '../lib/analytics';
import { toggleHabitDay } from '../lib/habitActions';
import { useToday } from '../lib/hooks';
import { openTaskEditor } from '../lib/taskEditor';
import { changeStatus, deleteTask } from '../lib/tasks';
import { focusOnTask, timer, useTimer } from '../lib/timer';
import { toast } from '../lib/toast';
import { buildTodayPlan } from '../lib/todayPlan';
import { formatDuration, isoToday, relativeDay, uid } from '../lib/utils';
import { soundscape, useSoundscape } from '../lib/soundscape';
import { useDictation } from '../voice/useDictation';
import type { Category, Subtask, Task } from '../types';
import { DailyBriefing } from './DailyBriefing';
import { SmartScheduleModal } from './SmartScheduleModal';
import { Ring } from './ui';

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

type QueueTab = 'all' | 'today' | 'overdue' | 'done';

export function Today({
  onQuickAdd,
  onNavigate,
}: {
  onQuickAdd: () => void;
  onNavigate?: (view: string) => void;
}) {
  const today = useToday();
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const habits = useLiveQuery(() => db.habits.filter(h => h.active).toArray(), []) ?? [];
  const cats = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const catMap = useMemo(() => new Map(cats.map(c => [c.id, c])), [cats]);

  const plan = useMemo(() => buildTodayPlan(tasks ?? [], today, nowTime()), [tasks, today]);
  const openCount = plan.overdue.length + plan.today.length;
  const totalCount = openCount + plan.done.length;
  const completionRatio = totalCount > 0 ? plan.done.length / totalCount : 0;
  const habitsDone = habits.filter(h => h.completions.includes(today)).length;

  const [queueTab, setQueueTab] = useState<QueueTab>('all');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [inlineNewTask, setInlineNewTask] = useState('');

  const timerState = useTimer();
  const activeTaskFromTimer = useLiveQuery(
    () => (timerState.taskId ? db.tasks.get(timerState.taskId) : undefined),
    [timerState.taskId]
  );

  // Inspector Focus Task: active timer task OR user-selected task OR next suggested task OR first open task
  const inspectorTask = useMemo(() => {
    if (activeTaskFromTimer) return activeTaskFromTimer;
    if (selectedTaskId && tasks) {
      const found = tasks.find(t => t.id === selectedTaskId);
      if (found) return found;
    }
    if (plan.next?.task) return plan.next.task;
    return plan.today[0] || plan.overdue[0] || tasks?.[0] || null;
  }, [activeTaskFromTimer, selectedTaskId, tasks, plan]);

  const inspectorCat = inspectorTask ? catMap.get(inspectorTask.categoryId) : null;
  const inspectorSubtasks = inspectorTask?.subtasks || [];
  const completedSubtasksCount = inspectorSubtasks.filter(s => s.completed).length;
  const subtaskProgressPct =
    inspectorSubtasks.length > 0
      ? Math.round((completedSubtasksCount / inspectorSubtasks.length) * 100)
      : 0;

  const handleToggleSubtask = async (subtaskId: string) => {
    if (!inspectorTask) return;
    const updated = inspectorSubtasks.map(s =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    await db.tasks.update(inspectorTask.id, {
      subtasks: updated,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleScratchpadChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!inspectorTask) return;
    const val = e.target.value;
    await db.tasks.update(inspectorTask.id, {
      notes: val,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleStartTask = (t: Task) => {
    focusOnTask(t);
    toast(`Focus started on "${t.title}"`, 'success');
  };

  const handleToggleTaskStatus = async (t: Task) => {
    const nextStatus = t.status === 'Submitted/Done' ? 'To Do' : 'Submitted/Done';
    await changeStatus(t, nextStatus);
  };

  const handleInlineCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = inlineNewTask.trim();
    if (!title) return;
    const targetCat = cats[0];
    if (!targetCat) return;

    const newTask: Task = {
      id: uid(),
      title,
      categoryId: targetCat.id,
      projectTag: targetCat.name,
      priority: 'Medium',
      status: 'To Do',
      estimatedDuration: 30,
      dueDate: today,
      dueTime: '',
      subtasks: [],
      notes: '',
      colorCode: targetCat.color,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.tasks.add(newTask);
    toast(`Added "${title}" to Today`, 'success');
    setInlineNewTask('');
  };

  const currentSoundscape = useSoundscape();
  const { isListening, toggle: toggleDictation } = useDictation();

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  // Filtered task rows
  const taskRows = useMemo(() => {
    if (queueTab === 'today') return plan.today;
    if (queueTab === 'overdue') return plan.overdue;
    if (queueTab === 'done') return plan.done;
    return [...plan.overdue, ...plan.today, ...plan.done];
  }, [queueTab, plan]);

  return (
    <div className="w-full h-full flex flex-col xl:flex-row gap-2 overflow-hidden select-none font-['Space_Grotesk',sans-serif]">
      {/* Center Island: Island 2 (Main Today Tasks & Spotlight) */}
      <div className="flex-1 min-w-0 bg-[#111411] border border-[#2a302a]/70 rounded-2xl p-5 sm:p-6 flex flex-col overflow-y-auto relative shadow-pop">
        {/* Subtle Top Gradient Header matching screen_1.html */}
        <div className="shrink-0 mb-4 pb-2">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#f2f4ef]">
            {getGreeting()}
          </div>
          <div className="text-sm text-[#a3aaa0] mt-1 flex flex-wrap items-center gap-2">
            <span>{formattedDate}</span>
            <span>·</span>
            <span className="font-mono text-[#f2f4ef] font-semibold">{openCount} open tasks</span>
            <span>·</span>
            <span className="font-mono text-[#c8ff29]">{formatDuration(plan.plannedMinutes)} planned</span>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button
              onClick={() => setQueueTab('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition ${
                queueTab === 'all'
                  ? 'bg-[#f2f4ef] text-[#0a0c0a]'
                  : 'bg-[#1d221d] text-[#a3aaa0] hover:text-[#f2f4ef]'
              }`}
            >
              All {totalCount}
            </button>
            <button
              onClick={() => setQueueTab('today')}
              className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition ${
                queueTab === 'today'
                  ? 'bg-[#f2f4ef] text-[#0a0c0a]'
                  : 'bg-[#1d221d] text-[#a3aaa0] hover:text-[#f2f4ef]'
              }`}
            >
              Due today {plan.today.length}
            </button>
            <button
              onClick={() => setQueueTab('overdue')}
              className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition ${
                queueTab === 'overdue'
                  ? 'bg-[#f2f4ef] text-[#0a0c0a]'
                  : 'bg-[#1d221d] text-[#a3aaa0] hover:text-[#f2f4ef]'
              }`}
            >
              Overdue {plan.overdue.length}
            </button>
            <button
              onClick={() => setQueueTab('done')}
              className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition ${
                queueTab === 'done'
                  ? 'bg-[#f2f4ef] text-[#0a0c0a]'
                  : 'bg-[#1d221d] text-[#a3aaa0] hover:text-[#f2f4ef]'
              }`}
            >
              Done {plan.done.length}
            </button>

            {openCount > 0 && (
              <button
                onClick={() => setScheduleOpen(true)}
                className="ml-auto px-3 py-1 rounded-full bg-[#1d221d] hover:bg-[#2a302a] text-xs font-medium text-[#c8ff29] flex items-center gap-1 cursor-pointer transition border border-[#2a302a]"
              >
                <Zap size={12} />
                <span>Smart Schedule</span>
              </button>
            )}
          </div>
        </div>

        {/* Up Next Banner Spotlight Card */}
        {plan.next && (
          <div className="shrink-0 mb-5 bg-[#1d221d] border border-[#2a302a] rounded-xl p-3.5 sm:p-4 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#c8ff29] font-bold">
                Up next {plan.next.reason ? `· ${plan.next.reason}` : ''}
              </div>
              <div
                onClick={() => {
                  setSelectedTaskId(plan.next!.task.id);
                  openTaskEditor(plan.next!.task.id);
                }}
                className="font-bold text-base sm:text-lg text-[#f2f4ef] truncate mt-0.5 cursor-pointer hover:underline underline-offset-4"
              >
                {plan.next.task.title}
              </div>
            </div>
            <button
              onClick={() => handleStartTask(plan.next!.task)}
              className="shrink-0 h-9 px-4 rounded-full bg-[#c8ff29] hover:bg-[#b8ef1d] text-[#0a0c0a] font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition shadow-sm"
            >
              <Play size={13} fill="currentColor" />
              <span>Start focus</span>
            </button>
          </div>
        )}

        {/* Task Table Header */}
        <div className="grid grid-cols-[1fr_120px_90px_100px] gap-3 px-3 py-2 text-[11px] uppercase tracking-wider font-mono text-[#7f877c] border-b border-[#2a302a]/60 shrink-0">
          <span>Task</span>
          <span>Category</span>
          <span>Priority</span>
          <span className="text-right">Due</span>
        </div>

        {/* Task Table Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#2a302a]/40">
          {taskRows.length === 0 ? (
            <div className="text-center py-12 text-[#7f877c] text-sm">
              No tasks in this view.
            </div>
          ) : (
            taskRows.map(t => {
              const cat = catMap.get(t.categoryId);
              const isDone = t.status === 'Submitted/Done';
              const isSelected = inspectorTask?.id === t.id;
              const isTaskOverdue = t.dueDate && t.dueDate < today && !isDone;

              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTaskId(t.id)}
                  className={`grid grid-cols-[1fr_120px_90px_100px] gap-3 px-3 py-3 rounded-lg items-center text-sm cursor-pointer transition ${
                    isSelected
                      ? 'bg-[#1d221d] text-[#f2f4ef]'
                      : 'text-[#a3aaa0] hover:bg-[#161a16] hover:text-[#f2f4ef]'
                  }`}
                >
                  {/* Task Column with Checkbox */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={async e => {
                        e.stopPropagation();
                        await handleToggleTaskStatus(t);
                      }}
                      className={`size-4 rounded border flex items-center justify-center shrink-0 transition ${
                        isDone
                          ? 'bg-[#c8ff29] border-[#c8ff29] text-[#0a0c0a]'
                          : 'border-[#7f877c] hover:border-[#f2f4ef]'
                      }`}
                    >
                      {isDone && <Check size={11} strokeWidth={3} />}
                    </button>
                    <span
                      onClick={e => {
                        e.stopPropagation();
                        openTaskEditor(t.id);
                      }}
                      className={`truncate font-medium hover:underline underline-offset-2 ${
                        isDone ? 'line-through text-[#7f877c]' : 'text-[#f2f4ef]'
                      }`}
                    >
                      {t.title}
                    </span>
                  </div>

                  {/* Category Column */}
                  <div className="truncate text-xs flex items-center gap-1.5">
                    {cat && (
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                    )}
                    <span className="truncate">{cat ? cat.name : '—'}</span>
                  </div>

                  {/* Priority Column */}
                  <div className="text-xs">
                    <span
                      className={`font-medium ${
                        t.priority === 'Urgent'
                          ? 'text-[#ff6b6b] font-bold'
                          : t.priority === 'High'
                          ? 'text-amber-400'
                          : 'text-[#a3aaa0]'
                      }`}
                    >
                      {t.priority}
                    </span>
                  </div>

                  {/* Due Column */}
                  <div className="text-right text-xs font-mono">
                    <span
                      className={
                        isTaskOverdue
                          ? 'text-[#ff6b6b] font-semibold'
                          : isDone
                          ? 'text-[#7f877c]'
                          : 'text-[#a3aaa0]'
                      }
                    >
                      {isTaskOverdue ? 'Overdue' : t.dueDate ? relativeDay(t.dueDate) : '—'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick Add at bottom */}
        <form onSubmit={handleInlineCreate} className="mt-3 pt-3 border-t border-[#2a302a]/60 shrink-0 flex gap-2">
          <input
            type="text"
            value={inlineNewTask}
            onChange={e => setInlineNewTask(e.target.value)}
            placeholder="Add a task to Today and press Enter..."
            className="flex-1 bg-[#1d221d] border border-[#2a302a] rounded-lg px-3 py-1.5 text-xs text-[#f2f4ef] placeholder-[#7f877c] outline-none focus:border-[#c8ff29]/60 transition"
          />
          <button
            type="submit"
            disabled={!inlineNewTask.trim()}
            className="px-3 py-1.5 rounded-lg bg-[#c8ff29] hover:bg-[#b8ef1d] text-[#0a0c0a] font-bold text-xs cursor-pointer transition disabled:opacity-40"
          >
            <Plus size={14} />
          </button>
        </form>
      </div>

      {/* Right Island: Island 3 (This Session Inspector, Scratchpad & Ambient Sound) */}
      <aside className="w-full xl:w-[320px] shrink-0 bg-[#111411] border border-[#2a302a]/70 rounded-2xl p-5 flex flex-col gap-4 overflow-y-auto shadow-pop">
        {/* Header */}
        <div className="text-[11px] font-mono uppercase tracking-wider text-[#7f877c] font-bold">
          This session
        </div>

        {inspectorTask ? (
          <>
            <div>
              <div
                onClick={() => openTaskEditor(inspectorTask.id)}
                className="font-bold text-lg text-[#f2f4ef] truncate cursor-pointer hover:underline underline-offset-4"
              >
                {inspectorTask.title}
              </div>
              <div className="text-xs text-[#a3aaa0] mt-0.5 truncate">
                {inspectorCat ? inspectorCat.name : 'General'} · #{inspectorTask.projectTag || 'Focus'} ·{' '}
                {inspectorTask.estimatedDuration || 30}m
              </div>
            </div>

            {/* Subtasks Section & Progress Bar */}
            <div className="bg-[#1d221d] border border-[#2a302a] rounded-xl p-3.5 space-y-2.5">
              <div className="flex justify-between items-center text-xs text-[#a3aaa0]">
                <span>Subtasks</span>
                <span className="font-mono text-[#f2f4ef]">
                  {completedSubtasksCount}/{inspectorSubtasks.length}
                </span>
              </div>
              <div className="h-1.5 bg-[#2a302a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#c8ff29] rounded-full transition-all duration-300"
                  style={{ width: `${subtaskProgressPct}%` }}
                />
              </div>

              {inspectorSubtasks.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {inspectorSubtasks.slice(0, 4).map(s => (
                    <div
                      key={s.id}
                      onClick={() => handleToggleSubtask(s.id)}
                      className="flex items-center gap-2 text-xs cursor-pointer text-[#a3aaa0] hover:text-[#f2f4ef]"
                    >
                      <button
                        type="button"
                        className={`size-3.5 rounded border flex items-center justify-center shrink-0 ${
                          s.completed ? 'bg-[#c8ff29] border-[#c8ff29] text-[#0a0c0a]' : 'border-[#7f877c]'
                        }`}
                      >
                        {s.completed && <Check size={10} strokeWidth={3} />}
                      </button>
                      <span className={`truncate ${s.completed ? 'line-through text-[#7f877c]' : ''}`}>
                        {s.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scratchpad with Live Auto-Save to Task Notes */}
            <div className="flex-1 flex flex-col min-h-[140px]">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#7f877c] font-bold">
                  Scratchpad
                </div>
                <button
                  onClick={toggleDictation}
                  className={`text-[11px] flex items-center gap-1 cursor-pointer transition ${
                    isListening ? 'text-rose-400 animate-pulse font-bold' : 'text-[#7f877c] hover:text-[#c8ff29]'
                  }`}
                >
                  <Mic size={11} />
                  <span>{isListening ? 'Listening...' : 'Dictate'}</span>
                </button>
              </div>
              <textarea
                value={inspectorTask.notes || ''}
                onChange={handleScratchpadChange}
                placeholder="Jot a thought. It saves to the task."
                className="flex-1 w-full bg-[#0a0c0a] border border-[#2a302a] rounded-xl p-3 text-xs text-[#f2f4ef] placeholder-[#7f877c] outline-none focus:border-[#c8ff29]/60 transition resize-none leading-relaxed"
              />
            </div>
          </>
        ) : (
          <div className="text-center py-6 text-xs text-[#7f877c]">
            No task active. Select or add a task to begin.
          </div>
        )}

        {/* Ambient Audio Pill */}
        <div className="pt-2 border-t border-[#2a302a]/60">
          <button
            onClick={() => soundscape.toggle()}
            className="w-full flex items-center justify-between text-xs text-[#a3aaa0] hover:text-[#f2f4ef] cursor-pointer transition p-2 rounded-lg bg-[#0a0c0a] border border-[#2a302a]"
          >
            <div className="flex items-center gap-2">
              {currentSoundscape.isPlaying ? (
                <Volume2 size={13} className="text-[#c8ff29]" />
              ) : (
                <VolumeX size={13} className="text-[#7f877c]" />
              )}
              <span>Ambient: {currentSoundscape.type === 'off' ? 'Brown noise' : currentSoundscape.type}</span>
            </div>
            <span className="font-mono text-[11px]">
              {currentSoundscape.isPlaying ? `${Math.round(currentSoundscape.volume * 100)}%` : 'Off'}
            </span>
          </button>
        </div>

        {/* Compact Daily Habits Mini-Checkin */}
        {habits.length > 0 && (
          <div className="pt-2 border-t border-[#2a302a]/60">
            <div className="flex items-center justify-between text-xs text-[#7f877c] mb-2 font-mono uppercase tracking-wider">
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
                        ? 'border-[#c8ff29]/60 bg-[#c8ff29]/10 text-[#f2f4ef]'
                        : 'border-[#2a302a] bg-[#0a0c0a] text-[#7f877c] hover:text-[#f2f4ef]'
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
      </aside>

      <SmartScheduleModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        tasks={[...plan.overdue, ...plan.today]}
        today={today}
        categories={cats}
      />
    </div>
  );
}
