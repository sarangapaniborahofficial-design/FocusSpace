import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Check, Circle, Flame, ListChecks, Pencil, Plus, Sparkles, Target, Trash2, X, CalendarDays } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { db } from '../db/db';
import { computeStreaks } from '../lib/analytics';
import { deleteEntry, getOrCreateEntry, restoreEntry, saveEntry, shouldDropEmptyEntry } from '../lib/journal';
import { addLink, listLinks, removeLink } from '../lib/pageLinks';
import { confirmLegacyPage, deletePage, restorePage, savePage } from '../lib/pages';
import { toast } from '../lib/toast';
import { dateLabel, isoToday, relativeDay } from '../lib/utils';
import type { Habit, JournalEntry, Page, PageLink, Task } from '../types';
import { Attachments } from './PageAttachments';
import { RichTextEditor } from './RichTextEditor';
import { RichTextView, toggleTaskAtPath } from './RichTextView';
import { ConfirmDialog, EmptyState } from './ui';

/** Loads the page, then hands over to the editor. */
export function PageView({ pageId, onBack }: { pageId: string; onBack: () => void }) {
  const loaded = useLiveQuery(async () => ({ page: await db.pages.get(pageId) }), [pageId]);
  if (!loaded) return <div className="p-5 lg:p-7 max-w-3xl mx-auto"><div className="skeleton h-10 w-2/3 mb-4" /><div className="skeleton h-64" /></div>;
  if (!loaded.page) {
    return (
      <div className="p-5 lg:p-7 max-w-3xl mx-auto">
        <EmptyState icon={Sparkles} title="This page no longer exists" text="It may have been deleted." action={<button onClick={onBack} className="h-8 px-3 rounded-xl border border-line bg-surface-2 text-sm hover:bg-hover">Back to pages</button>} />
      </div>
    );
  }
  return <PageEditor key={pageId} page={loaded.page} onBack={onBack} />;
}

