import { Check, ChevronDown, ChevronRight, Clock3, Copy, Pencil, Play, Repeat, Trash2 } from 'lucide-react';
import { useRef, useState, type DragEvent, type TouchEvent } from 'react';
import { openTaskEditor } from '../lib/taskEditor';
import { changeStatus, duplicateTask } from '../lib/tasks';
import { isoToday, priorityTone, relativeDay } from '../lib/utils';
import type { Category, Status, Task } from '../types';

const STATUSES: Status[] = ['To Do', 'In Progress', 'Submitted/Done'];
const STATUS_LABEL: Record<Status, string> = { 'To Do': 'To do', 'In Progress': 'In progress', 'Submitted/Done': 'Done' };

const SWIPE_THRESHOLD = 75;

export function TaskCard({ task, category, onUpdate, onDelete, onStart, dragging, onDragStart, onDragEnd, selectable, selected, onToggleSelect }: {
  task: Task;
  category?: Category;
  onUpdate: (t: Task) => void;
  onDelete: () => void;
  onStart: () => void;
  /** Kanban only: the card is being dragged. */
  dragging?: boolean;
  onDragStart?: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: DragEvent<HTMLDivElement>) => void;
  /** Bulk-select mode: shows a checkbox instead of the done toggle. */
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

  const toggleSubtask = (id: string) =>
    onUpdate({ ...task, subtasks: task.subtasks.map(s => (s.id === id ? { ...s, completed: !s.completed } : s)), updatedAt: new Date().toISOString() });

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
      className="relative rounded-lg overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Background action reveal on mobile swipe */}
      {isSwiping && swipeX !== 0 && (
        <div
          className={`absolute inset-0 flex items-center transition-colors pointer-events-none rounded-lg ${
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

      {/* Foreground task card */}
      <div
        draggable={!!onDragStart}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)',
        }}
        className={`group relative rounded-lg border border-line bg-surface-2 hover:bg-hover transition-colors overflow-hidden ${onDragStart ? 'cursor-grab active:cursor-grabbing' : ''}${dragging ? 'opacity-40' : ''}`}
      >
        <div className="p-3 py-2.5">
          <div className="flex gap-3">
          {selectable ? (
            <button
              onClick={onToggleSelect}
              aria-label={selected ? `Deselect “${task.title}”` : `Select “${task.title}”`}
              aria-pressed={!!selected}
              className={`mt-0.5 size-5 rounded-xl border grid place-items-center shrink-0 ${selected ? 'bg-accent border-[var(--accent)] text-accent-fg' : 'border-line hover:border-fg-muted'}`}
            >
              {selected && <Check size={12} />}
            </button>
          ) : (
            <button
              onClick={() => void changeStatus(task, isDone ? 'To Do' : 'Submitted/Done')}
              aria-label={isDone ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`}
              aria-pressed={isDone}
              className={`mt-0.5 size-5 rounded border grid place-items-center shrink-0 ${isDone ? 'bg-accent border-[var(--accent)] text-fg' : 'border-line hover:border-fg-muted'}`}
            >
              {isDone && <Check size={12} />}
            </button>
          )}

          <div className="min-w-0 flex-1">
            <button onClick={() => openTaskEditor(task.id)} title="Edit task" className={`flex items-center gap-1.5 w-full text-left font-medium break-words hover:underline underline-offset-2 decoration-fg-subtle ${isDone ? 'line-through text-fg-subtle' : 'text-fg'}`}>
              {task.recurrence && <Repeat size={12} className="shrink-0 text-fg-muted" aria-label="Repeats" />}
              <span className="min-w-0 break-words">{task.title}</span>
            </button>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-xs text-fg-muted">
              <span style={{ color: category?.color }}>{category?.name}</span>
              {task.projectTag && <><span>•</span><span>{task.projectTag}</span></>}
              <span>•</span>
              <span className={`px-1.5 py-0.5 rounded ${priorityTone(task.priority)}`}>{task.priority}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Clock3 size={12} />{task.estimatedDuration}m</span>
              <span>•</span>
              <span className={overdue ? 'text-rose-500 font-medium' : ''}>
                {relativeDay(task.dueDate)}{task.dueTime ? `${task.dueTime}` : ''}{overdue ? ' · overdue' : ''}
              </span>
            </div>
          </div>

          <button onClick={() => openTaskEditor(task.id)} aria-label={`Edit “${task.title}”`} title="Edit task" className="text-fg-subtle hover:text-fg md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
            <Pencil size={15} />
          </button>
          <button onClick={onStart} aria-label={`Focus on “${task.title}”`} title="Focus on this task" className="text-fg-subtle hover:text-fg md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
            <Play size={15} />
          </button>
          <button onClick={() => void duplicateTask(task)} aria-label={`Duplicate “${task.title}”`} title="Duplicate" className="text-fg-subtle hover:text-fg md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
            <Copy size={15} />
          </button>
          <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Hide details' : 'Show details'} className="text-fg-subtle hover:text-fg">
            {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
          </button>
          <button onClick={onDelete} aria-label={`Delete “${task.title}”`} className="text-fg-subtle hover:text-fg-soft"><Trash2 size={15} /></button>
        </div>

        {task.subtasks.length > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-fg-subtle mb-1"><span>{doneCount}/{task.subtasks.length} subtasks</span><span>{pct}%</span></div>
            <div className="h-1 bg-surface-2 rounded-full overflow-hidden"><div className="h-full bg-surface-2 rounded-full transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>
          </div>
        )}

        {open && (
          <div className="mt-4 pl-8 space-y-3">
            <div className="flex gap-1 p-1 rounded-lg bg-surface/60 w-fit" role="group" aria-label="Status">
              {STATUSES.map(status => (
                <button
                  key={status}
                  onClick={() => task.status !== status && void changeStatus(task, status)}
                  aria-pressed={task.status === status}
                  className={`px-2.5 py-1 rounded-xl text-xs transition-colors ${task.status === status ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:text-fg'}`}
                >
                  {STATUS_LABEL[status]}
                </button>
              ))}
            </div>
            {task.subtasks.length > 0 && (
              <div className="space-y-2">
                {task.subtasks.map(s => (
                  <button key={s.id} onClick={() => toggleSubtask(s.id)} className="w-full flex items-center gap-2 text-left text-sm text-fg-muted hover:text-fg">
                    <span className={`size-4 rounded border grid place-items-center shrink-0 ${s.completed ? 'bg-accent border-accent text-accent-fg' : 'border-line'}`}>{s.completed && <Check size={10} />}</span>
                    <span className={s.completed ? 'line-through text-fg-subtle' : ''}>{s.title}</span>
                  </button>
                ))}
              </div>
            )}
            <button onClick={onStart} className="text-xs text-fg-muted hover:text-fg flex items-center gap-1"><Play size={12} /> Focus this task</button>
          </div>
        )}
      </div>
    </div>
  </div>
);
}
