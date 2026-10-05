import { useLiveQuery } from 'dexie-react-hooks';
import { X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { db } from '../db/db';
import { toast } from '../lib/toast';
import { isoToday, uid } from '../lib/utils';
import type { Priority, Task } from '../types';

const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Urgent'];
const field = 'mt-1 w-full h-10 rounded-lg bg-zinc-50 border border-zinc-100 px-3 text-sm text-zinc-600';

export function QuickAddModal({ open, onClose, defaultCategory }: { open: boolean; onClose: () => void; defaultCategory?: string }) {
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [duration, setDuration] = useState(30);
  const [dueDate, setDueDate] = useState(isoToday());
  const [dueTime, setDueTime] = useState('');

  // Start from a clean form every time the modal opens, defaulting to the category you're looking at.
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setCategoryId(defaultCategory ?? '');
    setPriority('Medium');
    setDuration(30);
    setDueDate(isoToday());
    setDueTime('');
  }, [open, defaultCategory]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // The remembered category may have been deleted; fall back to the first one that exists.
  const selected = categories.find(c => c.id === categoryId) ?? categories[0];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const name = title.trim();
    if (!name || !selected) return;
    const now = new Date().toISOString();
    const task: Task = {
      id: uid(), title: name, categoryId: selected.id, projectTag: '', priority, status: 'To Do',
      estimatedDuration: Math.max(5, Math.round(Number(duration)) || 30), dueDate, dueTime: dueDate ? dueTime : '',
      subtasks: [], notes: '', colorCode: selected.color, createdAt: now, updatedAt: now,
    };
    try {
      await db.tasks.add(task);
      toast(`Added to ${selected.name}`, 'success');
      onClose();
    } catch {
      toast('Could not save the task. Check that browser storage is available.', 'error');
    }
  };

  return (
    <div className="fade-in fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onMouseDown={onClose}>
      <form onSubmit={submit} onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="quick-add-title" className="pop-in w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center">
          <div>
            <h2 id="quick-add-title" className="font-semibold">Quick add task</h2>
            <p className="text-xs text-zinc-300 mt-1">Fast capture. Details can be refined later.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-zinc-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to get done?" aria-label="Task title" className="w-full h-12 rounded-xl bg-zinc-50 border border-zinc-100 px-4 outline-none focus:border-zinc-300" />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-zinc-400">Category
              <select value={selected?.id ?? ''} onChange={e => setCategoryId(e.target.value)} className={field}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-zinc-400">Priority
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className={field}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label className="text-xs text-zinc-400">Due date
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={field} />
            </label>
            <label className="text-xs text-zinc-400">Time
              <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} disabled={!dueDate} className={`${field} disabled:opacity-40`} />
            </label>
          </div>
          <label className="text-xs text-zinc-400 block">Estimated minutes
            <input type="number" min="5" step="5" value={duration} onChange={e => setDuration(Number(e.target.value))} className={field} />
          </label>
        </div>
        <div className="p-5 pt-0 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-8 px-3 rounded-md text-sm text-zinc-500 hover:bg-zinc-50">Cancel</button>
          <button disabled={!title.trim() || !selected} className="h-8 px-3 rounded-md bg-[var(--accent)] text-[#121214] font-medium text-sm disabled:opacity-40">Create task</button>
        </div>
      </form>
    </div>
  );
}
