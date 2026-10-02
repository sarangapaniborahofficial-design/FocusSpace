import { useLiveQuery } from 'dexie-react-hooks';
import { CheckSquare2, ChevronDown, Inbox, LayoutList, Plus, Search, SquareKanban, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { db } from '../db/db';
import { useToday } from '../lib/hooks';
import { applyFilters, countActiveFilters, NO_FILTERS, sortTasks, type TaskFilters } from '../lib/taskFilters';
import { bulkComplete, bulkDelete, bulkSetPriority, changeStatus, deleteTask } from '../lib/tasks';
import { focusOnTask } from '../lib/timer';
import { storage } from '../lib/utils';
import type { Priority, Status, Task } from '../types';
import { TaskCard } from './TaskCard';
import { EmptyState } from './ui';

const BOARD: Status[] = ['To Do', 'In Progress', 'Submitted/Done'];
const VIEW_KEY = 'focusspace-task-view';
const PRIORITIES: Priority[] = ['Urgent', 'High', 'Medium', 'Low'];

export function TaskManager({ categoryId, onQuickAdd, initialQuery = '', tabs }: { categoryId?: string; onQuickAdd: () => void; initialQuery?: string; tabs?: ReactNode }) {
  const today = useToday();
  const tasks = useLiveQuery(() => (categoryId ? db.tasks.where('categoryId').equals(categoryId).toArray() : db.tasks.toArray()), [categoryId]);
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];

  const [view, setView] = useState<'list' | 'board'>(() => (storage.get(VIEW_KEY) === 'board' ? 'board' : 'list'));
  const [q, setQ] = useState(initialQuery);
  const [sort, setSort] = useState<'dueDate' | 'priority' | 'title' | 'updated'>('dueDate');
  const [filters, setFilters] = useState<TaskFilters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<Status | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filterPopover = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filtersOpen) return;
    const onClick = (e: MouseEvent) => { if (filterPopover.current && !filterPopover.current.contains(e.target as Node)) setFiltersOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFiltersOpen(false); };
    document.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); window.removeEventListener('keydown', onKey); };
  }, [filtersOpen]);

  const loading = tasks === undefined;
  const all = tasks ?? [];
  const category = categories.find(c => c.id === categoryId);
  const openCount = all.filter(t => t.status !== 'Submitted/Done').length;
  const tagOptions = useMemo(() => Array.from(new Set(all.map(t => (t.projectTag ?? '').trim()).filter(Boolean))).sort(), [all]);
  const activeFilterCount = countActiveFilters(filters);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const byFilters = applyFilters(all, filters, today);
    const byQuery = needle ? byFilters.filter(t => t.title.toLowerCase().includes(needle) || (t.projectTag ?? '').toLowerCase().includes(needle)) : byFilters;
    return sortTasks(byQuery, sort);
  }, [all, q, sort, filters, today]);
  const listItems = hideDone ? filtered.filter(t => t.status !== 'Submitted/Done') : filtered;

  const update = (t: Task) => db.tasks.put(t);
  const changeView = (next: 'list' | 'board') => { setView(next); storage.set(VIEW_KEY, next); };
  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };
  const toggleSelect = (id: string) => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const selectedTasks = listItems.filter(t => selected.has(t.id));

  const card = (t: Task, extra?: { dragging?: boolean; onDragStart?: (e: DragEvent<HTMLDivElement>) => void; onDragEnd?: () => void }) => (
    <TaskCard
      key={t.id} task={t} category={categories.find(c => c.id === t.categoryId)} onUpdate={update} onDelete={() => void deleteTask(t)} onStart={() => focusOnTask(t)}
      selectable={selectMode} selected={selected.has(t.id)} onToggleSelect={() => toggleSelect(t.id)} {...extra}
    />
  );

  const dropOn = (status: Status, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || dragId;
    const task = all.find(t => t.id === id);
    if (task && task.status !== status) void changeStatus(task, status);
    setDragId(null);
    setOverColumn(null);
  };

  const emptyAction = (
    <button onClick={onQuickAdd} className="h-9 px-3 rounded-lg bg-zinc-900 text-white text-sm font-medium flex items-center gap-1.5"><Plus size={15} /> New task</button>
  );
  const clearFilters = () => { setQ(''); setFilters(NO_FILTERS); };
  const noMatches = (
    <EmptyState icon={Search} title="No tasks match" text={q.trim() ? `Nothing matches “${q.trim()}”. Try a different word or clear the filters.` : 'Nothing matches these filters.'} action={<button onClick={clearFilters} className="h-9 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm hover:bg-zinc-100">Clear filters</button>} />
  );

  return (
    <div className="p-5 lg:p-7 max-w-[1500px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[.18em] text-zinc-300 mb-1">Task management</div>
          <h1 className="text-2xl font-semibold tracking-tight">{categoryId ? category?.name ?? 'Category' : 'All tasks'}</h1>
          <p className="text-sm text-zinc-400 mt-1">{loading ? 'Loading…' : all.length ? `${openCount} open · ${all.length - openCount} done` : 'Your local-first execution queue.'}</p>
        </div>
        <div className="flex gap-2 self-start md:self-auto">
          {view === 'list' && all.length > 0 && (
            <button onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))} aria-pressed={selectMode} className={`h-10 px-3 rounded-lg border text-sm font-medium ${selectMode ? 'border-zinc-300 bg-zinc-100 text-white' : 'border-zinc-100 text-zinc-500 hover:bg-zinc-50'}`}>
              {selectMode ? 'Cancel' : 'Select'}
            </button>
          )}
          <button onClick={onQuickAdd} className="h-10 px-4 rounded-lg bg-zinc-900 text-white font-medium text-sm flex items-center gap-2"><Plus size={16} /> New task</button>
        </div>
      </header>

      {tabs}

      {selectMode ? (
        <div className="flex flex-wrap items-center gap-2 mb-4 rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2">
          <span className="text-sm text-zinc-600 tabular-nums">{selected.size} selected</span>
          <button onClick={() => setSelected(new Set(listItems.map(t => t.id)))} className="text-xs text-zinc-400 hover:text-zinc-700">Select all {listItems.length}</button>
          <div className="flex-1" />
          <button disabled={!selected.size} onClick={() => void bulkComplete(selectedTasks).then(exitSelectMode)} className="h-8 px-3 rounded-md text-xs bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-40">Mark done</button>
          <select
            disabled={!selected.size}
            onChange={e => { if (e.target.value) { void bulkSetPriority([...selected], e.target.value as Priority).then(exitSelectMode); } }}
            defaultValue="" aria-label="Set priority for selected tasks"
            className="h-8 rounded-md bg-zinc-100 text-zinc-700 text-xs px-2 disabled:opacity-40"
          >
            <option value="" disabled>Set priority…</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button disabled={!selected.size} onClick={() => void bulkDelete(selectedTasks).then(exitSelectMode)} className="h-8 px-3 rounded-md text-xs bg-zinc-400/15 text-zinc-600 hover:bg-zinc-400/25 disabled:opacity-40 flex items-center gap-1"><Trash2 size={13} /> Delete</button>
          <button onClick={exitSelectMode} aria-label="Exit selection" className="text-zinc-400 hover:text-zinc-700"><X size={16} /></button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter tasks…" aria-label="Filter tasks" className="w-full h-9 rounded-lg bg-zinc-50 border border-zinc-100 pl-9 pr-3 text-sm outline-none focus:border-zinc-300" />
          </div>
          <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} aria-label="Sort tasks" className="h-9 rounded-lg bg-zinc-50 border border-zinc-100 px-3 text-sm text-zinc-500 outline-none">
            <option value="dueDate">Sort: date</option>
            <option value="priority">Sort: priority</option>
            <option value="title">Sort: title</option>
            <option value="updated">Sort: recently edited</option>
          </select>
          <div className="relative" ref={filterPopover}>
            <button onClick={() => setFiltersOpen(v => !v)} aria-expanded={filtersOpen} className={`h-9 pl-3 pr-2 rounded-lg border text-sm flex items-center gap-1.5 transition-colors ${activeFilterCount ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}>
              Filters{activeFilterCount > 0 && <span className="text-xs tabular-nums bg-white/20 dark:bg-black/10 rounded-full px-1.5">{activeFilterCount}</span>}<ChevronDown size={14} />
            </button>
            {filtersOpen && (
              <div className="pop-in absolute z-20 top-11 right-0 w-64 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-3 space-y-3">
                <FilterSelect label="Status" value={filters.status} onChange={v => setFilters(f => ({ ...f, status: v as TaskFilters['status'] }))} options={[['all', 'Any'], ['open', 'Open'], ['To Do', 'To do'], ['In Progress', 'In progress'], ['Submitted/Done', 'Done']]} />
                <FilterSelect label="Priority" value={filters.priority} onChange={v => setFilters(f => ({ ...f, priority: v as TaskFilters['priority'] }))} options={[['all', 'Any'], ...PRIORITIES.map(p => [p, p] as [string, string])]} />
                <FilterSelect label="Due" value={filters.due} onChange={v => setFilters(f => ({ ...f, due: v as TaskFilters['due'] }))} options={[['any', 'Any time'], ['overdue', 'Overdue'], ['today', 'Today'], ['week', 'Next 7 days'], ['none', 'No due date']]} />
                {tagOptions.length > 0 && <FilterSelect label="Tag" value={filters.tag || 'all'} onChange={v => setFilters(f => ({ ...f, tag: v === 'all' ? '' : v }))} options={[['all', 'Any'], ...tagOptions.map(t => [t, t] as [string, string])]} />}
                <button onClick={() => setFilters(NO_FILTERS)} disabled={!activeFilterCount} className="text-xs text-zinc-400 hover:text-zinc-700 disabled:opacity-40">Clear filters</button>
              </div>
            )}
          </div>
          <div className="flex h-9 rounded-lg border border-zinc-100 overflow-hidden" role="group" aria-label="View">
            <button onClick={() => changeView('list')} aria-label="List view" aria-pressed={view === 'list'} className={`px-3 ${view === 'list' ? 'bg-zinc-100 text-white' : 'text-zinc-400'}`}><LayoutList size={16} /></button>
            <button onClick={() => changeView('board')} aria-label="Board view" aria-pressed={view === 'board'} className={`px-3 ${view === 'board' ? 'bg-zinc-100 text-white' : 'text-zinc-400'}`}><SquareKanban size={16} /></button>
          </div>
          <button
            onClick={() => setHideDone(v => !v)}
            disabled={view === 'board'}
            aria-pressed={hideDone}
            title={hideDone ? 'Show completed tasks' : 'Hide completed tasks'}
            aria-label={hideDone ? 'Show completed tasks' : 'Hide completed tasks'}
            className={`size-9 rounded-lg border grid place-items-center disabled:opacity-40 ${hideDone ? 'border-zinc-300 bg-zinc-100 text-white' : 'border-zinc-100 text-zinc-400 hover:text-zinc-700'}`}
          >
            <CheckSquare2 size={15} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2" aria-busy="true"><div className="skeleton h-[74px]" /><div className="skeleton h-[74px]" /><div className="skeleton h-[74px]" /></div>
      ) : all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-100">
          <EmptyState icon={Inbox} title={categoryId ? `Nothing in ${category?.name ?? 'this category'} yet` : 'No tasks yet'} text="Capture the first task and it lands here. Press Ctrl/⌘ + N from anywhere." action={emptyAction} />
        </div>
      ) : view === 'list' ? (
        listItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-100">
            {q.trim() || activeFilterCount ? noMatches : <EmptyState icon={CheckSquare2} title="All caught up" text="Every task here is done. Show completed tasks to review them, or add something new." action={emptyAction} />}
          </div>
        ) : (
          <div className="space-y-2">{listItems.map(t => card(t))}</div>
        )
      ) : (
        <div className="grid md:grid-cols-3 gap-3">
          {BOARD.map(status => {
            const items = filtered.filter(t => t.status === status);
            return (
              <div
                key={status}
                onDragOver={e => { if (dragId) { e.preventDefault(); if (overColumn !== status) setOverColumn(status); } }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverColumn(null); }}
                onDrop={e => dropOn(status, e)}
                className={`rounded-xl border p-3 min-h-[240px] md:min-h-[360px] transition-colors ${overColumn === status ? 'border-zinc-400 bg-zinc-50/60' : 'border-zinc-100 bg-white/60'}`}
              >
                <div className="flex justify-between items-center px-1 mb-3"><span className="text-sm font-medium">{status}</span><span className="text-xs text-zinc-300">{items.length}</span></div>
                <div className="space-y-2">
                  {items.map(t => card(t, {
                    dragging: dragId === t.id,
                    onDragStart: e => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; setDragId(t.id); },
                    onDragEnd: () => { setDragId(null); setOverColumn(null); },
                  }))}
                  {items.length === 0 && (
                    <div className="rounded-lg border border-dashed border-zinc-100 px-3 py-8 text-center text-xs text-zinc-300">
                      {q.trim() ? 'No matches in this column' : status === 'Submitted/Done' ? 'Finished tasks land here' : 'Drag a task here'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block text-xs text-zinc-400">
      {label}
      <select value={value} onChange={e => onChange(e.target.value)} className="mt-1 w-full h-9 rounded-lg bg-zinc-50 border border-zinc-100 px-2 text-sm text-zinc-700 outline-none">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
