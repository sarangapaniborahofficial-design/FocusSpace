import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, Calendar, Check, Download, Flame, Keyboard, Palette, Pencil, Plus, RefreshCw, Smartphone, Target, Trash2, Upload, X, Zap } from 'lucide-react';
import { isNotificationSupported, getNotificationPermission, requestNotificationPermission, sendNotification } from '../lib/notifications';
import { useEffect, useRef, useState } from 'react';
import { db } from '../db/db';
import { loadSchedulePreferences, saveSchedulePreferences } from '../lib/smartScheduler';
import { exportBackup, currentReminderState, daysSince, shouldRemindBackup, snoozeBackupReminder } from '../lib/backupExport';
import { base64ToBlob, formatBytes } from '../lib/files';
import { HABIT_COLORS, addHabit, deleteHabit, updateHabit } from '../lib/habitActions';
import { useToday, usePWAInstall } from '../lib/hooks';
import { buildICS, scheduledTasks } from '../lib/ics';
import { GOALS_KEY } from '../lib/goals';
import { normalizeCategory, normalizeFile, normalizeHabit, normalizeJournalEntry, normalizeList, normalizeLog, normalizePage, normalizePageLink, normalizeTask } from '../lib/normalize';
import { computeStreaks } from '../lib/analytics';
import { DURATIONS_KEY, timer } from '../lib/timer';
import { toast } from '../lib/toast';
import { storage, uid } from '../lib/utils';
import type { Category, Habit } from '../types';

const themes = [
  { id: 'nocturne', name: 'Nocturne Solaris (Dark)', description: 'Pitch-black anodized dot-matrix, warm stone borders & vermilion orange' },
  { id: 'onyx', name: 'Swiss Onyx (Dark)', description: 'Pitch-black architectural grid, brutalist offset shadows & acid citron' },
  { id: 'solaris', name: 'Solaris (Light)', description: 'Warm analog paper, vermilion orange & botanical sage' },
  { id: 'bauhaus', name: 'Swiss Brutal (Light)', description: 'High-contrast architectural grid, hard offset shadows & acid citron' },
];

const layouts: { id: 'orbital' | 'cockpit'; name: string; description: string }[] = [
  { id: 'orbital', name: 'Floating Layout', description: 'Floating cards & sidebar rail with compact mini-timer' },
  { id: 'cockpit', name: 'Split View (Docked Timer)', description: 'Full-width workspace with Pomodoro timer docked on the right' },
];