function PageEditor({ page, onBack }: { page: Page; onBack: () => void }) {
  const today = useMemo(() => isoToday(), []);
  const entries = useLiveQuery(() => db.journalEntries.where('pageId').equals(page.id).toArray(), [page.id]);
  const links = useLiveQuery(() => listLinks(page.id), [page.id]) ?? [];
  const category = useLiveQuery(async () => (page.categoryId ? db.categories.get(page.categoryId) : undefined), [page.categoryId]);

  const [title, setTitle] = useState(page.title);
  const [description, setDescription] = useState(page.description);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = descriptionRef.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }, [page.id]);

  // Autosave title/description, debounced; always flushed on the way out.
  const savedFields = useRef({ title: page.title, description: page.description });
  useEffect(() => {
    if (title === savedFields.current.title && description === savedFields.current.description) return;
    const timer = window.setTimeout(() => {
      savedFields.current = { title, description };
      void savePage(page.id, { title, description });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [title, description, page.id]);
  useEffect(() => () => {
    if (title !== savedFields.current.title || description !== savedFields.current.description) void savePage(page.id, { title, description });
  }, [page.id, title, description]);

  const sorted = useMemo(() => [...(entries ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [entries]);
  const todayEntry = sorted.find(e => e.date === today);

  const openToday = async () => {
    if (todayEntry) { setEditingEntryId(todayEntry.id); return; }
    const entry = await getOrCreateEntry(page.id, today);
    setEditingEntryId(entry.id);
  };

  const removePage = async () => {
    const snapshot = await deletePage(page.id);
    onBack();
    if (snapshot) toast(`Deleted “${title.trim() || 'Untitled'}”`, 'info', { action: { label: 'Undo', run: () => { void restorePage(snapshot); } } });
  };

  return (
    <div className="p-5 lg:p-7 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-fg-muted hover:text-fg min-w-0"><ArrowLeft size={16} /><span className="truncate">{category ? `${category.name} / ` : ''}Pages</span></button>
        <button onClick={() => setConfirmingDelete(true)} aria-label="Delete page" title="Delete page" className="size-9 grid place-items-center rounded-lg text-fg-subtle hover:text-fg-soft hover:bg-hover"><Trash2 size={16} /></button>
      </div>

      <input
        value={title} onChange={e => setTitle(e.target.value)} placeholder="Untitled" aria-label="Page title"
        autoFocus={page.title === 'Untitled' && !page.description} onFocus={e => { if (e.currentTarget.value === 'Untitled') e.currentTarget.select(); }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); descriptionRef.current?.focus(); } }}
        className="w-full bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-fg-subtle mb-2"
      />
      <textarea
        ref={descriptionRef}
        value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this page about?" aria-label="Page description" rows={1}
        onInput={(e: FormEvent<HTMLTextAreaElement>) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }}
        className="w-full bg-transparent text-sm text-fg-muted outline-none placeholder:text-fg-subtle resize-none mb-6"
      />

      {page.legacyMarkdown && <LegacyBanner pageId={page.id} />}

      <RelatedSection pageId={page.id} links={links} />

      <section aria-labelledby="journal-heading" className="mt-2">
        <div className="flex items-center justify-between mb-3">
          <h2 id="journal-heading" className="font-medium">Journal</h2>
          {!todayEntry && (
            <button onClick={() => void openToday()} className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-xs font-medium flex items-center gap-1.5"><Plus size={13} /> Write today's entry</button>
          )}
        </div>

        {entries === undefined ? (
          <div className="skeleton h-40" />
        ) : sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line">
            <EmptyState compact icon={Sparkles} title="No entries yet" text="Write today's entry to start this page's journal." action={<button onClick={() => void openToday()} className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-sm font-medium">Write today's entry</button>} />
          </div>
        ) : (
          <ul className="space-y-3">
            {sorted.map(entry => (
              <JournalEntryRow
                key={entry.id} entry={entry} isToday={entry.date === today}
                editing={editingEntryId === entry.id}
                onEdit={() => setEditingEntryId(entry.id)}
                onDoneEditing={() => setEditingEntryId(null)}
              />
            ))}
          </ul>
        )}
      </section>

      <Attachments pageId={page.id} />

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete this page?" text="Its journal entries and files will be deleted too. This can be undone right after."
          confirmLabel="Delete" danger onConfirm={() => { setConfirmingDelete(false); void removePage(); }} onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}

/* ---------- one journal entry ---------- */

function JournalEntryRow({ entry, isToday, editing, onEdit, onDoneEditing }: { entry: JournalEntry; isToday: boolean; editing: boolean; onEdit: () => void; onDoneEditing: () => void }) {
  const flush = async () => {
    if (shouldDropEmptyEntry(entry)) { await deleteEntry(entry.id); }
    onDoneEditing();
  };

  return (
    <li className="rounded-xl border border-line bg-surface-2 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
        <span className="text-xs font-medium text-fg-muted">{isToday ? `Today · ${dateLabel(entry.date)}` : dateLabel(entry.date)}</span>
        {editing ? (
          <button onClick={() => void flush()} className="text-xs text-fg-muted hover:text-fg px-2 py-1 rounded-xl hover:bg-hover">Done</button>
        ) : (
          <button onClick={onEdit} aria-label="Edit this entry" title="Edit" className="text-fg-subtle hover:text-fg p-1 rounded-xl hover:bg-hover"><Pencil size={13} /></button>
        )}
      </div>
      <div className="px-1 py-1">
        {editing ? (
          <RichTextEditor content={entry.content} onChange={doc => void saveEntry(entry.id, doc)} autoFocus />
        ) : (
          <div className="px-3 py-2">
            <RichTextView doc={entry.content} onToggleTask={path => void saveEntry(entry.id, toggleTaskAtPath(entry.content, path))} />
          </div>
        )}
      </div>
    </li>
  );
}

/* ---------- legacy conversion banner ---------- */

function LegacyBanner({ pageId }: { pageId: string }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const page = useLiveQuery(() => db.pages.get(pageId), [pageId]);
  if (!page?.legacyMarkdown) return null;
  return (
    <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <p className="text-sm text-amber-200">This page was converted from the old note format into its first journal entry below.</p>
      <div className="mt-2 flex items-center gap-3">
        <button onClick={() => void confirmLegacyPage(pageId)} className="h-8 px-3 rounded-xl bg-amber-400 text-amber-950 text-xs font-medium">Looks right, dismiss</button>
        <button onClick={() => setShowOriginal(v => !v)} className="text-xs text-amber-200/80 hover:text-amber-100">{showOriginal ? 'Hide original text' : 'View original text'}</button>
      </div>
      {showOriginal && <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-amber-100/80 bg-black/20 rounded-lg p-3 max-h-64 overflow-y-auto">{page.legacyMarkdown}</pre>}
    </div>
  );
}

/* ---------- related tasks & habits (live references, never copies) ---------- */

function RelatedSection({ pageId, links }: { pageId: string; links: PageLink[] }) {
  const [picking, setPicking] = useState<'task' | 'habit' | 'goal' | null>(null);
  const goalLinks = links.filter(l => l.kind === 'goal');
  const taskLinks = links.filter(l => l.kind === 'task');
  const habitLinks = links.filter(l => l.kind === 'habit');
  const taskIds = taskLinks.map(l => l.targetId);
  
  // Live query for tasks to show them in the calendar section
  const linkedTasks = useLiveQuery(async () => {
    if (taskIds.length === 0) return [];
    return db.tasks.where('id').anyOf(taskIds).toArray();
  }, [taskIds.join(',')]) ?? [];

  const calendarTasks = linkedTasks.filter(t => t.dueDate && t.status !== 'Submitted/Done').sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));

  if (links.length === 0 && !picking) {
    return (
      <section className="mb-6">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <span>No related tasks or habits yet.</span>
          <button onClick={() => setPicking('task')} className="text-fg-soft hover:text-fg underline underline-offset-2">Link one</button>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-fg-soft">Related</h2>
        <div className="flex gap-1">
          <button onClick={() => setPicking(picking === 'task' ? null : 'task')} className="text-xs h-7 px-2.5 rounded-xl text-fg-muted hover:text-[var(--sidebar-active-text)] hover:bg-[var(--sidebar-active-bg)]">+ Task</button>
          <button onClick={() => setPicking(picking === 'habit' ? null : 'habit')} className="text-xs h-7 px-2.5 rounded-xl text-fg-muted hover:text-[var(--sidebar-active-text)] hover:bg-[var(--sidebar-active-bg)]">+ Habit</button>
        </div>
      </div>
      {picking && <LinkPicker pageId={pageId} kind={picking} existing={links.map(l => l.targetId)} onDone={() => setPicking(null)} />}
      
      {calendarTasks.length > 0 && (
        <div className="mb-4 bg-surface rounded-lg border border-line p-3 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-2 flex items-center gap-1"><CalendarDays size={12}/> Calendar / Upcoming</div>
          <div className="space-y-2">
            {calendarTasks.map(t => (
              <div key={t.id} className="flex items-center gap-2 text-sm text-fg-soft">
                <Circle size={14} className="text-fg-subtle shrink-0" />
                <span className="min-w-0 truncate font-medium">{t.title}</span>
                <span className="ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-xl bg-surface-2 text-fg-soft">{dateLabel(t.dueDate!)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {taskLinks.length > 0 && <div className="space-y-1.5">{taskLinks.map(l => <LinkedTaskRow key={l.id} link={l} />)}</div>}
        {habitLinks.length > 0 && <div className="space-y-1.5">{habitLinks.map(l => <LinkedHabitRow key={l.id} link={l} />)}</div>}
        {goalLinks.length > 0 && <div className="space-y-1.5">{goalLinks.map(l => <LinkedGoalRow key={l.id} link={l} />)}</div>}
      </div>
    </section>
  );
}

function LinkPicker({ pageId, kind, existing, onDone }: { pageId: string; kind: 'task' | 'habit' | 'goal'; existing: string[]; onDone: () => void }) {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const habits = useLiveQuery(() => db.habits.toArray(), []) ?? [];
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? [];
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const label = (item: any) => item.title || item.name;
  const items = (kind === 'task' ? tasks : kind === 'habit' ? habits : goals).filter(item => !existing.includes(item.id) && (!needle || label(item).toLowerCase().includes(needle)));

  const pick = async (id: string) => { await addLink(pageId, kind, id); onDone(); };

  return (
    <div className="mb-3 rounded-lg border border-line bg-surface/60 p-2">
      <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${kind}s…`} className="w-full h-8 rounded-xl bg-surface-2 border border-line px-2 text-sm outline-none mb-1.5" />
      <div className="max-h-40 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-xs text-fg-subtle px-1 py-2">No matches.</p>
        ) : items.slice(0, 8).map(item => (
          <button key={item.id} onClick={() => void pick(item.id)} className="w-full text-left px-2 py-1.5 rounded-xl text-sm text-fg-soft hover:bg-hover truncate">
            {label(item)}
          </button>
        ))}
      </div>
    </div>
  );
}

function LinkedTaskRow({ link }: { link: PageLink }) {
  const task = useLiveQuery(() => db.tasks.get(link.targetId), [link.targetId]);
  if (task === undefined) return null;
  if (!task) return null; // the task was deleted; the dangling link is cleaned up by deleteTask/bulkDelete
  const done = task.status === 'Submitted/Done';
  return (
    <div className="group flex items-center gap-2 text-sm">
      {done ? <Check size={14} className="text-fg-muted shrink-0" /> : <Circle size={14} className="text-fg-subtle shrink-0" />}
      <span className={`min-w-0 truncate ${done ? 'line-through text-fg-subtle' : 'text-fg-soft'}`}>{task.title}</span>
      {task.dueDate && <span className="text-xs text-fg-subtle shrink-0">{relativeDay(task.dueDate)}</span>}
      <button onClick={() => void removeLink(link.id)} aria-label={`Unlink ${task.title}`} className="ml-auto shrink-0 text-fg-subtle hover:text-fg-soft opacity-0 group-hover:opacity-100"><X size={13} /></button>
    </div>
  );
}

function LinkedHabitRow({ link }: { link: PageLink }) {
  const habit = useLiveQuery(() => db.habits.get(link.targetId), [link.targetId]);
  if (habit === undefined) return null;
  if (!habit) return null;
  const streak = computeStreaks(habit.completions, isoToday()).current;
  return (
    <div className="group flex items-center gap-2 text-sm">
      <ListChecks size={14} className="text-fg-subtle shrink-0" />
      <span className="min-w-0 truncate text-fg-soft">{habit.name}</span>
      {streak > 0 && <span className="flex items-center gap-1 text-xs text-fg-muted shrink-0"><Flame size={11} />{streak}</span>}
      <button onClick={() => void removeLink(link.id)} aria-label={`Unlink ${habit.name}`} className="ml-auto shrink-0 text-fg-subtle hover:text-fg-soft opacity-0 group-hover:opacity-100"><X size={13} /></button>
    </div>
  );
}


function LinkedGoalRow({ link }: { link: PageLink }) {
  const goal = useLiveQuery(() => db.goals.get(link.targetId), [link.targetId]);
  if (goal === undefined) return null;
  if (!goal) return null;
  const pct = Math.min(100, Math.max(0, (goal.currentValue / goal.targetValue) * 100));
  return (
    <div className="group flex items-center gap-2 text-sm">
      <Target size={14} className="text-fg-subtle shrink-0" />
      <span className="min-w-0 truncate text-fg-soft">{goal.title}</span>
      <span className="flex items-center gap-1 text-xs text-fg-muted shrink-0 tabular-nums ml-1">
        {Math.round(pct)}%
      </span>
      <button onClick={() => void removeLink(link.id)} aria-label={`Unlink ${goal.title}`} className="ml-auto shrink-0 text-fg-subtle hover:text-fg-soft opacity-0 group-hover:opacity-100"><X size={13} /></button>
    </div>
  );
}
