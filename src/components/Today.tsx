import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlarmClock,
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Play,
  Plus,
  Sparkles,
  Zap,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { db } from '../db/db';
import { useToday } from '../lib/hooks';
import { openTaskEditor } from '../lib/taskEditor';
import { changeStatus } from '../lib/tasks';
import { focusOnTask } from '../lib/timer';
import { toast } from '../lib/toast';
import { buildTodayPlan } from '../lib/todayPlan';
import { formatDuration, relativeDay, uid } from '../lib/utils';
import type { Task } from '../types';
import { SmartScheduleModal } from './SmartScheduleModal';

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
  onSelectTask,
  selectedTaskId,
}: {
  onQuickAdd: () => void;
  onNavigate?: (view: string) => void;
  onSelectTask?: (taskId: string) => void;
  selectedTaskId?: string | null;
}) {
  const today = useToday();
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const cats = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const catMap = useMemo(() => new Map(cats.map(c => [c.id, c])), [cats]);

  const plan = useMemo(() => buildTodayPlan(tasks ?? [], today, nowTime()), [tasks, today]);
  const openCount = plan.overdue.length + plan.today.length;
  const totalCount = openCount + plan.done.length;

  const [queueTab, setQueueTab] = useState<QueueTab>('all');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [inlineNewTask, setInlineNewTask] = useState('');

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
    <div className="flex-1 flex flex-col justify-between p-6 min-h-full select-none text-fg font-['Space_Grotesk',sans-serif]">
      {/* Top Section: Header, Filter Pills, Spotlight, Table */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Header Greeting & Metadata */}
        <div className="shrink-0 mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">
            {getGreeting()}
          </h1>
          <div className="text-sm text-fg-muted mt-1 flex flex-wrap items-center gap-2">
            <span>{formattedDate}</span>
            <span>·</span>
            <span className="font-mono text-fg font-semibold">{openCount} open tasks</span>
            <span>·</span>
            <span className="font-mono text-accent-text font-semibold">
              {formatDuration(plan.plannedMinutes)} planned
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button
              onClick={() => setQueueTab('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition ${
                queueTab === 'all'
                  ? 'bg-inv text-on-inv font-semibold shadow-xs'
                  : 'bg-surface-2 border border-line text-fg hover:bg-hover'
              }`}
            >
              All {totalCount}
            </button>
            <button
              onClick={() => setQueueTab('today')}
              className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition ${
                queueTab === 'today'
                  ? 'bg-inv text-on-inv font-semibold shadow-xs'
                  : 'bg-surface-2 border border-line text-fg hover:bg-hover'
              }`}
            >
              Due today {plan.today.length}
            </button>
            <button
              onClick={() => setQueueTab('overdue')}
              className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition ${
                queueTab === 'overdue'
                  ? 'bg-inv text-on-inv font-semibold shadow-xs'
                  : 'bg-surface-2 border border-line text-fg hover:bg-hover'
              }`}
            >
              Overdue {plan.overdue.length}
            </button>
            <button
              onClick={() => setQueueTab('done')}
              className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition ${
                queueTab === 'done'
                  ? 'bg-inv text-on-inv font-semibold shadow-xs'
                  : 'bg-surface-2 border border-line text-fg hover:bg-hover'
              }`}
            >
              Done {plan.done.length}
            </button>

            {openCount > 0 && (
              <button
                onClick={() => setScheduleOpen(true)}
                className="ml-auto px-3 py-1 rounded-full bg-surface-2 border border-line hover:bg-hover text-xs font-medium text-accent-text flex items-center gap-1 cursor-pointer transition"
              >
                <Zap size={12} />
                <span>Smart Schedule</span>
              </button>
            )}
          </div>
        </div>

        {/* Up Next Banner Spotlight Card */}
        {plan.next && (
          <div className="shrink-0 mb-4 bg-surface-2 border border-line rounded-xl p-3.5 sm:p-4 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-mono uppercase tracking-wider text-accent-text font-bold">
                Up next {plan.next.reason ? `· ${plan.next.reason}` : ''}
              </div>
              <div
                onClick={() => {
                  onSelectTask?.(plan.next!.task.id);
                  openTaskEditor(plan.next!.task.id);
                }}
                className="font-bold text-base sm:text-lg text-fg truncate mt-0.5 cursor-pointer hover:underline underline-offset-4"
              >
                {plan.next.task.title}
              </div>
            </div>
            <button
              onClick={() => handleStartTask(plan.next!.task)}
              className="shrink-0 h-9 px-4 rounded-full bg-accent text-accent-fg font-semibold keycap text-xs sm:text-sm flex items-center gap-1.5 hover:bg-accent-hover cursor-pointer transition shadow-xs"
            >
              <Play size={13} fill="currentColor" />
              <span>Start focus</span>
            </button>
          </div>
        )}

        {/* Task Table Header */}
        <div className="grid grid-cols-[1fr_120px_90px_100px] gap-3 px-3 py-2 text-[11px] uppercase tracking-wider font-mono text-fg-muted border-b border-line shrink-0">
          <span>Task</span>
          <span>Category</span>
          <span>Priority</span>
          <span className="text-right">Due</span>
        </div>

        {/* Task Table Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-line/60 min-h-0">
          {taskRows.length === 0 ? (
            <div className="text-center py-12 text-fg-muted text-sm">
              No tasks in this view.
            </div>
          ) : (
            taskRows.map(t => {
              const cat = catMap.get(t.categoryId);
              const isDone = t.status === 'Submitted/Done';
              const isSelected = selectedTaskId === t.id;
              const isTaskOverdue = t.dueDate && t.dueDate < today && !isDone;

              return (
                <div
                  key={t.id}
                  onClick={() => onSelectTask?.(t.id)}
                  className={`grid grid-cols-[1fr_120px_90px_100px] gap-3 px-3 py-2.5 rounded-xl items-center text-sm cursor-pointer transition ${
                    isSelected
                      ? 'bg-surface-2 text-fg font-medium'
                      : 'text-fg-soft hover:bg-hover hover:text-fg'
                  }`}
                >
                  {/* Task Title + Checkbox */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={async e => {
                        e.stopPropagation();
                        await handleToggleTaskStatus(t);
                      }}
                      className={`size-4 rounded border flex items-center justify-center shrink-0 transition ${
                        isDone
                          ? 'bg-accent text-accent-fg border-accent'
                          : 'border-line-strong hover:border-line'
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
                        isDone ? 'line-through text-fg-muted' : 'text-fg'
                      }`}
                    >
                      {t.title}
                    </span>
                  </div>

                  {/* Category */}
                  <div className="truncate text-xs flex items-center gap-1.5 text-fg-muted">
                    {cat && (
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                    )}
                    <span className="truncate">{cat ? cat.name : '—'}</span>
                  </div>

                  {/* Priority */}
                  <div className="text-xs">
                    <span
                      className={`font-medium ${
                        t.priority === 'Urgent'
                          ? 'text-rose-500 font-bold'
                          : t.priority === 'High'
                          ? 'text-amber-500 font-semibold'
                          : 'text-fg-muted'
                      }`}
                    >
                      {t.priority}
                    </span>
                  </div>

                  {/* Due Date */}
                  <div className="text-right text-xs font-mono">
                    <span
                      className={
                        isTaskOverdue
                          ? 'text-rose-500 font-semibold'
                          : isDone
                          ? 'text-fg-muted/60 line-through'
                          : 'text-fg-muted'
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
      </div>

      {/* Bottom Area: Input pinned to bottom of Island 2 */}
      <form
        onSubmit={handleInlineCreate}
        className="mt-4 pt-3 border-t border-line shrink-0 flex gap-2"
      >
        <input
          type="text"
          value={inlineNewTask}
          onChange={e => setInlineNewTask(e.target.value)}
          placeholder="Add a task to Today and press Enter..."
          className="flex-1 bg-surface-2 border border-line rounded-xl px-3.5 py-2 text-xs text-fg placeholder:text-fg-subtle outline-none focus:border-line-strong transition"
        />
        <button
          type="submit"
          disabled={!inlineNewTask.trim()}
          className="px-3.5 py-2 rounded-xl bg-accent text-accent-fg font-semibold keycap text-xs flex items-center gap-1 hover:bg-accent-hover transition cursor-pointer disabled:opacity-40"
        >
          <Plus size={14} />
          <span>Add</span>
        </button>
      </form>

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
