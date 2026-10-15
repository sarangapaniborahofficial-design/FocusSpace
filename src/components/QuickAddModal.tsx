import { useLiveQuery } from 'dexie-react-hooks';
import { Calendar, Clock, Hash, Sparkles, Tag, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { db } from '../db/db';
import { parseTaskInput } from '../lib/taskParser';
import { toast } from '../lib/toast';
import { isoToday, uid } from '../lib/utils';
import type { Priority, Task } from '../types';

const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Urgent'];
const field = 'mt-1 w-full h-10 rounded-lg bg-surface-2 border border-line px-3 text-sm text-fg-soft';

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

  // Live parsed tokens from natural language
  const parsed = useMemo(() => parseTaskInput(title, categories, isoToday()), [title, categories]);
  const hasTokens = Object.keys(parsed.tokens).length > 0;

  if (!open) return null;

  // The remembered category may have been deleted; fall back to the first one that exists.
  const activeCategoryId = parsed.categoryId ?? categoryId;
  const selected = categories.find(c => c.id === activeCategoryId) ?? categories[0];
  const activePriority = parsed.priority ?? priority;
  const activeDuration = parsed.estimatedDuration ?? duration;
  const activeDueDate = parsed.dueDate ?? dueDate;
  const activeDueTime = parsed.dueTime ?? dueTime;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanTitle = (hasTokens ? parsed.title : title).trim();
    if (!cleanTitle || !selected) return;
    const now = new Date().toISOString();
    const task: Task = {
      id: uid(),
      title: cleanTitle,
      categoryId: selected.id,
      projectTag: parsed.projectTag ?? '',
      priority: activePriority,
      status: 'To Do',
      estimatedDuration: Math.max(5, Math.round(Number(activeDuration)) || 30),
      dueDate: activeDueDate,
      dueTime: activeDueDate ? activeDueTime : '',
      subtasks: [],
      notes: '',
      colorCode: selected.color,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await db.tasks.add(task);
      toast(`Added "${cleanTitle}" to ${selected.name}`, 'success');
      onClose();
    } catch {
      toast('Could not save the task. Check that browser storage is available.', 'error');
    }
  };

  return (
    <div className="fade-in fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onMouseDown={onClose}>
      <form onSubmit={submit} onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="quick-add-title" className="pop-in w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="p-5 border-b border-line flex justify-between items-center">
          <div>
            <h2 id="quick-add-title" className="font-semibold flex items-center gap-2">
              <Sparkles size={16} className="text-accent-text" /> Quick Add Task
            </h2>
            <p className="text-xs text-fg-subtle mt-1">
              Natural language enabled. Type <code className="text-fg-soft font-mono">@category</code>, <code className="text-fg-soft font-mono">#tag</code>, <code className="text-fg-soft font-mono">!urgent</code>, <code className="text-fg-soft font-mono">~45m</code>, <code className="text-fg-soft font-mono">tomorrow 5pm</code>
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-fg-muted hover:text-fg"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Finish essay @academics #CS101 !urgent ~90m tomorrow 5pm"
            aria-label="Task title"
            className="w-full h-12 rounded-xl bg-surface-2 border border-line px-4 outline-none focus:border-accent text-sm text-fg"
          />

          {hasTokens && (
            <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-surface-2/60 border border-line text-xs">
              <span className="text-[10px] font-mono text-fg-subtle uppercase tracking-wider mr-1">Parsed:</span>
              {parsed.tokens.priority && (
                <span className="px-2 py-0.5 rounded-md font-medium text-[11px] bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  {parsed.tokens.priority.label}
                </span>
              )}
              {parsed.tokens.category && (
                <span className="px-2 py-0.5 rounded-md font-medium text-[11px] bg-accent/15 text-accent-text border border-accent/30 flex items-center gap-1">
                  <Tag size={10} /> {parsed.tokens.category.label}
                </span>
              )}
              {parsed.tokens.projectTag && (
                <span className="px-2 py-0.5 rounded-md font-medium text-[11px] bg-surface-3 text-fg-muted border border-line flex items-center gap-1">
                  <Hash size={10} /> {parsed.tokens.projectTag.label}
                </span>
              )}
              {parsed.tokens.duration && (
                <span className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-surface-3 text-fg-soft border border-line flex items-center gap-1">
                  <Clock size={10} /> {parsed.tokens.duration.label}
                </span>
              )}
              {parsed.tokens.date && (
                <span className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                  <Calendar size={10} /> {parsed.tokens.date.label}
                </span>
              )}
              {parsed.tokens.time && (
                <span className="px-2 py-0.5 rounded-md font-mono text-[11px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Clock size={10} /> {parsed.tokens.time.label}
                </span>
              )}
              <span className="text-xs text-fg-subtle ml-auto truncate max-w-[140px] italic">
                "{parsed.title}"
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-fg-muted">Category
              <select value={selected?.id ?? ''} onChange={e => setCategoryId(e.target.value)} className={field}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-fg-muted">Priority
              <select value={activePriority} onChange={e => setPriority(e.target.value as Priority)} className={field}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label className="text-xs text-fg-muted">Due date
              <input type="date" value={activeDueDate} onChange={e => setDueDate(e.target.value)} className={field} />
            </label>
            <label className="text-xs text-fg-muted">Time
              <input type="time" value={activeDueTime} onChange={e => setDueTime(e.target.value)} disabled={!activeDueDate} className={`${field} disabled:opacity-40`} />
            </label>
          </div>
          <label className="text-xs text-fg-muted block">Estimated minutes
            <input type="number" min="5" step="5" value={activeDuration} onChange={e => setDuration(Number(e.target.value))} className={field} />
          </label>
        </div>
        <div className="p-5 pt-0 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-8 px-3 rounded-md text-sm text-fg-muted hover:bg-hover">Cancel</button>
          <button disabled={!title.trim() || !selected} className="h-8 px-4 rounded-xl bg-accent text-accent-fg font-medium text-sm disabled:opacity-40 keycap hover:bg-accent-hover transition">Create task</button>
        </div>
      </form>
    </div>
  );
}