export function Settings({ theme, setTheme, layoutMode = 'orbital', setLayoutMode }: { theme: string; setTheme: (theme: string) => void; layoutMode?: 'orbital' | 'cockpit'; setLayoutMode?: (m: 'orbital' | 'cockpit') => void }) {
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const { isInstallable, install } = usePWAInstall();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#60a5fa');
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [includeFiles, setIncludeFiles] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!deleteTarget) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDeleteTarget(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteTarget]);

  const startCreate = () => { setEditing(null); setCreating(true); setNewName(''); setNewColor('#60a5fa'); setTimeout(() => inputRef.current?.focus(), 0); };
  const saveCategory = async () => {
    const name = newName.trim();
    if (!name) return;
    const duplicate = categories.some(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== editing?.id);
    if (duplicate) { toast('A category with that name already exists.', 'error'); return; }
    if (editing) await db.categories.put({ ...editing, name, color: newColor });
    else await db.categories.add({ id: uid(), name, color: newColor });
    setEditing(null); setCreating(false); setNewName('');
  };

  const openEdit = (category: Category) => { setCreating(false); setEditing(category); setNewName(category.name); setNewColor(category.color); setTimeout(() => inputRef.current?.focus(), 0); };

  const removeCategory = async () => {
    if (!deleteTarget) return;
    if (!moveTo) return;
    setBusy(true);
    try {
      await db.transaction('rw', db.categories, db.tasks, db.pages, async () => {
        await db.tasks.where('categoryId').equals(deleteTarget.id).modify({ categoryId: moveTo });
        await db.pages.where('categoryId').equals(deleteTarget.id).modify({ categoryId: moveTo });
        await db.categories.delete(deleteTarget.id);
      });
      setDeleteTarget(null); setMoveTo('');
    } finally { setBusy(false); }
  };

  const exportData = async () => {
    setBusy(true);
    try { await exportBackup({ includeFiles, theme }); }
    finally { setBusy(false); }
  };

  const importData = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      let raw: any;
      try { raw = JSON.parse(await file.text()); } catch { throw new Error('That file is not valid JSON.'); }
      if (raw?.app !== 'FocusSpace' || !Array.isArray(raw.categories) || !Array.isArray(raw.tasks) || !Array.isArray(raw.habits) || !Array.isArray(raw.focusLogs)) throw new Error('This is not a FocusSpace backup file.');

      // Repair what can be repaired and drop the rest, so one bad record can't break the app after import.
      const cats = normalizeList(raw.categories, normalizeCategory);
      if (!cats.items.length) throw new Error('Backup contains no valid categories.');
      const categoryIds = new Set(cats.items.map(c => c.id));
      const tasks = normalizeList(raw.tasks, normalizeTask);
      const habits = normalizeList(raw.habits, normalizeHabit);
      const logs = normalizeList(raw.focusLogs, normalizeLog);
      const hasPages = Array.isArray(raw.pages); // backups from before pages existed have none
      const hasJournal = Array.isArray(raw.journalEntries); // backups from before rich-text pages (v2) have none
      const pagesRaw = normalizeList(raw.pages, normalizePage);
      const backupFiles = normalizeList(raw.files, normalizeFile);
      const entriesRaw = normalizeList(raw.journalEntries, normalizeJournalEntry);
      const linksRaw = normalizeList(raw.pageLinks, normalizePageLink);

      const validTasks = tasks.items.filter(t => categoryIds.has(t.categoryId));
      const validTaskIds = new Set(validTasks.map(t => t.id));
      const validHabitIds = new Set(habits.items.map(h => h.id));
      // A page with no category, or one that no longer exists, still stands on its own (categories are optional).
      const validPages = pagesRaw.items.map(p => (p.categoryId && !categoryIds.has(p.categoryId) ? { ...p, categoryId: undefined } : p));
      const pageIds = new Set(validPages.map(p => p.id));
      const validFiles = backupFiles.items.filter(f => pageIds.has(f.pageId));
      const validEntries = entriesRaw.items.filter(e => pageIds.has(e.pageId));
      const validLinks = linksRaw.items.filter(l => pageIds.has(l.pageId) && (l.kind === 'task' ? validTaskIds.has(l.targetId) : l.kind === 'habit' ? validHabitIds.has(l.targetId) : true));
      const skipped = cats.skipped + tasks.skipped + (tasks.items.length - validTasks.length) + habits.skipped + logs.skipped
        + pagesRaw.skipped + backupFiles.skipped + (backupFiles.items.length - validFiles.length)
        + entriesRaw.skipped + (entriesRaw.items.length - validEntries.length) + linksRaw.skipped + (linksRaw.items.length - validLinks.length);

      const summary = `${validTasks.length} tasks, ${cats.items.length} categories, ${habits.items.length} habits, ${logs.items.length} focus logs, ${validPages.length} pages and ${validFiles.length} files`;
      const note = !hasPages ? ' This backup predates pages, so your current pages and files will be removed.'
        : !hasJournal ? ' This backup predates rich-text pages, so your current pages, journal entries and links will be replaced with whatever this older backup has.'
        : raw.filesIncluded === false ? ' Files were not included in this backup, so current attached files will be removed.' : '';
      if (!confirm(`Import ${summary}? Existing local data will be replaced.${note}`)) return;

      const blobs = validFiles.flatMap(f => {
        try { return [{ id: f.id, blob: base64ToBlob(f.data, f.type) }]; } catch { return []; }
      });
      const blobIds = new Set(blobs.map(b => b.id));
      const storedFiles = validFiles.filter(f => blobIds.has(f.id)).map(({ data: _data, ...meta }) => meta);

      await db.transaction('rw', [db.categories, db.tasks, db.habits, db.focusLogs, db.pages, db.files, db.fileBlobs, db.journalEntries, db.pageLinks], async () => {
        await Promise.all([db.categories.clear(), db.tasks.clear(), db.habits.clear(), db.focusLogs.clear(), db.pages.clear(), db.files.clear(), db.fileBlobs.clear(), db.journalEntries.clear(), db.pageLinks.clear()]);
        await db.categories.bulkAdd(cats.items); await db.tasks.bulkAdd(validTasks); await db.habits.bulkAdd(habits.items); await db.focusLogs.bulkAdd(logs.items);
        await db.pages.bulkAdd(validPages); await db.files.bulkAdd(storedFiles); await db.fileBlobs.bulkAdd(blobs);
        await db.journalEntries.bulkAdd(validEntries); await db.pageLinks.bulkAdd(validLinks);
      });
      timer.setTask(undefined); // the attached task may no longer exist
      if (typeof raw.pomodoroDurations === 'string') { storage.set(DURATIONS_KEY, raw.pomodoroDurations); timer.reloadDurations(); }
      if (typeof raw.goals === 'string') storage.set(GOALS_KEY, raw.goals);
      if (typeof raw.theme === 'string') { storage.set('focusspace-theme', raw.theme); setTheme(raw.theme); }
      const dropped = skipped + (validFiles.length - storedFiles.length);
      toast(`Imported ${summary}${dropped ? ` (${dropped} unusable ${dropped === 1 ? 'record was' : 'records were'} skipped)` : ''}.`, 'success', { duration: 8000 });
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not import backup.', 'error', { duration: 7000 }); }
    finally { setBusy(false); }
  };

  return <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-5">
    <div><div className="text-xs uppercase tracking-[.18em] text-fg-subtle">System</div><h1 className="text-2xl font-semibold mt-1">Settings</h1><p className="text-sm text-fg-muted mt-1">Own the workspace. Everything stays local unless you export it.</p></div>
    <BackupReminder onExport={() => void exportData()} />
    <section className="atelier-card rounded-3xl overflow-hidden">
      <div className="p-5 border-b border-line"><div className="flex items-center gap-2 font-semibold"><Palette size={16} className="text-accent-text"/> Appearance & Layout</div><p className="text-xs text-fg-subtle mt-1">Switch between three bespoke aesthetic personas and two spatial layout architectures.</p></div>
      <div className="p-5 space-y-5">
        <div>
          <div className="index-chip text-fg-subtle mb-2.5">Theme</div>
          <div className="grid sm:grid-cols-2 gap-3">{themes.map(t => <button key={t.id} onClick={()=>{setTheme(t.id);localStorage.setItem('focusspace-theme',t.id)}} className={`text-left rounded-2xl border p-4 transition ${theme===t.id?'border-line-strong bg-surface-2 keycap':'border-line bg-surface/30 hover:bg-hover'}`}><div className="flex items-center justify-between"><span className="text-sm font-semibold">{t.name}</span>{theme===t.id && <span className="size-2 rounded-full bg-accent"/>}</div><div className="text-xs text-fg-subtle mt-1">{t.description}</div></button>)}</div>
        </div>
        {setLayoutMode && (
          <div>
            <div className="index-chip text-fg-subtle mb-2.5">Navigation & Layout Style</div>
            <div className="grid md:grid-cols-2 gap-3">{layouts.map(l => <button key={l.id} onClick={()=>setLayoutMode(l.id)} className={`text-left rounded-2xl border p-4 transition ${layoutMode===l.id?'border-line-strong bg-surface-2 keycap':'border-line bg-surface/30 hover:bg-hover'}`}><div className="flex items-center justify-between"><span className="text-sm font-semibold">{l.name}</span>{layoutMode===l.id && <span className="size-2 rounded-full bg-accent"/>}</div><div className="text-xs text-fg-subtle mt-1">{l.description}</div></button>)}</div>
          </div>
        )}
      </div>
    </section>

    <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
      <div className="p-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 font-medium"><Smartphone size={16}/> Install App</div>
          <p className="text-xs text-fg-subtle mt-1">Install FocusSpace to your device for native offline access.</p>
        </div>
        <button onClick={install} className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-sm font-medium flex items-center gap-2 hover:bg-hover transition">
          <Download size={15}/> Install
        </button>
      </div>
    </section>

    <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
      <div className="p-5 border-b border-line flex items-center justify-between"><div><div className="font-medium">Categories</div><p className="text-xs text-fg-subtle mt-1">Create, rename and recolor your workspaces.</p></div><button onClick={startCreate} className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-sm font-medium flex items-center gap-1.5"><Plus size={15}/> Add category</button></div>
      <div className="p-4 space-y-2">{categories.map(c => <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3"><span className="size-3 rounded-full" style={{background:c.color}}/><div className="flex-1 min-w-0"><div className="text-sm truncate">{c.name}</div><div className="text-[11px] text-fg-subtle">{c.id}</div></div><button onClick={()=>openEdit(c)} className="text-xs text-fg-muted hover:text-fg px-2 py-1.5 rounded-xl hover:bg-hover">Edit</button><button onClick={()=>{setDeleteTarget(c);setMoveTo(categories.find(x=>x.id!==c.id)?.id??'')}} className="text-fg-subtle hover:text-red-300 p-2 rounded-xl hover:bg-hover" title="Delete"><Trash2 size={15}/></button></div>)}</div>
      {(editing || creating) && <div className="p-4 border-t border-line bg-surface/30"><div className="grid sm:grid-cols-[1fr_110px_auto] gap-2 items-end"><label className="text-xs text-fg-muted">Name<input ref={inputRef} value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Valorant" className="mt-1 w-full h-10 rounded-lg bg-surface-2 border border-line px-3 text-sm outline-none"/></label><label className="text-xs text-fg-muted">Color<input type="color" value={newColor} onChange={e=>setNewColor(e.target.value)} className="mt-1 w-full h-10 rounded-lg bg-surface-2 border border-line p-1"/></label><div className="flex gap-2"><button onClick={()=>{setEditing(null);setCreating(false);setNewName('')}} className="h-8 px-2 rounded-xl text-sm text-fg-muted hover:bg-hover">Cancel</button><button onClick={saveCategory} className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-sm font-medium">Save</button></div></div></div>}
    </section>

    <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden"><div className="p-5 border-b border-line"><div className="font-medium">Data ownership</div><p className="text-xs text-fg-subtle mt-1">Export everything or restore a previous FocusSpace backup.</p></div><div className="p-5 flex flex-wrap gap-3"><button onClick={()=>void exportData()} disabled={busy} className="h-8 px-3 rounded-xl border border-line bg-surface-2 text-sm flex items-center gap-2 hover:bg-hover disabled:opacity-50"><Download size={15}/> Export JSON</button><label className="h-8 px-3 rounded-xl border border-line bg-surface-2 text-sm flex items-center gap-2 hover:bg-hover cursor-pointer"><Upload size={15}/> Import JSON<input type="file" accept="application/json,.json" className="hidden" disabled={busy} onChange={e=>{void importData(e.target.files?.[0]);e.currentTarget.value=''}}/></label><button onClick={()=>{storage.remove(DURATIONS_KEY);timer.reloadDurations();toast('Timer durations reset to 25 / 5 / 15.','success')}} className="h-8 px-3 rounded-xl text-sm text-fg-subtle hover:text-fg flex items-center gap-2"><RefreshCw size={14}/> Reset timer defaults</button></div><div className="px-5 pb-5 space-y-3"><label className="flex items-center gap-2 text-xs text-fg-muted cursor-pointer w-fit"><input type="checkbox" checked={includeFiles} onChange={e=>setIncludeFiles(e.target.checked)} className="accent-accent"/> Include attached files in the export (they are embedded, so the file gets larger)</label><StorageInfo/></div></section>

    <IcsExportCard />
    <HabitsCard />
    <NotificationsCard />
    <GoalsCard />
    <SchedulingPreferencesCard />

    <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
      <div className="p-5 border-b border-line"><div className="flex items-center gap-2 font-medium"><Keyboard size={16}/> Keyboard shortcuts</div><p className="text-xs text-fg-subtle mt-1">Available from any view. Use ⌘ instead of Ctrl on a Mac.</p></div>
      <dl className="p-5 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">{[['Ctrl K','Search tasks and run commands'],['Ctrl N','Quick add a task'],['Ctrl /','Open shortcuts cheatsheet'],['Space','Start or pause the timer'],['Ctrl 1-5','Quick view navigation'],['Esc','Close a dialog']].map(([keys,what])=><div key={keys} className="flex items-center justify-between gap-4"><dt className="text-fg-muted">{what}</dt><dd><kbd className="text-[11px] border border-line rounded px-1.5 py-0.5 text-fg-soft">{keys}</kbd></dd></div>)}</dl>
    </section>

    {deleteTarget && <div className="fade-in fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onMouseDown={()=>setDeleteTarget(null)}><div role="dialog" aria-modal="true" aria-label={`Delete ${deleteTarget.name}`} onMouseDown={e=>e.stopPropagation()} className="pop-in w-full max-w-md rounded-2xl border border-line bg-surface shadow-2xl p-5"><div className="flex items-start justify-between"><div><h2 className="font-semibold">Delete {deleteTarget.name}?</h2><p className="text-xs text-fg-subtle mt-1">Tasks and pages in this category must be moved before it is deleted.</p></div><button onClick={()=>setDeleteTarget(null)}><X size={17} className="text-fg-subtle"/></button></div><label className="block text-xs text-fg-muted mt-5">Move tasks and pages to<select value={moveTo} onChange={e=>setMoveTo(e.target.value)} className="mt-1 w-full h-10 rounded-lg bg-surface-2 border border-line px-3 text-sm">{categories.filter(c=>c.id!==deleteTarget.id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="flex justify-end gap-2 mt-5"><button onClick={()=>setDeleteTarget(null)} className="h-8 px-3 rounded-xl text-sm text-fg-muted">Cancel</button><button disabled={!moveTo||busy} onClick={()=>void removeCategory()} className="h-8 px-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium disabled:opacity-40 transition-colors">Move & delete</button></div></div></div>}
  </div>;
}

/** Attached-file usage plus the browser's overall storage estimate for this site. */
function StorageInfo() {
  const files = useLiveQuery(() => db.files.toArray(), []);
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    navigator.storage?.estimate?.().then(e => { if (!cancelled && e.usage !== undefined && e.quota) setEstimate({ usage: e.usage, quota: e.quota }); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [files]);
  const count = files?.length ?? 0;
  const bytes = (files ?? []).reduce((sum, f) => sum + f.size, 0);
  return (
    <p className="text-xs text-fg-subtle">
      {count ? `${count} attached ${count === 1 ? 'file' : 'files'} · ${formatBytes(bytes)}` : 'No attached files'}
      {estimate ? ` · this site uses ${formatBytes(estimate.usage)} of roughly ${formatBytes(estimate.quota)} available in this browser` : ''}
    </p>
  );
}

/** Nudges toward a backup once there's real data and it's been a while. Dismissible for a week. */
function BackupReminder({ onExport }: { onExport: () => void }) {
  const taskCount = useLiveQuery(() => db.tasks.count(), []);
  const [, forceRender] = useState(0);
  if (taskCount === undefined) return null;
  const { lastBackup, snoozedUntil } = currentReminderState();
  if (!shouldRemindBackup({ records: taskCount, lastBackup, snoozedUntil })) return null;
  const never = !lastBackup;
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
      <span className="text-amber-200 flex-1 min-w-[200px]">
        {never ? "You haven't exported a backup yet." : `It's been a while since your last backup (${daysSince(lastBackup)} days ago).`} Your data lives only in this browser.
      </span>
      <button onClick={onExport} className="h-8 px-3 rounded-xl bg-amber-400 text-amber-950 text-xs font-medium">Export now</button>
      <button onClick={() => { snoozeBackupReminder(); forceRender(n => n + 1); }} className="h-8 px-3 rounded-xl text-xs text-amber-200/80 hover:text-amber-100">Remind me later</button>
    </div>
  );
}

/** Download a .ics file of scheduled tasks for import into an external calendar app. */
function IcsExportCard() {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const [includeDone, setIncludeDone] = useState(false);
  const count = tasks ? scheduledTasks(tasks, { includeDone }).length : 0;

  const download = () => {
    if (!tasks) return;
    const { text, count: n } = buildICS(tasks, categories, { includeDone });
    if (n === 0) { toast('No scheduled tasks (with a due date and time) to export.', 'info'); return; }
    const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'focusspace-schedule.ics';
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    toast(`Exported ${n} scheduled ${n === 1 ? 'task' : 'tasks'} to focusspace-schedule.ics`, 'success');
  };

  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
      <div className="p-5 border-b border-line"><div className="flex items-center gap-2 font-medium"><Calendar size={16} /> Calendar export</div><p className="text-xs text-fg-subtle mt-1">Download a .ics file of tasks that have a due date and time, to import into Google Calendar, Apple Calendar or Outlook.</p></div>
      <div className="p-5 flex flex-wrap items-center gap-3">
        <button onClick={download} disabled={!tasks} className="h-8 px-3 rounded-xl border border-line bg-surface-2 text-sm flex items-center gap-2 hover:bg-hover disabled:opacity-50"><Download size={15} /> Export .ics{tasks ? ` (${count})` : ''}</button>
        <label className="flex items-center gap-2 text-xs text-fg-muted cursor-pointer">
          <input type="checkbox" checked={includeDone} onChange={e => setIncludeDone(e.target.checked)} className="accent-accent" /> Include completed tasks
        </label>
      </div>
    </section>
  );
}

/** Add, rename, recolor and archive habits. Active habits are what shows up as one-tap check-ins on Today. */
function HabitsCard() {
  const habits = useLiveQuery(() => db.habits.toArray(), []) ?? [];
  const today = useToday();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [newColor, setNewColor] = useState(HABIT_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(HABIT_COLORS[0]);

  const create = async () => {
    const habit = await addHabit({ name, color: newColor });
    if (habit) { setName(''); setNewColor(HABIT_COLORS[0]); setCreating(false); } else toast('Give the habit a name first.', 'error');
  };
  const startEdit = (h: Habit) => { setEditingId(h.id); setEditName(h.name); setEditColor(h.color); };
  const saveEdit = async () => {
    if (editingId && editName.trim()) await updateHabit(editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
      <div className="p-5 border-b border-line flex items-center justify-between">
        <div><div className="font-medium">Habits</div><p className="text-xs text-fg-subtle mt-1">Active habits show up on Today as one-tap check-ins.</p></div>
        <button onClick={() => { setCreating(true); setName(''); setNewColor(HABIT_COLORS[0]); }} className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-sm font-medium flex items-center gap-1.5"><Plus size={15} /> Add habit</button>
      </div>
      <div className="p-4 space-y-2">
        {habits.length === 0 && !creating && <p className="text-sm text-fg-subtle px-1 py-2">No habits yet. Add one to start tracking daily streaks.</p>}
        {habits.map(h => {
          const streak = computeStreaks(h.completions, today).current;
          const editingThis = editingId === h.id;
          return (
            <div key={h.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border p-3 ${h.active ? 'border-line bg-surface/40' : 'border-line bg-surface/20 opacity-60'}`}>
              <span className="size-3.5 rounded-full shrink-0" style={{ background: editingThis ? editColor : h.color }} />
              {editingThis ? (
                <div className="flex-1 flex flex-wrap items-center gap-2 min-w-0">
                  <input autoFocus value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void saveEdit(); if (e.key === 'Escape') setEditingId(null); }} className="flex-1 min-w-[160px] h-8 rounded-xl bg-surface-2 border border-line px-2 text-sm outline-none" />
                  <div className="flex items-center gap-1">
                    {HABIT_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        aria-label={`Select color ${c}`}
                        className={`size-5 rounded-full transition-transform ${editColor === c ? 'scale-110 ring-2 ring-offset-2 ring-accent ring-offset-surface' : 'opacity-70 hover:opacity-100'}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{h.name}{!h.active && <span className="text-fg-subtle"> · archived</span>}</div>
                  {streak > 0 && <div className="text-[11px] text-fg-subtle flex items-center gap-1"><Flame size={11} />{streak}-day streak</div>}
                </div>
              )}
              <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                {editingThis ? (
                  <button onClick={() => void saveEdit()} className="text-xs text-fg-soft hover:text-fg px-2 py-1.5 rounded-xl hover:bg-hover"><Check size={14} /></button>
                ) : (
                  <button onClick={() => startEdit(h)} aria-label={`Rename ${h.name}`} className="text-fg-muted hover:text-fg p-2 rounded-xl hover:bg-hover"><Pencil size={14} /></button>
                )}
                <button onClick={() => void updateHabit(h.id, { active: !h.active })} className="text-xs text-fg-muted hover:text-fg px-2 py-1.5 rounded-xl hover:bg-hover">{h.active ? 'Archive' : 'Restore'}</button>
                <button onClick={() => void deleteHabit(h.id)} aria-label={`Delete ${h.name}`} className="text-fg-subtle hover:text-rose-500 p-2 rounded-xl hover:bg-hover" title="Delete"><Trash2 size={15} /></button>
              </div>
            </div>
          );
        })}
      </div>
      {creating && (
        <div className="p-4 border-t border-line bg-surface/30">
          <div className="flex flex-col sm:flex-row gap-3">
            <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void create(); }} placeholder="e.g. Read 20 minutes" className="flex-1 h-10 rounded-lg bg-surface-2 border border-line px-3 text-sm outline-none" />
            <div className="flex items-center gap-1.5 self-center">
              {HABIT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  aria-label={`Select color ${c}`}
                  className={`size-6 rounded-full transition-transform ${newColor === c ? 'scale-110 ring-2 ring-offset-2 ring-accent ring-offset-surface' : 'opacity-70 hover:opacity-100'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCreating(false)} className="h-8 px-2 rounded-xl text-sm text-fg-muted hover:bg-hover">Cancel</button>
              <button onClick={() => void create()} className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-sm font-medium hover:bg-accent-hover">Save</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


function GoalsCard() {
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? [];
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [metricLabel, setMetricLabel] = useState('');
  const [targetValue, setTargetValue] = useState('10');
  const [deadline, setDeadline] = useState('');

  const create = async () => {
    if (!title.trim() || !metricLabel.trim()) return toast('Please fill in title and metric.', 'error');
    const target = parseFloat(targetValue);
    if (isNaN(target) || target <= 0) return toast('Target must be a positive number.', 'error');
    
    await db.goals.add({
      id: uid(),
      title: title.trim(),
      metricLabel: metricLabel.trim(),
      currentValue: 0,
      targetValue: target,
      deadline: deadline || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setCreating(false); setTitle(''); setMetricLabel(''); setTargetValue('10'); setDeadline('');
    toast('Goal created.', 'success');
  };

  const deleteGoal = async (id: string) => {
    await db.goals.delete(id);
    toast('Goal deleted.');
  };

  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
      <div className="p-5 border-b border-line flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 font-medium"><Target size={16}/> Goals</div>
          <p className="text-xs text-fg-subtle mt-1">Track larger milestones and measurable targets.</p>
        </div>
        <button onClick={() => setCreating(true)} className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-sm font-medium flex items-center gap-1.5 hover:bg-accent-hover"><Plus size={15} /> Add goal</button>
      </div>
      <div className="p-4 space-y-2">
        {goals.length === 0 && !creating && <p className="text-sm text-fg-subtle px-1 py-2">No goals yet. Add a big milestone to track.</p>}
        {goals.map(g => {
          const pct = Math.min(100, Math.max(0, (g.currentValue / g.targetValue) * 100));
          return (
            <div key={g.id} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate text-fg">{g.title}</div>
                  <div className="text-xs text-fg-muted mt-0.5">{g.currentValue} / {g.targetValue} {g.metricLabel}{g.deadline ? ` · Target: ${g.deadline}` : ''}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => {
                    const nextStr = window.prompt(`Update progress for ${g.title} (current: ${g.currentValue}):`, String(g.currentValue));
                    if (nextStr === null) return;
                    const next = parseFloat(nextStr);
                    if (!isNaN(next)) {
                      db.goals.update(g.id, { currentValue: next, updatedAt: new Date().toISOString() });
                    }
                  }} className="text-xs text-fg-muted hover:text-fg px-2 py-1.5 rounded-xl hover:bg-hover">Update</button>
                  <button onClick={() => deleteGoal(g.id)} className="text-fg-subtle hover:text-red-300 p-2 rounded-xl hover:bg-hover" title="Delete"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-[var(--ring-track)] overflow-hidden">
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {creating && (
          <div className="rounded-xl border border-line bg-surface p-4 shadow-card space-y-3">
            <div>
              <label className="text-[11px] font-medium text-fg-muted uppercase tracking-widest block mb-1">Goal title</label>
              <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Run a marathon" className="w-full h-8 rounded-xl bg-surface-2 border border-line px-2 text-sm outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-fg-muted uppercase tracking-widest block mb-1">Target value</label>
                <input type="number" min="1" value={targetValue} onChange={e => setTargetValue(e.target.value)} className="w-full h-8 rounded-xl bg-surface-2 border border-line px-2 text-sm outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-fg-muted uppercase tracking-widest block mb-1">Metric label</label>
                <input value={metricLabel} onChange={e => setMetricLabel(e.target.value)} placeholder="e.g. km, books, $" className="w-full h-8 rounded-xl bg-surface-2 border border-line px-2 text-sm outline-none" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-fg-muted uppercase tracking-widest block mb-1">Deadline (Optional)</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full h-8 rounded-xl bg-surface-2 border border-line px-2 text-sm outline-none text-fg-soft" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setCreating(false)} className="h-8 px-3 rounded-xl text-sm text-fg-muted hover:bg-hover">Cancel</button>
              <button onClick={create} disabled={!title.trim() || !metricLabel.trim()} className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-sm font-medium hover:bg-accent-hover disabled:opacity-40">Save goal</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function NotificationsCard() {
  const supported = isNotificationSupported();
  const [permission, setPermission] = useState<NotificationPermission>(() => getNotificationPermission());
  const [notifyOverdue, setNotifyOverdue] = useState<boolean>(() => (storage.get('focusspace-notify-overdue') ?? 'true') === 'true');

  const enable = async () => {
    const granted = await requestNotificationPermission();
    setPermission(getNotificationPermission());
    if (granted) {
      toast('Notifications enabled!', 'success');
      sendNotification('FocusSpace Notifications', {
        body: 'Native notifications are now active for timers and reminders.',
      });
    } else {
      toast('Notification permission was not granted.', 'info');
    }
  };

  const testNotif = () => {
    const n = sendNotification('FocusSpace Test', {
      body: 'This is a test alert. Your timer alerts will appear like this!',
    });
    if (!n) {
      toast('Please enable notifications first.', 'error');
    }
  };

  const toggleOverdue = (checked: boolean) => {
    setNotifyOverdue(checked);
    storage.set('focusspace-notify-overdue', checked ? 'true' : 'false');
  };

  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
      <div className="p-5 border-b border-line flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 font-medium"><Bell size={16} /> Native Notifications</div>
          <p className="text-xs text-fg-subtle mt-1">Get alerts when Pomodoro timers finish or when tasks are overdue.</p>
        </div>
        {supported && permission !== 'granted' && (
          <button onClick={enable} className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-sm font-medium hover:bg-accent-hover">
            Enable
          </button>
        )}
      </div>
      <div className="p-5 space-y-4">
        {!supported ? (
          <p className="text-sm text-fg-muted">Native notifications are not supported in this browser.</p>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-fg-soft">Browser permission status:</span>
              <span className={`px-2 py-0.5 rounded-md text-xs font-medium uppercase tracking-wider ${permission === 'granted' ? 'bg-accent/20 text-accent-text' : permission === 'denied' ? 'bg-red-500/20 text-red-500' : 'bg-surface-3 text-fg-muted'}`}>
                {permission}
              </span>
            </div>

            {permission === 'granted' && (
              <div className="pt-1 flex flex-wrap gap-4 items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-fg-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyOverdue}
                    onChange={e => toggleOverdue(e.target.checked)}
                    className="accent-accent"
                  />
                  Remind me about overdue tasks once per day
                </label>
                <button
                  onClick={testNotif}
                  className="h-7 px-3 rounded-lg border border-line bg-surface-2 text-xs text-fg-soft hover:bg-hover"
                >
                  Send test notification
                </button>
              </div>
            )}

            {permission === 'denied' && (
              <p className="text-xs text-fg-muted">
                Notifications are blocked by your browser settings. You can re-enable them in your browser site permissions.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function SchedulingPreferencesCard() {
  const [prefs, setPrefs] = useState(() => loadSchedulePreferences());

  const update = (patch: Partial<typeof prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveSchedulePreferences(next);
    toast('Scheduling preferences saved.', 'info');
  };

  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
      <div className="p-5 border-b border-line">
        <div className="flex items-center gap-2 font-medium"><Zap size={16} /> Focus & Smart Scheduling</div>
        <p className="text-xs text-fg-subtle mt-1">Configure your target workday hours and buffers for the AI plan optimizer.</p>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          <label className="block text-xs text-fg-muted">
            <span className="block mb-1.5 font-medium text-fg-soft">Workday starts</span>
            <input
              type="time"
              value={prefs.workdayStart}
              onChange={e => update({ workdayStart: e.target.value })}
              className="w-full h-10 rounded-xl bg-surface-2 border border-line px-3 text-sm text-fg outline-none"
            />
          </label>
          <label className="block text-xs text-fg-muted">
            <span className="block mb-1.5 font-medium text-fg-soft">Workday cutoff</span>
            <input
              type="time"
              value={prefs.workdayEnd}
              onChange={e => update({ workdayEnd: e.target.value })}
              className="w-full h-10 rounded-xl bg-surface-2 border border-line px-3 text-sm text-fg outline-none"
            />
          </label>
          <label className="block text-xs text-fg-muted">
            <span className="block mb-1.5 font-medium text-fg-soft">Post-meeting buffer</span>
            <select
              value={prefs.bufferMinutes}
              onChange={e => update({ bufferMinutes: Number(e.target.value) })}
              className="w-full h-10 rounded-xl bg-surface-2 border border-line px-3 text-sm text-fg outline-none"
            >
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={20}>20 minutes</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-fg-subtle">The smart scheduler will align deep work blocks to these hours and warn if tasks push past your cutoff.</p>
      </div>
    </section>
  );
}

