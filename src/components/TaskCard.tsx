import { Check, ChevronDown, ChevronRight, Clock3, Copy, GripVertical, Pencil, Play, Repeat, Trash2 } from 'lucide-react';
import { memo, useRef, useState, type DragEvent, type TouchEvent } from 'react';
import { openTaskEditor } from '../lib/taskEditor';
import { changeStatus, duplicateTask } from '../lib/tasks';
import { isoToday, priorityTone, relativeDay } from '../lib/utils';
import type { Category, Status, Task } from '../types';

const STATUSES: Status[] = ['To Do', 'In Progress', 'Submitted/Done'];
const STATUS_LABEL: Record<Status, string> = { 'To Do': 'To do', 'In Progress': 'In progress', 'Submitted/Done': 'Done' };

const SWIPE_THRESHOLD = 75;

export const TaskCard = memo(function TaskCard({
  task,
  category,
  onUpdate,
  onDelete,
  onStart,
  dragging,
  onDragStart,
  onDragEnd,
  selectable,
  selected,
  onToggleSelect,
}: {
  task: Task;
  category?: Category;
  onUpdate: (t: Task) => void;
  onDelete: () => void;
  onStart: () => void;
  dragging?: boolean;
  onDragStart?: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: DragEvent<HTMLDivElement>) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  const isDone = task.status === 'Submitted/Done';
  const doneCount = task.subtasks.filter(s => s.completed).length;
  const pct = task.subtasks.length ? Math.round((doneCount / task.subtasks.length) * 100) : 0;
  const overdue = !isDone && !!task.dueDate && task.dueDate < isoToday();
  const spineColor = category?.color ?? task.colorCode ?? 'var(--c-accent)';

  const toggleSubtask = (id: string) =>
    onUpdate({
      ...task,
      subtasks: task.subtasks.map(s => (s.id === id ? { ...s, completed: !s.completed } : s)),
      updatedAt: new Date().toISOString(),
    });

  const handleTouchStart = (e: TouchEvent) => {
    if (selectable) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    isHorizontalSwipeRef.current = null;
    setIsSwiping(false);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!touchStartRef.current || selectable) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        isHorizontalSwipeRef.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    if (isHorizontalSwipeRef.current) {
      let x = deltaX;
      if (deltaX > SWIPE_THRESHOLD) {
        x = SWIPE_THRESHOLD + (deltaX - SWIPE_THRESHOLD) * 0.25;
      } else if (deltaX < -SWIPE_THRESHOLD) {
        x = -SWIPE_THRESHOLD + (deltaX + SWIPE_THRESHOLD) * 0.25;
      }
      setSwipeX(x);
      setIsSwiping(true);
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current || selectable) return;

    if (swipeX >= SWIPE_THRESHOLD) {
      void changeStatus(task, isDone ? 'To Do' : 'Submitted/Done');
    } else if (swipeX <= -SWIPE_THRESHOLD) {
      onDelete();
    }

    setSwipeX(0);
    setIsSwiping(false);
    touchStartRef.current = null;
    isHorizontalSwipeRef.current = null;
  };

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Background action reveal on mobile swipe */}
      {isSwiping && swipeX !== 0 && (
        <div
          className={`absolute inset-0 flex items-center transition-colors pointer-events-none rounded-2xl ${
            swipeX > 0
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 justify-start pl-4'
              : 'bg-rose-500/15 text-rose-500 justify-end pr-4'
          }`}
        >
          {swipeX > 0 ? (
            <div className={`flex items-center gap-1.5 text-xs transition-transform ${Math.abs(swipeX) >= SWIPE_THRESHOLD ? 'scale-110 font-bold' : 'scale-95 opacity-80'}`}>
              <Check size={18} strokeWidth={2.5} />
              <span>{isDone ? 'Mark To-Do' : 'Complete'}</span>
            </div>
          ) : (
            <div className={`flex items-center gap-1.5 text-xs transition-transform ${Math.abs(swipeX) >= SWIPE_THRESHOLD ? 'scale-110 font-bold' : 'scale-95 opacity-80'}`}>
              <span>Delete</span>
              <Trash2 size={18} strokeWidth={2.5} />
            </div>
          )}
        </div>
      )}

      {/* Foreground Tactile Ticket Card */}
      <div
        draggable={!!onDragStart}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        style={{
          transform: `translate3d(${swipeX}px, 0, 0)`,
          transition: isSwiping ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)',
          willChange: isSwiping ? 'transform' : 'auto',
        }}
        className={`group relative rounded-2xl border border-line bg-surface-2 hover:bg-hover hover:border-line-strong transition-[background-color,border-color,box-shadow,opacity] duration-150 overflow-hidden pl-1.5 ${
          onDragStart ? 'cursor-grab active:cursor-grabbing' : ''
        } ${dragging ? 'opacity-40 scale-[0.99]' : ''}`}
      >
        {/* Left Category Color Spine */}
        <span
          className="absolute inset-y-2 left-1 w-1 rounded-full"
          style={{ backgroundColor: spineColor }}
          aria-hidden="true"
        />

        <div className="p-3.5 py-3">
          <div className="flex items-start gap-3">
            {onDragStart && !selectable && (
              <span className="mt-1 text-fg-subtle/50 group-hover:text-fg-muted hidden sm:inline-flex shrink-0" aria-hidden="true">
                <GripVertical size={14} />
              </span>
            )}

            {selectable ? (
              <button
                onClick={onToggleSelect}
                aria-label={selected ? `Deselect “${task.title}”` : `Select “${task.title}”`}
                aria-pressed={!!selected}
                className={`mt-0.5 size-5 rounded-lg border grid place-items-center shrink-0 ${
                  selected ? 'bg-accent border-[var(--accent)] text-accent-fg' : 'border-line-strong hover:border-fg-muted bg-surface'
                }`}
              >
                {selected && <Check size={12} strokeWidth={2.5} />}
              </button>
            ) : (
              <button
                onClick={() => void changeStatus(task, isDone ? 'To Do' : 'Submitted/Done')}
                aria-label={isDone ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`}
                aria-pressed={isDone}
                className={`mt-0.5 size-5 rounded-lg border grid place-items-center shrink-0 transition-transform ${
                  isDone ? 'bg-accent border-[var(--accent)] text-accent-fg' : 'border-line-strong hover:border-fg-muted bg-surface'
                }`}
              >
                {isDone && <Check size={12} strokeWidth={2.5} />}
              </button>
            )}

            <div className="min-w-0 flex-1">
              <button
                onClick={() => openTaskEditor(task.id)}
                title="Edit task"
                className={`flex items-center gap-1.5 w-full text-left font-semibold text-sm sm:text-[15px] break-words hover:underline underline-offset-2 decoration-fg-subtle ${
                  isDone ? 'line-through text-fg-subtle' : 'text-fg'
                }`}
              >
                {task.recurrence && <Repeat size={12} className="shrink-0 text-accent-text" aria-label="Repeats" />}
                <span className="min-w-0 break-words">{task.title}</span>
              </button>

              <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] font-mono text-fg-muted">
                {category && (
                  <span
                    className="px-2 py-0.5 rounded-md font-semibold"
                    style={{ backgroundColor: `${category.color}18`, color: category.color }}
                  >
                    {category.name}
                  </span>
                )}
                {task.projectTag && (
                  <span className="px-2 py-0.5 rounded-md bg-surface border border-line text-fg-soft">
                    #{task.projectTag}
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-md ${priorityTone(task.priority)}`}>{task.priority}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-line">
                  <Clock3 size={11} />
                  {task.estimatedDuration}m
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md ${
                    overdue ? 'bg-rose-500/15 text-rose-500 font-semibold' : 'text-fg-subtle'
                  }`}
                >
                  {relativeDay(task.dueDate)}
                  {task.dueTime ? ` · ${task.dueTime}` : ''}
                  {overdue ? ' · OVERDUE' : ''}
                </span>
              </div>
            </div>

            {/* Action Dock */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={onStart}
                aria-label={`Focus on “${task.title}”`}
                title="Focus on this task"
                className="size-8 rounded-xl grid place-items-center text-fg-subtle hover:text-accent-fg hover:bg-accent md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-all"
              >
                <Play size={14} fill="currentColor" />
              </button>
              <button
                onClick={() => openTaskEditor(task.id)}
                aria-label={`Edit “${task.title}”`}
                title="Edit task"
                className="size-8 rounded-xl grid place-items-center text-fg-subtle hover:text-fg hover:bg-surface md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-all"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => void duplicateTask(task)}
                aria-label={`Duplicate “${task.title}”`}
                title="Duplicate"
                className="size-8 rounded-xl grid place-items-center text-fg-subtle hover:text-fg hover:bg-surface md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-all"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-label={open ? 'Hide details' : 'Show details'}
                className="size-8 rounded-xl grid place-items-center text-fg-subtle hover:text-fg hover:bg-surface"
              >
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <button
                onClick={onDelete}
                aria-label={`Delete “${task.title}”`}
                className="size-8 rounded-xl grid place-items-center text-fg-subtle hover:text-rose-500 hover:bg-rose-500/10"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {task.subtasks.length > 0 && (
            <div className="mt-3 pl-8">
              <div className="flex justify-between text-[10px] font-mono text-fg-subtle mb-1">
                <span>
                  SUBTASKS {doneCount}/{task.subtasks.length}
                </span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 bg-surface rounded-full overflow-hidden border border-line/60">
                <div
                  className="h-full bg-accent rounded-full transition-[width] duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {open && (
            <div className="mt-4 pl-8 pt-3 border-t border-line space-y-3">
              <div className="flex gap-1 p-1 rounded-xl bg-surface border border-line w-fit" role="group" aria-label="Status">
                {STATUSES.map(status => (
                  <button
                    key={status}
                    onClick={() => task.status !== status && void changeStatus(task, status)}
                    aria-pressed={task.status === status}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                      task.status === status ? 'bg-inv text-on-inv font-semibold' : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    {STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
              {task.subtasks.length > 0 && (
                <div className="space-y-1.5">
                  {task.subtasks.map(s => (
                    <button
                      key={s.id}
                      onClick={() => toggleSubtask(s.id)}
                      className="w-full flex items-center gap-2 text-left text-xs sm:text-sm text-fg-muted hover:text-fg py-0.5"
                    >
                      <span
                        className={`size-4 rounded border grid place-items-center shrink-0 ${
                          s.completed ? 'bg-accent border-accent text-accent-fg' : 'border-line-strong bg-surface'
                        }`}
                      >
                        {s.completed && <Check size={10} />}
                      </span>
                      <span className={s.completed ? 'line-through text-fg-subtle' : ''}>{s.title}</span>
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={onStart}
                className="text-xs font-mono text-accent-text hover:underline flex items-center gap-1.5"
              >
                <Play size={12} fill="currentColor" /> Focus this task
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
