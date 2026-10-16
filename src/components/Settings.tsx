import { useLiveQuery } from 'dexie-react-hooks';
import { Activity, Bell, BookOpen, Calendar, Check, Database, Download, Flame, Globe, Keyboard, Maximize, Mic, Palette, Pencil, Plus, RefreshCw, ShieldCheck, Sliders, Smartphone, Sparkles, Target, Trash2, Upload, Volume2, X, Zap } from 'lucide-react';
import { isNotificationSupported, getNotificationPermission, requestNotificationPermission, sendNotification } from '../lib/notifications';
import { useEffect, useRef, useState } from 'react';
import { db } from '../db/db';
import { downloadBackupFile, importFullBackup } from '../lib/backup';
import { takeNativeVaultSnapshot } from '../lib/journalAutoSave';
import { isDesktop } from '../lib/runtime';
import { hudBridge } from '../lib/hudBridge';
import { getAsrClient } from '../voice/engine/AsrClient';
import { BROWSER_OPTIONS } from './BrowserSetupModal';
import {
  type AudioDevice,
  getAudioInputDevices,
  getAudioOutputDevices,
  getSelectedAudioInput,
  getSelectedAudioOutput,
  setSelectedAudioInput,
  setSelectedAudioOutput,
  testAudioOutput,
  createAudioLevelMeter,
  setAudioConfigured,
} from '../voice/audioDevices';
import { AudioDeviceSetupModal } from './AudioDeviceSetupModal';
import { loadSchedulePreferences, saveSchedulePreferences } from '../lib/smartScheduler';
import { HABIT_COLORS, addHabit, deleteHabit, updateHabit } from '../lib/habitActions';
import { useToday, usePWAInstall } from '../lib/hooks';
import { buildICS, scheduledTasks } from '../lib/ics';
import { computeStreaks } from '../lib/analytics';
import { DURATIONS_KEY, timer } from '../lib/timer';
import { toast } from '../lib/toast';
import { storage, uid } from '../lib/utils';
import type { Category, GoalType, Habit } from '../types';

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

