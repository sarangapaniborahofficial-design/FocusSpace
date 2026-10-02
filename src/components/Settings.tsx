import { useLiveQuery } from 'dexie-react-hooks';
import { Calendar, Check, Download, Flame, Keyboard, Palette, Pencil, Plus, RefreshCw, Smartphone, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { db } from '../db/db';
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
  { id: 'dark', name: 'Dark', description: 'zinc workspace with soft contrast' },
  { id: 'oled', name: 'OLED Black', description: 'Pure black for low-light setups' },
  { id: 'light', name: 'Light', description: 'Bright neutral workspace' },
];

export function Settings({ theme, setTheme }: { theme: string; setTheme: (theme: string) => void }) {
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
    <div><div className="text-xs uppercase tracking-[.18em] text-zinc-300">System</div><h1 className="text-2xl font-semibold mt-1">Settings</h1><p className="text-sm text-zinc-400 mt-1">Own the workspace. Everything stays local unless you export it.</p></div>
    <BackupReminder onExport={() => void exportData()} />
    <section className="rounded-2xl border border-zinc-100 bg-zinc-50/40 overflow-hidden">
      <div className="p-5 border-b border-zinc-100"><div className="flex items-center gap-2 font-medium"><Palette size={16}/> Appearance</div><p className="text-xs text-zinc-300 mt-1">Choose how FocusSpace looks on this device.</p></div>
      <div className="p-5 grid md:grid-cols-3 gap-3">{themes.map(t => <button key={t.id} onClick={()=>{setTheme(t.id);localStorage.setItem('focusspace-theme',t.id)}} className={`text-left rounded-xl border p-4 transition ${theme===t.id?'border-zinc-400 bg-zinc-100/80':'border-zinc-100 bg-white/30 hover:bg-zinc-50'}`}><div className="text-sm font-medium">{t.name}</div><div className="text-xs text-zinc-300 mt-1">{t.description}</div></button>)}</div>
    </section>

    {isInstallable && (
      <section className="rounded-2xl border border-zinc-100 bg-zinc-50/40 overflow-hidden">
        <div className="p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 font-medium"><Smartphone size={16}/> Install App</div>
            <p className="text-xs text-zinc-300 mt-1">Install FocusSpace to your device for native offline access.</p>
          </div>
          <button onClick={install} className="h-9 px-4 rounded-lg bg-zinc-900 text-white text-sm font-medium flex items-center gap-2 hover:bg-zinc-800 transition">
            <Download size={15}/> Install
          </button>
        </div>
      </section>
    )}

    <section className="rounded-2xl border border-zinc-100 bg-zinc-50/40 overflow-hidden">
      <div className="p-5 border-b border-zinc-100 flex items-center justify-between"><div><div className="font-medium">Categories</div><p className="text-xs text-zinc-300 mt-1">Create, rename and recolor your workspaces.</p></div><button onClick={startCreate} className="h-9 px-3 rounded-lg bg-zinc-900 text-white text-sm font-medium flex items-center gap-1.5"><Plus size={15}/> Add category</button></div>
      <div className="p-4 space-y-2">{categories.map(c => <div key={c.id} className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-white/40 p-3"><span className="size-3 rounded-full" style={{background:c.color}}/><div className="flex-1 min-w-0"><div className="text-sm truncate">{c.name}</div><div className="text-[11px] text-zinc-300">{c.id}</div></div><button onClick={()=>openEdit(c)} className="text-xs text-zinc-400 hover:text-zinc-700 px-2 py-1.5 rounded-md hover:bg-zinc-100">Edit</button><button onClick={()=>{setDeleteTarget(c);setMoveTo(categories.find(x=>x.id!==c.id)?.id??'')}} className="text-zinc-300 hover:text-red-300 p-2 rounded-md hover:bg-zinc-50" title="Delete"><Trash2 size={15}/></button></div>)}</div>
      {(editing || creating) && <div className="p-4 border-t border-zinc-100 bg-white/30"><div className="grid sm:grid-cols-[1fr_110px_auto] gap-2 items-end"><label className="text-xs text-zinc-400">Name<input ref={inputRef} value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Valorant" className="mt-1 w-full h-10 rounded-lg bg-zinc-50 border border-zinc-100 px-3 text-sm outline-none"/></label><label className="text-xs text-zinc-400">Color<input type="color" value={newColor} onChange={e=>setNewColor(e.target.value)} className="mt-1 w-full h-10 rounded-lg bg-zinc-50 border border-zinc-100 p-1"/></label><div className="flex gap-2"><button onClick={()=>{setEditing(null);setCreating(false);setNewName('')}} className="h-10 px-3 rounded-lg text-sm text-zinc-400 hover:bg-zinc-50">Cancel</button><button onClick={saveCategory} className="h-10 px-4 rounded-lg bg-zinc-900 text-white text-sm font-medium">Save</button></div></div></div>}
    </section>

    <section className="rounded-2xl border border-zinc-100 bg-zinc-50/40 overflow-hidden"><div className="p-5 border-b border-zinc-100"><div className="font-medium">Data ownership</div><p className="text-xs text-zinc-300 mt-1">Export everything or restore a previous FocusSpace backup.</p></div><div className="p-5 flex flex-wrap gap-3"><button onClick={()=>void exportData()} disabled={busy} className="h-10 px-4 rounded-lg border border-zinc-200 bg-zinc-50 text-sm flex items-center gap-2 hover:bg-zinc-100 disabled:opacity-50"><Download size={15}/> Export JSON</button><label className="h-10 px-4 rounded-lg border border-zinc-200 bg-zinc-50 text-sm flex items-center gap-2 hover:bg-zinc-100 cursor-pointer"><Upload size={15}/> Import JSON<input type="file" accept="application/json,.json" className="hidden" disabled={busy} onChange={e=>{void importData(e.target.files?.[0]);e.currentTarget.value=''}}/></label><button onClick={()=>{storage.remove(DURATIONS_KEY);timer.reloadDurations();toast('Timer durations reset to 25 / 5 / 15.','success')}} className="h-10 px-4 rounded-lg text-sm text-zinc-300 hover:text-zinc-600 flex items-center gap-2"><RefreshCw size={14}/> Reset timer defaults</button></div><div className="px-5 pb-5 space-y-3"><label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer w-fit"><input type="checkbox" checked={includeFiles} onChange={e=>setIncludeFiles(e.target.checked)} className="accent-zinc-500"/> Include attached files in the export (they are embedded, so the file gets larger)</label><StorageInfo/></div></section>

    <IcsExportCard />
    <HabitsCard />

    <section className="rounded-2xl border border-zinc-100 bg-zinc-50/40 overflow-hidden">
      <div className="p-5 border-b border-zinc-100"><div className="flex items-center gap-2 font-medium"><Keyboard size={16}/> Keyboard shortcuts</div><p className="text-xs text-zinc-300 mt-1">Available from any view. Use ⌘ instead of Ctrl on a Mac.</p></div>
      <dl className="p-5 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">{[['Ctrl K','Search tasks and run commands'],['Ctrl N','Quick add a task'],['Space','Start or pause the timer'],['Esc','Close a dialog']].map(([keys,what])=><div key={keys} className="flex items-center justify-between gap-4"><dt className="text-zinc-500">{what}</dt><dd><kbd className="text-[11px] border border-zinc-200 rounded px-1.5 py-0.5 text-zinc-600">{keys}</kbd></dd></div>)}</dl>
    </section>

    {deleteTarget && <div className="fade-in fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onMouseDown={()=>setDeleteTarget(null)}><div role="dialog" aria-modal="true" aria-label={`Delete ${deleteTarget.name}`} onMouseDown={e=>e.stopPropagation()} className="pop-in w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl p-5"><div className="flex items-start justify-between"><div><h2 className="font-semibold">Delete {deleteTarget.name}?</h2><p className="text-xs text-zinc-300 mt-1">Tasks and pages in this category must be moved before it is deleted.</p></div><button onClick={()=>setDeleteTarget(null)}><X size={17} className="text-zinc-300"/></button></div><label className="block text-xs text-zinc-400 mt-5">Move tasks and pages to<select value={moveTo} onChange={e=>setMoveTo(e.target.value)} className="mt-1 w-full h-10 rounded-lg bg-zinc-50 border border-zinc-100 px-3 text-sm">{categories.filter(c=>c.id!==deleteTarget.id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="flex justify-end gap-2 mt-5"><button onClick={()=>setDeleteTarget(null)} className="h-10 px-4 rounded-lg text-sm text-zinc-400">Cancel</button><button disabled={!moveTo||busy} onClick={()=>void removeCategory()} className="h-10 px-4 rounded-lg bg-red-400 text-white text-sm font-medium disabled:opacity-40">Move & delete</button></div></div></div>}
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
    <p className="text-xs text-zinc-300">
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
      <button onClick={onExport} className="h-8 px-3 rounded-md bg-amber-400 text-amber-950 text-xs font-medium">Export now</button>
      <button onClick={() => { snoozeBackupReminder(); forceRender(n => n + 1); }} className="h-8 px-3 rounded-md text-xs text-amber-200/80 hover:text-amber-100">Remind me later</button>
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
    <section className="rounded-2xl border border-zinc-100 bg-zinc-50/40 overflow-hidden">
      <div className="p-5 border-b border-zinc-100"><div className="flex items-center gap-2 font-medium"><Calendar size={16} /> Calendar export</div><p className="text-xs text-zinc-300 mt-1">Download a .ics file of tasks that have a due date and time, to import into Google Calendar, Apple Calendar or Outlook.</p></div>
      <div className="p-5 flex flex-wrap items-center gap-3">
        <button onClick={download} disabled={!tasks} className="h-10 px-4 rounded-lg border border-zinc-200 bg-zinc-50 text-sm flex items-center gap-2 hover:bg-zinc-100 disabled:opacity-50"><Download size={15} /> Export .ics{tasks ? ` (${count})` : ''}</button>
        <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer">
          <input type="checkbox" checked={includeDone} onChange={e => setIncludeDone(e.target.checked)} className="accent-zinc-500" /> Include completed tasks
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const create = async () => {
    const habit = await addHabit({ name });
    if (habit) { setName(''); setCreating(false); } else toast('Give the habit a name first.', 'error');
  };
  const startEdit = (h: Habit) => { setEditingId(h.id); setEditName(h.name); };
  const saveEdit = async () => {
    if (editingId && editName.trim()) await updateHabit(editingId, { name: editName.trim() });
    setEditingId(null);
  };

  return (
    <section className="rounded-2xl border border-zinc-100 bg-zinc-50/40 overflow-hidden">
      <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
        <div><div className="font-medium">Habits</div><p className="text-xs text-zinc-300 mt-1">Active habits show up on Today as one-tap check-ins.</p></div>
        <button onClick={() => { setCreating(true); setName(''); }} className="h-9 px-3 rounded-lg bg-zinc-900 text-white text-sm font-medium flex items-center gap-1.5"><Plus size={15} /> Add habit</button>
      </div>
      <div className="p-4 space-y-2">
        {habits.length === 0 && !creating && <p className="text-sm text-zinc-300 px-1 py-2">No habits yet. Add one to start tracking daily streaks.</p>}
        {habits.map(h => {
          const streak = computeStreaks(h.completions, today).current;
          const editingThis = editingId === h.id;
          return (
            <div key={h.id} className={`flex items-center gap-3 rounded-xl border p-3 ${h.active ? 'border-zinc-100 bg-white/40' : 'border-zinc-50 bg-white/20 opacity-60'}`}>
              <span className="size-3 rounded-full shrink-0" style={{ background: h.color }} />
              {editingThis ? (
                <input autoFocus value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void saveEdit(); if (e.key === 'Escape') setEditingId(null); }} className="flex-1 min-w-0 h-8 rounded-md bg-zinc-50 border border-zinc-200 px-2 text-sm outline-none" />
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{h.name}{!h.active && <span className="text-zinc-300"> · archived</span>}</div>
                  {streak > 0 && <div className="text-[11px] text-zinc-300 flex items-center gap-1"><Flame size={11} />{streak}-day streak</div>}
                </div>
              )}
              {editingThis ? (
                <button onClick={() => void saveEdit()} className="text-xs text-zinc-600 hover:text-white px-2 py-1.5 rounded-md hover:bg-zinc-100"><Check size={14} /></button>
              ) : (
                <button onClick={() => startEdit(h)} aria-label={`Rename ${h.name}`} className="text-zinc-400 hover:text-zinc-700 p-2 rounded-md hover:bg-zinc-50"><Pencil size={14} /></button>
              )}
              <button onClick={() => void updateHabit(h.id, { active: !h.active })} className="text-xs text-zinc-400 hover:text-zinc-700 px-2 py-1.5 rounded-md hover:bg-zinc-100">{h.active ? 'Archive' : 'Restore'}</button>
              <button onClick={() => void deleteHabit(h.id)} aria-label={`Delete ${h.name}`} className="text-zinc-300 hover:text-red-300 p-2 rounded-md hover:bg-zinc-50" title="Delete"><Trash2 size={15} /></button>
            </div>
          );
        })}
      </div>
      {creating && (
        <div className="p-4 border-t border-zinc-100 bg-white/30">
          <div className="flex gap-2">
            <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void create(); }} placeholder="e.g. Read 20 minutes" className="flex-1 h-10 rounded-lg bg-zinc-50 border border-zinc-100 px-3 text-sm outline-none" />
            <div className="flex gap-1">
              {HABIT_COLORS.slice(0, 5).map(c => <span key={c} className="size-6 rounded-full self-center" style={{ background: c }} />)}
            </div>
            <button onClick={() => setCreating(false)} className="h-10 px-3 rounded-lg text-sm text-zinc-400 hover:bg-zinc-50">Cancel</button>
            <button onClick={() => void create()} className="h-10 px-4 rounded-lg bg-zinc-900 text-white text-sm font-medium">Save</button>
          </div>
        </div>
      )}
    </section>
  );
}
