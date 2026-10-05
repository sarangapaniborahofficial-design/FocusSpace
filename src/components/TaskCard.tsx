import { Check, ChevronDown, ChevronRight, Clock3, Copy, Pencil, Play, Repeat, Trash2 } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { openTaskEditor } from '../lib/taskEditor';
import { changeStatus, duplicateTask } from '../lib/tasks';
import { isoToday, priorityTone, relativeDay } from '../lib/utils';
import type { Category, Status, Task } from '../types';

const STATUSES: Status[] = ['To Do', 'In Progress', 'Submitted/Done'];
const STATUS_LABEL: Record<Status, string> = { 'To Do': 'To do', 'In Progress': 'In progress', 'Submitted/Done': 'Done' };

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
  const isDone = task.status === 'Submitted/Done';
  const doneCount = task.subtasks.filter(s => s.completed).length;
  const pct = task.subtasks.length ? Math.round((doneCount / task.subtasks.length) * 100) : 0;
  const overdue = !isDone && !!task.dueDate && task.dueDate < isoToday();

  const toggleSubtask = (id: string) =>
    onUpdate({ ...task, subtasks: task.subtasks.map(s => (s.id === id ? { ...s, completed: !s.completed } : s)), updatedAt: new Date().toISOString() });

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group rounded-lg border border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50/80 transition overflow-hidden ${onDragStart ? 'cursor-grab active:cursor-grabbing' : ''} ${dragging ? 'opacity-40' : ''}`}
    >
      <div className="p-3 py-2.5">
        <div className="flex gap-3">
          {selectable ? (
            <button
              onClick={onToggleSelect}
              aria-label={selected ? `Deselect “${task.title}”` : `Select “${task.title}”`}
              aria-pressed={!!selected}
              className={`mt-0.5 size-5 rounded-md border grid place-items-center shrink-0 ${selected ? 'bg-[var(--accent)] border-[var(--accent)] text-[#121214]' : 'border-zinc-200 hover:border-zinc-500'}`}
            >
              {selected && <Check size={12} />}
            </button>
          ) : (
            <button
              onClick={() => void changeStatus(task, isDone ? 'To Do' : 'Submitted/Done')}
              aria-label={isDone ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`}
              aria-pressed={isDone}
              className={`mt-0.5 size-5 rounded-full border grid place-items-center shrink-0 ${isDone ? 'bg-[#10b981] border-[#10b981] text-[#121214]' : 'border-zinc-200 hover:border-zinc-500'}`}
            >
              {isDone && <Check size={12} />}
            </button>
          )}

          <div className="min-w-0 flex-1">
            <button onClick={() => openTaskEditor(task.id)} title="Edit task" className={`flex items-center gap-1.5 w-full text-left font-medium break-words hover:underline underline-offset-2 decoration-zinc-300 ${isDone ? 'line-through text-zinc-300' : 'text-zinc-900'}`}>
              {task.recurrence && <Repeat size={12} className="shrink-0 text-zinc-400" aria-label="Repeats" />}
              <span className="min-w-0 break-words">{task.title}</span>
            </button>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-xs text-zinc-400">
              <span style={{ color: category?.color }}>{category?.name}</span>
              {task.projectTag && <><span>•</span><span>{task.projectTag}</span></>}
              <span>•</span>
              <span className={`px-1.5 py-0.5 rounded ${priorityTone(task.priority)}`}>{task.priority}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Clock3 size={12} />{task.estimatedDuration}m</span>
              <span>•</span>
              <span className={overdue ? 'text-zinc-600' : ''}>
                {relativeDay(task.dueDate)}{task.dueTime ? ` ${task.dueTime}` : ''}{overdue ? ' · overdue' : ''}
              </span>
            </div>
          </div>

          <button onClick={() => openTaskEditor(task.id)} aria-label={`Edit “${task.title}”`} title="Edit task" className="text-zinc-300 hover:text-zinc-700 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
            <Pencil size={15} />
          </button>
          <button onClick={onStart} aria-label={`Focus on “${task.title}”`} title="Focus on this task" className="text-zinc-300 hover:text-zinc-700 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
            <Play size={15} />
          </button>
          <button onClick={() => void duplicateTask(task)} aria-label={`Duplicate “${task.title}”`} title="Duplicate" className="text-zinc-300 hover:text-zinc-700 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
            <Copy size={15} />
          </button>
          <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Hide details' : 'Show details'} className="text-zinc-300 hover:text-zinc-600">
            {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
          </button>
          <button onClick={onDelete} aria-label={`Delete “${task.title}”`} className="text-zinc-200 hover:text-zinc-500"><Trash2 size={15} /></button>
        </div>

        {task.subtasks.length > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-zinc-300 mb-1"><span>{doneCount}/{task.subtasks.length} subtasks</span><span>{pct}%</span></div>
            <div className="h-1 bg-zinc-100 rounded-full overflow-hidden"><div className="h-full bg-zinc-500 rounded-full transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>
          </div>
        )}

        {open && (
          <div className="mt-4 pl-8 space-y-3">
            <div className="flex gap-1 p-1 rounded-lg bg-white/60 w-fit" role="group" aria-label="Status">
              {STATUSES.map(status => (
                <button
                  key={status}
                  onClick={() => task.status !== status && void changeStatus(task, status)}
                  aria-pressed={task.status === status}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${task.status === status ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-700'}`}
                >
                  {STATUS_LABEL[status]}
                </button>
              ))}
            </div>
            {task.subtasks.length > 0 && (
              <div className="space-y-2">
                {task.subtasks.map(s => (
                  <button key={s.id} onClick={() => toggleSubtask(s.id)} className="w-full flex items-center gap-2 text-left text-sm text-zinc-500 hover:text-zinc-700">
                    <span className={`size-4 rounded border grid place-items-center shrink-0 ${s.completed ? 'bg-zinc-600 border-zinc-600 text-white' : 'border-zinc-200'}`}>{s.completed && <Check size={10} />}</span>
                    <span className={s.completed ? 'line-through text-zinc-300' : ''}>{s.title}</span>
                  </button>
                ))}
              </div>
            )}
            <button onClick={onStart} className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1"><Play size={12} /> Focus this task</button>
          </div>
        )}
      </div>
    </div>
  );
}