export function Settings({ theme, setTheme, layoutMode = 'orbital', setLayoutMode, onReplayWelcome }: { theme: string; setTheme: (theme: string) => void; layoutMode?: 'orbital' | 'cockpit'; setLayoutMode?: (m: 'orbital' | 'cockpit') => void; onReplayWelcome?: () => void }) {
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const { isInstallable, install } = usePWAInstall();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#60a5fa');
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const [busy, setBusy] = useState(false);
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
      await db.transaction('rw', [db.categories, db.tasks, db.pages, db.goals], async () => {
        await db.tasks.where('categoryId').equals(deleteTarget.id).modify({ categoryId: moveTo });
        await db.pages.where('categoryId').equals(deleteTarget.id).modify({ categoryId: moveTo });
        await db.goals.where('categoryId').equals(deleteTarget.id).modify({ categoryId: moveTo });
        await db.categories.delete(deleteTarget.id);
      });
      setDeleteTarget(null); setMoveTo('');
    } finally { setBusy(false); }
  };

  return <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-5">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <div className="text-xs uppercase tracking-[.18em] text-fg-subtle">System</div>
        <h1 className="text-2xl font-semibold mt-1">Settings</h1>
        <p className="text-sm text-fg-muted mt-1">Own the workspace. Everything stays local in your browser.</p>
      </div>
      {onReplayWelcome && (
        <button
          onClick={onReplayWelcome}
          className="h-9 px-3.5 rounded-xl border border-line bg-surface-2 text-xs font-semibold hover:bg-hover keycap flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Sparkles size={14} className="text-accent" />
          <span>Replay Welcome Tour</span>
        </button>
      )}
    </div>
    
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
        <button onClick={install} className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-sm font-semibold flex items-center gap-2 hover:bg-accent-hover transition keycap">
          <Download size={15}/> Install
        </button>
      </div>
    </section>

    <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
      <div className="p-5 border-b border-line flex items-center justify-between"><div><div className="font-medium">Categories</div><p className="text-xs text-fg-subtle mt-1">Create, rename and recolor your workspaces.</p></div><button onClick={startCreate} className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-sm font-semibold flex items-center gap-1.5 hover:bg-accent-hover keycap"><Plus size={15}/> Add category</button></div>
      <div className="p-4 space-y-2">{categories.map(c => <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3"><span className="size-3 rounded-full" style={{background:c.color}}/><div className="flex-1 min-w-0"><div className="text-sm truncate">{c.name}</div><div className="text-[11px] text-fg-subtle">{c.id}</div></div><button onClick={()=>openEdit(c)} className="text-xs text-fg-muted hover:text-fg px-2 py-1.5 rounded-xl hover:bg-hover">Edit</button><button onClick={()=>{setDeleteTarget(c);setMoveTo(categories.find(x=>x.id!==c.id)?.id??'')}} className="text-fg-subtle hover:text-red-300 p-2 rounded-xl hover:bg-hover" title="Delete"><Trash2 size={15}/></button></div>)}</div>
    </section>

    <DockPreferencesCard />
    <DataVaultCard />
    <IcsExportCard />
    <HabitsCard />
    <NotificationsCard />
    <GoalsCard />
    <SchedulingPreferencesCard />
    <DailyJournalPreferencesCard />
    <VoiceStudioPreferencesCard />

    <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
      <div className="p-5 border-b border-line flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 font-medium"><RefreshCw size={16}/> Timer Preferences</div>
          <p className="text-xs text-fg-subtle mt-1">Reset Pomodoro durations back to default settings (25m focus, 5m short break, 15m long break).</p>
        </div>
        <button
          onClick={() => {
            storage.remove(DURATIONS_KEY);
            timer.reloadDurations();
            toast('Timer durations reset to 25 / 5 / 15.', 'success');
          }}
          className="h-8 px-3 rounded-xl border border-line bg-surface-2 text-sm text-fg-subtle hover:text-fg flex items-center gap-2 hover:bg-hover keycap shrink-0"
        >
          <RefreshCw size={14}/> Reset timer defaults
        </button>
      </div>
    </section>

    <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
      <div className="p-5 border-b border-line"><div className="flex items-center gap-2 font-medium"><Keyboard size={16}/> Keyboard shortcuts</div><p className="text-xs text-fg-subtle mt-1">Available from any view. Use ⌘ instead of Ctrl on a Mac.</p></div>
      <dl className="p-5 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">{[['Ctrl K','Search tasks and run commands'],['Ctrl N','Quick add a task'],['Ctrl /','Open shortcuts cheatsheet'],['Space','Start or pause the timer'],['Ctrl 1-5','Quick view navigation'],['Esc','Close a dialog / Prompt quit on home']].map(([keys,what])=><div key={keys} className="flex items-center justify-between gap-4"><dt className="text-fg-muted">{what}</dt><dd><kbd className="text-[11px] border border-line rounded px-1.5 py-0.5 text-fg-soft">{keys}</kbd></dd></div>)}</dl>
    </section>

    {deleteTarget && <div className="fade-in fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onMouseDown={()=>setDeleteTarget(null)}><div role="dialog" aria-modal="true" aria-label={`Delete ${deleteTarget.name}`} onMouseDown={e=>e.stopPropagation()} className="pop-in w-full max-w-md rounded-2xl border border-line bg-surface shadow-2xl p-5"><div className="flex items-start justify-between"><div><h2 className="font-semibold">Delete {deleteTarget.name}?</h2><p className="text-xs text-fg-subtle mt-1">Tasks and pages in this category must be moved before it is deleted.</p></div><button onClick={()=>setDeleteTarget(null)}><X size={17} className="text-fg-subtle"/></button></div><label className="block text-xs text-fg-muted mt-5">Move tasks and pages to<select value={moveTo} onChange={e=>setMoveTo(e.target.value)} className="mt-1 w-full h-10 rounded-lg bg-surface-2 border border-line px-3 text-sm">{categories.filter(c=>c.id!==deleteTarget.id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="flex justify-end gap-2 mt-5"><button onClick={()=>setDeleteTarget(null)} className="h-8 px-3 rounded-xl text-sm text-fg-muted">Cancel</button><button disabled={!moveTo||busy} onClick={()=>void removeCategory()} className="h-8 px-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium disabled:opacity-40 transition-colors">Move & delete</button></div></div></div>}
  </div>;
}

function DockPreferencesCard() {
  const [preferredBrowser, setPreferredBrowser] = useState(() => storage.get('focusspace-default-browser') || 'system');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (isDesktop() && window.electronAPI?.isFullscreen) {
      window.electronAPI.isFullscreen().then(setIsFullscreen);
    }
  }, []);

  const handleSelectBrowser = (id: string) => {
    setPreferredBrowser(id);
    storage.set('focusspace-default-browser', id);
    toast('Default web browser preference saved.', 'success');
  };

  const handleToggleFullscreen = async () => {
    if (window.electronAPI?.toggleFullscreen) {
      const next = await window.electronAPI.toggleFullscreen();
      setIsFullscreen(next);
      toast(next ? 'Entered Fullscreen Mode' : 'Exited Fullscreen Mode', 'info');
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
      <div className="p-5 border-b border-line flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <Globe size={16} className="text-accent-text" /> Application Dock & Browser Integration
          </div>
          <p className="text-xs text-fg-subtle mt-1">
            Choose your preferred browser for dock web apps, and manage distraction-free desktop display settings.
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-fg-subtle mb-2.5">
            Preferred Web Browser
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {BROWSER_OPTIONS.map((opt) => {
              const active = preferredBrowser === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelectBrowser(opt.id)}
                  className={`p-3 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
                    active
                      ? 'border-accent bg-accent/10 shadow-sm'
                      : 'border-line bg-surface-2 hover:bg-hover'
                  }`}
                >
                  <div className="shrink-0">{opt.renderIcon(22)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-fg flex items-center justify-between">
                      <span className="truncate">{opt.name}</span>
                      {active && <Check size={14} className="text-accent shrink-0" />}
                    </div>
                    <div className="text-[10px] text-fg-subtle truncate mt-0.5">{opt.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {isDesktop() && (
          <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-fg">Distraction-Free Window</div>
              <div className="text-[11px] text-fg-subtle">
                FocusSpace runs borderless to cover the Windows taskbar. Toggle with <kbd className="px-1.5 py-0.5 rounded border border-line bg-surface-2 font-mono text-[10px]">F11</kbd> or this button.
              </div>
            </div>
            <button
              onClick={handleToggleFullscreen}
              className="h-8 px-3 rounded-xl border border-line bg-surface-2 text-xs font-semibold hover:bg-hover flex items-center gap-2 cursor-pointer keycap"
            >
              <Maximize size={14} />
              {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}



/** Data Vault & Portability: Full JSON export and restore for IndexedDB / Tauri desktop migration */
function DataVaultCard() {
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const taskCount = useLiveQuery(() => db.tasks.count(), []) ?? 0;
  const categoryCount = useLiveQuery(() => db.categories.count(), []) ?? 0;
  const habitCount = useLiveQuery(() => db.habits.count(), []) ?? 0;
  const pageCount = useLiveQuery(() => db.pages.count(), []) ?? 0;
  const journalCount = useLiveQuery(() => db.journalEntries.count(), []) ?? 0;

  const handleNativeVaultBackup = async () => {
    try {
      setBusy(true);
      const res = await takeNativeVaultSnapshot();
      if (res) {
        toast('Native vault backup saved to local AppData/Backups.', 'success');
      } else {
        toast('Native vault backup failed.', 'error');
      }
    } catch (err: any) {
      toast(`Native vault backup error: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    try {
      setBusy(true);
      await downloadBackupFile();
      toast('Full database backup exported successfully.', 'success');
    } catch (err: any) {
      toast(`Export failed: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Restoring this backup will replace current local database data. Are you sure you want to proceed?')) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setBusy(true);
      const text = await file.text();
      const res = await importFullBackup(text);
      if (res.success) {
        toast(
          `Restored ${res.imported.tasks} tasks, ${res.imported.categories} categories, and ${res.imported.pages} pages.`,
          'success'
        );
      } else {
        if (res.safetySnapshot) {
          const blob = new Blob([res.safetySnapshot], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `focusspace-emergency-safety-backup-${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast(`Restore failed: ${res.error}. An emergency safety snapshot was downloaded.`, 'error');
        } else {
          toast(res.error || 'Failed to restore backup.', 'error');
        }
      }
    } catch (err: any) {
      toast(`Restore error: ${err?.message || 'Could not parse file'}`, 'error');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
      <div className="p-5 border-b border-line flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <Database size={16} className="text-accent-text" /> Data Vault & Portable Backup
          </div>
          <p className="text-xs text-fg-subtle mt-1">
            Export a full JSON snapshot of your local IndexedDB to migrate to Tauri desktop or preserve your vault offline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json,application/json"
            className="hidden"
          />
          {isDesktop() && (
            <button
              onClick={handleNativeVaultBackup}
              disabled={busy}
              className="h-8 px-3 rounded-xl border border-line bg-surface-2 text-sm text-fg hover:text-fg hover:bg-hover flex items-center gap-1.5 transition keycap disabled:opacity-40"
              title="Save an instant native snapshot to AppData/Backups"
            >
              <ShieldCheck size={14} className="text-accent" /> Back Up to Vault Now
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="h-8 px-3 rounded-xl border border-line bg-surface-2 text-sm text-fg hover:text-fg hover:bg-hover flex items-center gap-1.5 transition keycap disabled:opacity-40"
          >
            <Upload size={14} /> Restore from JSON
          </button>
          <button
            onClick={handleExport}
            disabled={busy}
            className="h-8 px-3.5 rounded-xl bg-accent text-accent-fg text-sm font-semibold flex items-center gap-1.5 hover:bg-accent-hover transition keycap disabled:opacity-40"
          >
            <Download size={14} /> Export Backup (JSON)
          </button>
        </div>
      </div>
      <div className="p-4 bg-surface-2/40 text-xs text-fg-muted flex flex-wrap gap-4 font-mono">
        <span>{taskCount} tasks</span>
        <span>·</span>
        <span>{categoryCount} categories</span>
        <span>·</span>
        <span>{habitCount} habits</span>
        <span>·</span>
        <span>{pageCount} pages</span>
        <span>·</span>
        <span>{journalCount} journal entries</span>
      </div>
    </section>
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
        <button onClick={() => { setCreating(true); setName(''); setNewColor(HABIT_COLORS[0]); }} className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-sm font-semibold flex items-center gap-1.5 hover:bg-accent-hover keycap"><Plus size={15} /> Add habit</button>
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
              <button onClick={() => void create()} className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover keycap">Save</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


function GoalsCard() {
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('manual');
  const [categoryId, setCategoryId] = useState('');
  const [metricLabel, setMetricLabel] = useState('');
  const [targetValue, setTargetValue] = useState('10');
  const [deadline, setDeadline] = useState('');
  const [editingProgressId, setEditingProgressId] = useState<string | null>(null);
  const [progressVal, setProgressVal] = useState('');

  const onTypeChange = (t: GoalType) => {
    setGoalType(t);
    if (t === 'tasks-completed') setMetricLabel('tasks');
    else if (t === 'focus-hours') setMetricLabel('hours');
    else if (t === 'habit-streak') setMetricLabel('days streak');
  };

  const create = async () => {
    if (!title.trim() || !metricLabel.trim()) return toast('Please fill in title and metric.', 'error');
    const target = parseFloat(targetValue);
    if (isNaN(target) || target <= 0) return toast('Target must be a positive number.', 'error');
    
    await db.goals.add({
      id: uid(),
      title: title.trim(),
      goalType,
      categoryId: categoryId || undefined,
      metricLabel: metricLabel.trim(),
      currentValue: 0,
      targetValue: target,
      deadline: deadline || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setCreating(false); setTitle(''); setMetricLabel(''); setTargetValue('10'); setDeadline(''); setCategoryId(''); setGoalType('manual');
    toast('Goal created.', 'success');
  };

  const deleteGoal = async (id: string) => {
    await db.goals.delete(id);
    toast('Goal deleted.');
  };

  const saveProgress = async (id: string) => {
    const next = parseFloat(progressVal);
    if (isNaN(next) || next < 0) return toast('Progress must be a non-negative number.', 'error');
    await db.goals.update(id, { currentValue: next, updatedAt: new Date().toISOString() });
    setEditingProgressId(null);
    toast('Goal progress updated.', 'success');
  };

  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
      <div className="p-5 border-b border-line flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 font-medium"><Target size={16}/> Goals</div>
          <p className="text-xs text-fg-subtle mt-1">Track larger milestones and measurable targets with optional auto-tracking.</p>
        </div>
        <button onClick={() => setCreating(true)} className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-sm font-semibold flex items-center gap-1.5 hover:bg-accent-hover keycap"><Plus size={15} /> Add goal</button>
      </div>
      <div className="p-4 space-y-2">
        {goals.length === 0 && !creating && <p className="text-sm text-fg-subtle px-1 py-2">No goals yet. Add a big milestone to track.</p>}
        {goals.map(g => {
          const pct = Math.min(100, Math.max(0, (g.currentValue / g.targetValue) * 100));
          const isUpdating = editingProgressId === g.id;
          return (
            <div key={g.id} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate text-fg">{g.title}</span>
                    {g.goalType && g.goalType !== 'manual' && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/15 text-accent-text border border-accent/25 flex items-center gap-1 shrink-0">
                        <Zap size={10} />
                        {g.goalType === 'tasks-completed' ? 'Auto: Tasks' : g.goalType === 'focus-hours' ? 'Auto: Focus' : 'Auto: Streak'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-fg-muted mt-0.5">
                    {g.currentValue} / {g.targetValue} {g.metricLabel}
                    {g.categoryId && (
                      <span className="text-fg-subtle"> · {categories.find(c => c.id === g.categoryId)?.name ?? g.categoryId}</span>
                    )}
                    {g.deadline ? ` · Target: ${g.deadline}` : ''}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => {
                    if (isUpdating) {
                      setEditingProgressId(null);
                    } else {
                      setEditingProgressId(g.id);
                      setProgressVal(String(g.currentValue));
                    }
                  }} className={`text-xs px-2 py-1.5 rounded-xl transition ${isUpdating ? 'bg-surface-2 text-fg font-medium' : 'text-fg-muted hover:text-fg hover:bg-hover'}`}>
                    {isUpdating ? 'Done' : 'Update'}
                  </button>
                  <button onClick={() => deleteGoal(g.id)} className="text-fg-subtle hover:text-red-300 p-2 rounded-xl hover:bg-hover" title="Delete"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-[var(--ring-track)] overflow-hidden">
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
              {isUpdating && (
                <div className="mt-3 pt-3 border-t border-line/60 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-fg-muted">New Value ({g.metricLabel}):</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setProgressVal(v => String(Math.max(0, (parseFloat(v) || 0) - 1)))}
                      className="size-7 rounded-lg border border-line bg-surface-2 grid place-items-center text-xs font-semibold hover:bg-hover keycap"
                    >-1</button>
                    <input
                      type="number"
                      autoFocus
                      value={progressVal}
                      onChange={e => setProgressVal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') void saveProgress(g.id);
                        if (e.key === 'Escape') setEditingProgressId(null);
                      }}
                      className="w-20 h-7 rounded-lg bg-surface-2 border border-line px-2 text-xs font-mono outline-none text-center"
                    />
                    <button
                      type="button"
                      onClick={() => setProgressVal(v => String((parseFloat(v) || 0) + 1))}
                      className="size-7 rounded-lg border border-line bg-surface-2 grid place-items-center text-xs font-semibold hover:bg-hover keycap"
                    >+1</button>
                    <button
                      type="button"
                      onClick={() => setProgressVal(v => String((parseFloat(v) || 0) + 5))}
                      className="h-7 px-2 rounded-lg border border-line bg-surface-2 text-xs font-semibold hover:bg-hover keycap"
                    >+5</button>
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      onClick={() => setEditingProgressId(null)}
                      className="h-7 px-2.5 rounded-lg text-xs text-fg-muted hover:bg-hover"
                    >Cancel</button>
                    <button
                      onClick={() => void saveProgress(g.id)}
                      className="h-7 px-3 rounded-lg bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover keycap"
                    >Save</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {creating && (
          <div className="rounded-xl border border-line bg-surface p-4 shadow-card space-y-3">
            <div>
              <label className="text-[11px] font-medium text-fg-muted uppercase tracking-widest block mb-1">Goal title</label>
              <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Finish 50 problem sets" className="w-full h-8 rounded-xl bg-surface-2 border border-line px-2 text-sm outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-fg-muted uppercase tracking-widest block mb-1">Tracking Type</label>
                <select
                  value={goalType}
                  onChange={e => onTypeChange(e.target.value as GoalType)}
                  className="w-full h-8 rounded-xl bg-surface-2 border border-line px-2 text-xs outline-none"
                >
                  <option value="manual">Manual Progress</option>
                  <option value="tasks-completed">⚡ Auto: Completed Tasks</option>
                  <option value="focus-hours">⚡ Auto: Focus Hours</option>
                  <option value="habit-streak">⚡ Auto: Habit Streak</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-fg-muted uppercase tracking-widest block mb-1">Category (Optional)</label>
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full h-8 rounded-xl bg-surface-2 border border-line px-2 text-xs outline-none"
                >
                  <option value="">All Categories (Global)</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-fg-muted uppercase tracking-widest block mb-1">Target value</label>
                <input type="number" min="1" value={targetValue} onChange={e => setTargetValue(e.target.value)} className="w-full h-8 rounded-xl bg-surface-2 border border-line px-2 text-sm outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-fg-muted uppercase tracking-widest block mb-1">Metric label</label>
                <input value={metricLabel} onChange={e => setMetricLabel(e.target.value)} placeholder="e.g. tasks, hours, books" className="w-full h-8 rounded-xl bg-surface-2 border border-line px-2 text-sm outline-none" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-fg-muted uppercase tracking-widest block mb-1">Deadline (Optional)</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full h-8 rounded-xl bg-surface-2 border border-line px-2 text-sm outline-none text-fg-soft" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setCreating(false)} className="h-8 px-3 rounded-xl text-sm text-fg-muted hover:bg-hover">Cancel</button>
              <button onClick={create} disabled={!title.trim() || !metricLabel.trim()} className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover disabled:opacity-40 keycap">Save goal</button>
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

function DailyJournalPreferencesCard() {
  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
      <div className="p-5 border-b border-line flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <BookOpen size={16} /> Daily Journal &amp; 11:59 PM Auto-Save
          </div>
          <p className="text-xs text-fg-subtle mt-1">
            Automatic end-of-day reflection synthesis, focus logging, and habit tracking.
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-accent/15 text-accent-text font-semibold">
          ACTIVE · 23:59:00
        </span>
      </div>
      <div className="p-5 space-y-3 text-xs text-fg-muted">
        <p>
          FocusSpace automatically aggregates completed tasks, focus minutes, and habit check-ins at <strong>11:59 PM</strong> every evening directly into your chronological Daily Journal.
        </p>
        <p>
          If your machine was asleep or closed before midnight, our <strong>boot catch-up engine</strong> automatically detects and logs the missed snapshot on your next launch. You can also capture a snapshot manually at any time from the Journal tab.
        </p>
      </div>
    </section>
  );
}

function VoiceStudioPreferencesCard() {
  const [warmupStatus, setWarmupStatus] = useState<string | null>(null);
  const [warming, setWarming] = useState(false);
  const isIsolated = typeof window !== 'undefined' && window.crossOriginIsolated;

  // Audio Device State
  const [inputs, setInputs] = useState<AudioDevice[]>([]);
  const [outputs, setOutputs] = useState<AudioDevice[]>([]);
  const [currentInput, setCurrentInput] = useState<string>(() => getSelectedAudioInput());
  const [currentOutput, setCurrentOutput] = useState<string>(() => getSelectedAudioOutput());
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [testPlaying, setTestPlaying] = useState(false);
  const [testingMic, setTestingMic] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  // Floating HUD Artboard Style State
  const [hudStyle, setHudStyle] = useState<string>(() => {
    return localStorage.getItem('focusspace-hud-style') || '';
  });

  const streamRef = useRef<MediaStream | null>(null);
  const stopMeterRef = useRef<(() => void) | null>(null);

  const loadDevices = async () => {
    const inDevs = await getAudioInputDevices();
    const outDevs = await getAudioOutputDevices();
    setInputs(inDevs);
    setOutputs(outDevs);
    const selIn = getSelectedAudioInput();
    const selOut = getSelectedAudioOutput();
    if (selIn) setCurrentInput(selIn);
    else if (inDevs.length > 0) setCurrentInput(inDevs[0].deviceId);
    if (selOut) setCurrentOutput(selOut);
    else if (outDevs.length > 0) setCurrentOutput(outDevs[0].deviceId);
  };

  useEffect(() => {
    void loadDevices();
    return () => {
      stopMeterRef.current?.();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const toggleTestMic = async () => {
    if (testingMic) {
      stopMeterRef.current?.();
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setTestingMic(false);
      setAudioLevel(0);
      return;
    }

    try {
      setTestingMic(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: currentInput ? { deviceId: { exact: currentInput } } : true,
        video: false,
      });
      streamRef.current = stream;
      stopMeterRef.current = createAudioLevelMeter(stream, level => {
        setAudioLevel(level);
      });
    } catch (err) {
      console.warn('Could not test microphone:', err);
      toast('Could not access microphone', 'error');
      setTestingMic(false);
    }
  };

  const handleSelectInput = (deviceId: string) => {
    setCurrentInput(deviceId);
    setSelectedAudioInput(deviceId);
    setAudioConfigured(true);
    toast('Microphone input updated', 'info');
    if (testingMic) {
      stopMeterRef.current?.();
      streamRef.current?.getTracks().forEach(t => t.stop());
      setTestingMic(false);
      setAudioLevel(0);
    }
  };

  const handleSelectOutput = (deviceId: string) => {
    setCurrentOutput(deviceId);
    setSelectedAudioOutput(deviceId);
    setAudioConfigured(true);
    toast('Sound output updated', 'info');
  };

  const handleTestSound = async () => {
    setTestPlaying(true);
    await testAudioOutput(currentOutput);
    setTimeout(() => setTestPlaying(false), 700);
  };

  const handleSelectHudStyle = (styleId: string) => {
    setHudStyle(styleId);
    if (styleId) {
      localStorage.setItem('focusspace-hud-style', styleId);
    } else {
      localStorage.removeItem('focusspace-hud-style');
    }
    hudBridge.send({ type: 'REQUEST_SYNC', v: 1 });
    toast('Floating HUD artboard theme updated', 'info');
  };

  const runWarmup = async () => {
    setWarming(true);
    setWarmupStatus('Initializing on-device WASM model...');
    const start = performance.now();
    try {
      const client = getAsrClient();
      await client.load();
      const ms = Math.round(performance.now() - start);
      setWarmupStatus(`Engine ready! Warmup inference passed in ${ms} ms.`);
      toast('Voice engine warmed up successfully', 'success');
    } catch (err: any) {
      setWarmupStatus(`Failed: ${err.message}`);
      toast('Voice engine warmup error', 'error');
    } finally {
      setWarming(false);
    }
  };

  const HUD_ARTBOARDS = [
    { id: '', name: 'Match App Theme' },
    { id: '01', name: '01 Nocturne Solaris' },
    { id: '02', name: '02 Swiss Onyx' },
    { id: '03', name: '03 Swiss Brutal' },
    { id: '04', name: '04 Solaris Atelier' },
    { id: '05', name: '05 Braun Split-Flap' },
    { id: '06', name: '06 Orbital Capsule' },
  ];

  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
      <div className="p-5 border-b border-line flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <Mic size={16} className="text-accent-text" /> 100% Offline Voice Typing Studio
          </div>
          <p className="text-xs text-fg-subtle mt-1">
            Private, on-device Whisper WASM automatic speech recognition &amp; Silero VAD.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-emerald-500/10 text-emerald-500 font-semibold border border-emerald-500/20">
            OFFLINE · ZERO-CLOUD
          </span>
          <span className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-accent/15 text-accent-text font-semibold">
            {isIsolated ? 'MULTI-THREADED WASM' : 'WASM READY'}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5 text-xs text-fg-muted">
        {/* Audio Hardware Devices Section */}
        <div className="p-4 rounded-xl bg-surface-2/70 border border-line space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-fg flex items-center gap-2">
              <Sliders size={14} className="text-accent-text" /> Audio Hardware Routing
            </div>
            <button
              type="button"
              onClick={() => setShowWizard(true)}
              className="px-2.5 py-1 rounded-lg border border-line bg-surface text-[11px] font-semibold text-fg hover:bg-hover flex items-center gap-1 keycap cursor-pointer"
            >
              <RefreshCw size={11} /> Re-run Setup Wizard
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Input Device (Mic) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-fg flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Mic size={12} className="text-accent" /> Microphone Input
                </span>
                <button
                  type="button"
                  onClick={toggleTestMic}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition ${
                    testingMic ? 'bg-rose-500 text-white' : 'text-accent-text hover:underline'
                  }`}
                >
                  {testingMic ? 'Stop Test' : 'Test Mic'}
                </button>
              </label>
              <select
                value={currentInput}
                onChange={e => handleSelectInput(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-surface border border-line text-xs text-fg outline-none focus:border-accent cursor-pointer"
              >
                {inputs.length > 0 ? (
                  inputs.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))
                ) : (
                  <option value="">Default Microphone</option>
                )}
              </select>

              {/* VU Meter */}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 h-1.5 rounded-full bg-surface border border-line overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-75"
                    style={{ width: `${Math.round(audioLevel * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-fg-subtle tabular-nums w-7 text-right">
                  {Math.round(audioLevel * 100)}%
                </span>
              </div>
            </div>

            {/* Output Device (Speakers) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-fg flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Volume2 size={12} className="text-accent" /> Sound Output (Speakers)
                </span>
                <button
                  type="button"
                  onClick={handleTestSound}
                  disabled={testPlaying}
                  className="text-[10px] font-bold text-accent-text hover:underline disabled:opacity-50 cursor-pointer"
                >
                  {testPlaying ? 'Playing…' : 'Play Chime'}
                </button>
              </label>
              <select
                value={currentOutput}
                onChange={e => handleSelectOutput(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg bg-surface border border-line text-xs text-fg outline-none focus:border-accent cursor-pointer"
              >
                {outputs.length > 0 ? (
                  outputs.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))
                ) : (
                  <option value="">Default Sound Output</option>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Floating HUD Artboard Selector */}
        <div className="p-4 rounded-xl bg-surface-2/70 border border-line space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-fg">Always-on-Top Floating HUD Artboard Theme</div>
            <span className="text-[10px] font-mono text-fg-subtle">320×76 &amp; 320×290</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {HUD_ARTBOARDS.map(art => (
              <button
                key={art.id}
                type="button"
                onClick={() => handleSelectHudStyle(art.id)}
                className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition border cursor-pointer ${
                  hudStyle === art.id
                    ? 'bg-accent text-accent-fg border-accent shadow-sm'
                    : 'bg-surface border-line text-fg hover:border-line-strong'
                }`}
              >
                {art.name}
              </button>
            ))}
          </div>
        </div>

        {/* 3 Engine Cards */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-surface-2 border border-line space-y-1">
            <div className="text-[10px] uppercase font-mono tracking-wider text-fg-subtle">Engine &amp; Model</div>
            <div className="font-semibold text-fg">Whisper ONNX (q8)</div>
            <div className="text-[11px] text-fg-subtle">Local WASM execution via @huggingface/transformers</div>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-2 border border-line space-y-1">
            <div className="text-[10px] uppercase font-mono tracking-wider text-fg-subtle">Voice Detection</div>
            <div className="font-semibold text-fg">Silero VAD</div>
            <div className="text-[11px] text-fg-subtle">16 kHz AudioWorklet with 1s redemption pause</div>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-2 border border-line space-y-1">
            <div className="text-[10px] uppercase font-mono tracking-wider text-fg-subtle">Disfluency Engine</div>
            <div className="font-semibold text-fg">Light Sanitizer</div>
            <div className="text-[11px] text-fg-subtle">Strips fillers, collapses stutters, handles voice commands</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-line">
          <div>
            <div className="font-medium text-fg flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" /> Strict Privacy Invariant
            </div>
            <p className="text-[11px] text-fg-subtle mt-0.5">
              No audio ever leaves your computer or gets saved to disk. Audio exists strictly in volatile RAM as Float32Array during dictation.
            </p>
          </div>

          <button
            type="button"
            disabled={warming}
            onClick={runWarmup}
            className="h-8 px-3 rounded-xl border border-line bg-surface-2 text-xs font-semibold text-fg hover:bg-hover flex items-center gap-1.5 shrink-0 keycap cursor-pointer"
          >
            <Activity size={13} className={warming ? 'animate-spin text-accent' : 'text-accent'} />
            {warming ? 'Warming up...' : 'Test Engine Warmup'}
          </button>
        </div>

        {warmupStatus && (
          <div className="p-2.5 rounded-lg bg-surface-2/80 border border-line font-mono text-[11px] text-fg">
            {warmupStatus}
          </div>
        )}
      </div>

      <AudioDeviceSetupModal
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onConfigured={() => {
          setShowWizard(false);
          void loadDevices();
        }}
      />
    </section>
  );
}


