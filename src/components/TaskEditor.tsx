import { useLiveQuery } from 'dexie-react-hooks';
import { Play, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { db } from '../db/db';
import { REPEAT_OPTIONS, presetOf, ruleFromPreset, type RepeatPreset } from '../lib/recurrence';
import { closeTaskEditor, useTaskEditorTarget } from '../lib/taskEditor';
import { changeStatus, deleteTask } from '../lib/tasks';
import { focusOnTask } from '../lib/timer';
import { toast } from '../lib/toast';
import { formatDuration, uid } from '../lib/utils';
import type { Category, Priority, Recurrence, Status, Subtask, Task } from '../types';
import { ConfirmDialog } from './ui';

const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Urgent'];
const STATUSES: { id: Status; label: string }[] = [{ id: 'To Do', label: 'To do' }, { id: 'In Progress', label: 'In progress' }, { id: 'Submitted/Done', label: 'Done' }];
const field = 'mt-1 w-full h-10 rounded-lg bg-zinc-50 border border-zinc-100 px-3 text-sm text-zinc-700 outline-none';

interface Draft {
  title: string; categoryId: string; projectTag: string; priority: Priority; status: Status;
  estimate: string; dueDate: string; dueTime: string; notes: string; subtasks: Subtask[]; repeat: RepeatPreset;
}

const toDraft = (t: Task): Draft => ({
  title: t.title, categoryId: t.categoryId, projectTag: t.projectTag ?? '', priority: t.priority, status: t.status,
  estimate: String(t.estimatedDuration), dueDate: t.dueDate, dueTime: t.dueTime, notes: t.notes ?? '', subtasks: t.subtasks.map(s => ({ ...s })),
  repeat: presetOf(t.recurrence),
});

/** Draft -> values that would be saved (used for both saving and "has anything changed?"). */
const clean = (d: Draft, existing?: Recurrence) => ({
  title: d.title.trim(),
  categoryId: d.categoryId,
  projectTag: d.projectTag.trim(),
  priority: d.priority,
  status: d.status,
  estimatedDuration: Math.min(1440, Math.max(5, Math.round(Number(d.estimate)) || 30)),
  dueDate: d.dueDate,
  dueTime: d.dueDate ? d.dueTime : '',
  notes: d.notes,
  subtasks: d.subtasks.map(s => ({ id: s.id, title: s.title.trim(), completed: s.completed })).filter(s => s.title),
  recurrence: d.dueDate ? ruleFromPreset(d.repeat, d.dueDate, existing) : undefined,
});

/** Mounted once in the app shell; opens on whichever task `openTaskEditor` was last called with. */
export function TaskEditor() {
  const taskId = useTaskEditorTarget();
  return taskId ? <Loader key={taskId} taskId={taskId} /> : null;
}

function Loader({ taskId }: { taskId: string }) {
  const loaded = useLiveQuery(async () => ({ task: await db.tasks.get(taskId) }), [taskId]);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const missing = !!loaded && !loaded.task;
  useEffect(() => { if (missing) closeTaskEditor(); }, [missing]);
  if (!loaded?.task || !categories) return null;
  return <Panel task={loaded.task} categories={categories} />;
}

function Panel({ task, categories }: { task: Task; categories: Category[] }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(task));
  const [newSubtask, setNewSubtask] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saving, setSaving] = useState(false);

  const focusLogs = useLiveQuery(async () => db.focusLogs.where('taskId').equals(task.id).toArray(), [task.id]) ?? [];
  const focusMinutes = focusLogs.filter(l => l.mode === 'focus').reduce((sum, l) => sum + l.durationMinutes, 0);
  const tagOptions = useLiveQuery(async () => Array.from(new Set((await db.tasks.toArray()).map(t => (t.projectTag ?? '').trim()).filter(Boolean))).sort(), []) ?? [];

  const initial = useMemo(() => JSON.stringify(clean(toDraft(task), task.recurrence)), [task]);
  const current = clean(draft, task.recurrence);
  const dirty = JSON.stringify(current) !== initial || newSubtask.trim() !== '';
  const valid = current.title.length > 0;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(d => ({ ...d, [key]: value }));

  const requestClose = () => { if (dirty) setConfirmDiscard(true); else closeTaskEditor(); };

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      const category = categories.find(c => c.id === current.categoryId);
      const pending = newSubtask.trim();
      const subtasks = pending ? [...current.subtasks, { id: uid(), title: pending, completed: false }] : current.subtasks;
      // Every field except status, saved first; status (old value kept here) is applied separately below
      // through changeStatus, so a recurring task gets its next occurrence and completedAt stays correct.
      const fieldsOnly: Task = {
        ...task, ...current, status: task.status, subtasks,
        colorCode: category?.color ?? task.colorCode,
        updatedAt: new Date().toISOString(),
      };
      await db.tasks.put(fieldsOnly);
      if (current.status !== task.status) await changeStatus(fieldsOnly, current.status, { quiet: true });
      toast('Task saved', 'success');
      closeTaskEditor();
    } catch {
      toast('Could not save the task. Check that browser storage is available.', 'error');
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmDiscard) return; // the dialog owns Escape while it is open
      if (e.key === 'Escape') { e.preventDefault(); requestClose(); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void save(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const addSubtask = () => {
    const title = newSubtask.trim();
    if (!title) return;
    setDraft(d => ({ ...d, subtasks: [...d.subtasks, { id: uid(), title, completed: false }] }));
    setNewSubtask('');
  };
  const patchSubtask = (id: string, patch: Partial<Subtask>) => setDraft(d => ({ ...d, subtasks: d.subtasks.map(s => (s.id === id ? { ...s, ...patch } : s)) }));
  const removeSubtask = (id: string) => setDraft(d => ({ ...d, subtasks: d.subtasks.filter(s => s.id !== id) }));

  const doneSubtasks = draft.subtasks.filter(s => s.completed && s.title.trim()).length;
  const totalSubtasks = draft.subtasks.filter(s => s.title.trim()).length;
  const stamp = (iso?: string) => (iso ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '');

  return (
    <div className="fade-in fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex justify-end" onMouseDown={requestClose}>
      <form
        onSubmit={save}
        onMouseDown={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-labelledby="task-editor-title"
        className="slide-in w-full sm:w-[480px] h-full bg-white border-l border-zinc-100 flex flex-col shadow-2xl"
      >
        <div className="h-16 shrink-0 px-5 border-b border-zinc-100 flex items-center justify-between">
          <h2 id="task-editor-title" className="font-semibold">Edit task</h2>
          <button type="button" onClick={requestClose} aria-label="Close editor" className="size-9 grid place-items-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-50"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div>
            <input
              autoFocus value={draft.title} onChange={e => set('title', e.target.value)} placeholder="Task title" aria-label="Title" aria-invalid={!valid}
              className={`w-full h-12 rounded-xl bg-zinc-50 border px-4 text-base outline-none ${valid ? 'border-zinc-100' : 'border-zinc-400/60'}`}
            />
            {!valid && <p className="text-xs text-zinc-600 mt-1.5">A task needs a title.</p>}
          </div>

          <div className="flex gap-1 p-1 rounded-lg bg-zinc-50 border border-zinc-100 w-fit" role="group" aria-label="Status">
            {STATUSES.map(s => (
              <button key={s.id} type="button" onClick={() => set('status', s.id)} aria-pressed={draft.status === s.id} className={`px-3 py-1.5 rounded-md text-xs transition-colors ${draft.status === s.id ? 'bg-zinc-200 text-white' : 'text-zinc-400 hover:text-zinc-700'}`}>{s.label}</button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-zinc-400">Category
              <select value={draft.categoryId} onChange={e => set('categoryId', e.target.value)} className={field}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-zinc-400">Priority
              <select value={draft.priority} onChange={e => set('priority', e.target.value as Priority)} className={field}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label className="text-xs text-zinc-400">Due date
              <input type="date" value={draft.dueDate} onChange={e => set('dueDate', e.target.value)} className={field} />
            </label>
            <label className="text-xs text-zinc-400">Time
              <input type="time" value={draft.dueTime} onChange={e => set('dueTime', e.target.value)} disabled={!draft.dueDate} className={`${field} disabled:opacity-40`} />
            </label>
            <label className="text-xs text-zinc-400">Estimate (minutes)
              <input type="number" min={5} max={1440} step={5} value={draft.estimate} onChange={e => set('estimate', e.target.value)} className={field} />
            </label>
            <label className="text-xs text-zinc-400">Project tag
              <input list="task-editor-tags" value={draft.projectTag} onChange={e => set('projectTag', e.target.value)} placeholder="e.g. CS101" className={field} />
              <datalist id="task-editor-tags">{tagOptions.map(tag => <option key={tag} value={tag} />)}</datalist>
            </label>
            <label className="text-xs text-zinc-400 col-span-2">Repeat
              <select value={draft.dueDate ? draft.repeat : 'none'} onChange={e => set('repeat', e.target.value as RepeatPreset)} disabled={!draft.dueDate} className={`${field} disabled:opacity-40`}>
                {REPEAT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          </div>
          {!draft.dueDate && <p className="text-xs text-zinc-300 -mt-2">Without a due date the task stays out of Today and sits in the calendar's unscheduled list, and it can't repeat.</p>}
          {draft.dueDate && draft.repeat !== 'none' && <p className="text-xs text-zinc-300 -mt-2">Completing this task creates the next occurrence automatically.</p>}

          <section aria-labelledby="subtasks-heading">
            <div className="flex items-center justify-between mb-2">
              <h3 id="subtasks-heading" className="text-sm font-medium">Subtasks</h3>
              {totalSubtasks > 0 && <span className="text-xs text-zinc-300 tabular-nums">{doneSubtasks}/{totalSubtasks} done</span>}
            </div>
            <div className="space-y-1.5">
              {draft.subtasks.map(s => (
                <div key={s.id} className="flex items-center gap-2 group">
                  <button type="button" onClick={() => patchSubtask(s.id, { completed: !s.completed })} aria-label={s.completed ? 'Mark subtask as not done' : 'Mark subtask as done'} aria-pressed={s.completed} className={`size-4 shrink-0 rounded border grid place-items-center text-[10px] leading-none ${s.completed ? 'bg-zinc-600 border-zinc-600 text-white' : 'border-zinc-300 hover:border-zinc-500'}`}>{s.completed ? '✓' : ''}</button>
                  <input value={s.title} onChange={e => patchSubtask(s.id, { title: e.target.value })} aria-label="Subtask title" className={`flex-1 min-w-0 h-9 rounded-md bg-transparent border border-transparent hover:border-zinc-100 focus:border-zinc-300 px-2 text-sm outline-none ${s.completed ? 'line-through text-zinc-400' : 'text-zinc-700'}`} />
                  <button type="button" onClick={() => removeSubtask(s.id)} aria-label="Remove subtask" className="size-8 grid place-items-center rounded-md text-zinc-300 hover:text-zinc-500 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"><X size={14} /></button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); addSubtask(); } }}
                placeholder="Add a subtask and press Enter" aria-label="New subtask"
                className="flex-1 min-w-0 h-10 rounded-lg bg-zinc-50 border border-zinc-100 px-3 text-sm outline-none"
              />
              <button type="button" onClick={addSubtask} disabled={!newSubtask.trim()} aria-label="Add subtask" className="size-10 grid place-items-center rounded-lg border border-zinc-100 text-zinc-500 hover:text-white hover:bg-zinc-50 disabled:opacity-40"><Plus size={16} /></button>
            </div>
          </section>

          <label className="block">
            <span className="text-sm font-medium">Notes</span>
            <textarea value={draft.notes} onChange={e => set('notes', e.target.value)} rows={6} placeholder="Context, links, what done looks like…" className="mt-2 w-full rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2.5 text-sm leading-relaxed outline-none resize-y min-h-[120px]" />
          </label>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/40 p-4 text-xs text-zinc-400 space-y-1.5">
            <div className="flex justify-between"><span>Focus time logged</span><span className="text-zinc-600 tabular-nums">{focusMinutes ? `${formatDuration(focusMinutes)} of ${formatDuration(current.estimatedDuration)} estimated` : 'None yet'}</span></div>
            <div className="flex justify-between"><span>Created</span><span>{stamp(task.createdAt)}</span></div>
            <div className="flex justify-between"><span>Last edited</span><span>{stamp(task.updatedAt)}</span></div>
            {task.completedAt && <div className="flex justify-between"><span>Completed</span><span>{stamp(task.completedAt)}</span></div>}
            <button type="button" onClick={() => { focusOnTask(task); closeTaskEditor(); }} className="mt-2 flex items-center gap-1.5 text-zinc-600 hover:text-white"><Play size={13} /> Start a focus session on this task</button>
          </div>
        </div>

        <div className="shrink-0 border-t border-zinc-100 px-5 py-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => { closeTaskEditor(); void deleteTask(task); }} className="h-10 px-3 rounded-lg text-sm text-zinc-600 hover:bg-zinc-400/10 flex items-center gap-1.5"><Trash2 size={15} /> Delete</button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={requestClose} className="h-10 px-4 rounded-lg text-sm text-zinc-500 hover:bg-zinc-50">Cancel</button>
            <button type="submit" disabled={!valid || !dirty || saving} title="Ctrl/⌘ + Enter" className="h-10 px-5 rounded-lg bg-zinc-900 text-white font-medium text-sm hover:bg-white disabled:opacity-40">Save</button>
          </div>
        </div>
      </form>

      {confirmDiscard && (
        <ConfirmDialog
          title="Discard your changes?" text="This task has edits that haven't been saved."
          confirmLabel="Discard" cancelLabel="Keep editing" danger
          onConfirm={() => closeTaskEditor()} onCancel={() => setConfirmDiscard(false)}
        />
      )}
    </div>
  );
}
