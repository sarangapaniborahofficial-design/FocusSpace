import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Flame,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../db/db';
import {
  DAILY_JOURNAL_PAGE_ID,
  saveDailyJournalSnapshot,
} from '../lib/journalAutoSave';
import { getOrCreateEntry, saveEntry, deleteEntry } from '../lib/journal';
import { generateDailySummaryDoc } from '../lib/journalSummary';
import { richTextSnippet } from '../lib/richtext';
import { toast } from '../lib/toast';
import { dateLabel, formatDuration, isoToday, relativeDay, storage } from '../lib/utils';
import type { JournalEntry, RichTextDoc } from '../types';
import { RichTextEditor } from './RichTextEditor';
import { RichTextView, toggleTaskAtPath } from './RichTextView';
import { ConfirmDialog, EmptyState } from './ui';

export function Journal() {
  const today = useMemo(() => isoToday(), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [isEditing, setIsEditing] = useState<boolean>(true);
  const [capturing, setCapturing] = useState<boolean>(false);
  const [confirmingDelete, setConfirmingDelete] = useState<boolean>(false);

  // Resizable Archive Timeline Column Width (220px - 460px)
  const [timelineWidth, setTimelineWidth] = useState(() => {
    const v = parseInt(storage.get('focusspace-journal-timeline-width') || '300', 10);
    return isNaN(v) ? 300 : Math.max(220, Math.min(460, v));
  });
  const [isTimelineDragging, setIsTimelineDragging] = useState(false);

  const handleTimelineResizeDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsTimelineDragging(true);
    const startX = e.clientX;
    const startWidth = timelineWidth;

    const onPointerMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.max(220, Math.min(460, startWidth + delta));
      setTimelineWidth(newWidth);
    };

    const onPointerUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setIsTimelineDragging(false);
      const delta = ev.clientX - startX;
      const finalWidth = Math.max(220, Math.min(460, startWidth + delta));
      storage.set('focusspace-journal-timeline-width', String(finalWidth));
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Live queries
  const entries = useLiveQuery(
    () =>
      db.journalEntries
        .where('pageId')
        .equals(DAILY_JOURNAL_PAGE_ID)
        .toArray(),
    []
  );
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const habits = useLiveQuery(() => db.habits.toArray(), []) ?? [];
  const focusLogs = useLiveQuery(() => db.focusLogs.toArray(), []) ?? [];

  // Sorted list of all recorded dates + today
  const sortedEntries = useMemo(() => {
    return [...(entries ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  }, [entries]);

  // Unique list of dates including today
  const dateList = useMemo(() => {
    const dates = new Set<string>();
    dates.add(today);
    sortedEntries.forEach(e => dates.add(e.date));
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [sortedEntries, today]);

  // Current active entry for selected date
  const activeEntry = useMemo(() => {
    return sortedEntries.find(e => e.date === selectedDate) ?? null;
  }, [sortedEntries, selectedDate]);

  // Day metrics for the selected date
  const dayMetrics = useMemo(() => {
    const completedTasks = tasks.filter(t => {
      if (t.status !== 'Submitted/Done') return false;
      const doneDate = t.completedAt ? t.completedAt.slice(0, 10) : t.updatedAt?.slice(0, 10);
      return doneDate === selectedDate;
    });

    const dayFocusMin = focusLogs
      .filter(l => l.startedAt?.slice(0, 10) === selectedDate && l.mode === 'focus')
      .reduce((sum, l) => sum + (l.durationMinutes || 0), 0);

    const activeHabits = habits.filter(h => h.active);
    const habitsCompleted = activeHabits.filter(h => h.completions.includes(selectedDate));

    return {
      completedCount: completedTasks.length,
      focusMinutes: dayFocusMin,
      habitsDone: habitsCompleted.length,
      habitsTotal: activeHabits.length,
    };
  }, [tasks, focusLogs, habits, selectedDate]);

  // Handle capture snapshot now
  const handleCaptureSnapshot = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      await saveDailyJournalSnapshot(selectedDate, true);
    } catch {
      toast('Could not generate daily review snapshot.', 'error');
    } finally {
      setCapturing(false);
    }
  };

  // Create an entry if writing on a blank day
  const handleStartWriting = async () => {
    try {
      await getOrCreateEntry(DAILY_JOURNAL_PAGE_ID, selectedDate);
      setIsEditing(true);
    } catch {
      toast('Could not create journal entry.', 'error');
    }
  };

  // Debounced auto-save for editor changes
  const saveTimeoutRef = useRef<number | null>(null);
  const handleContentChange = (doc: RichTextDoc) => {
    if (!activeEntry) return;
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      void saveEntry(activeEntry.id, doc);
    }, 600);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Handle task checkbox toggle in view mode
  const handleToggleTask = async (path: [number, number]) => {
    if (!activeEntry) return;
    const nextDoc = toggleTaskAtPath(activeEntry.content, path);
    await saveEntry(activeEntry.id, nextDoc);
  };

  // Handle entry deletion
  const handleDeleteEntry = async () => {
    if (!activeEntry) return;
    await deleteEntry(activeEntry.id);
    setConfirmingDelete(false);
    toast(`Deleted reflection for ${relativeDay(selectedDate)}`, 'info');
  };

  const isToday = selectedDate === today;

  return (
    <div className="p-5 lg:p-7 max-w-[1500px] mx-auto space-y-6">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="index-chip text-fg-subtle mb-1">Workspace · Daily Archive</div>
          <div className="flex items-center gap-2.5">
            <span className="size-8 rounded-xl bg-accent text-accent-fg grid place-items-center keycap">
              <BookOpen size={16} />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Daily Journal</h1>
          </div>
          <p className="text-sm text-fg-muted mt-1">
            Automated daily reflections, focus time logs, and personal thoughts. Auto-saves every evening at 11:59 PM.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => void handleCaptureSnapshot()}
            disabled={capturing}
            className="h-9 px-3.5 rounded-xl bg-accent text-accent-fg font-semibold text-xs sm:text-sm flex items-center gap-2 hover:bg-accent-hover disabled:opacity-60 keycap cursor-pointer"
          >
            <Sparkles size={15} />
            <span>{capturing ? 'Capturing…' : 'Capture Snapshot Now'}</span>
          </button>
        </div>
      </header>

      {/* Main Two-Column Layout with Drag-Resizable Split */}
      <div
        className={`flex flex-col lg:flex-row gap-6 lg:gap-0 items-start w-full relative ${
          isTimelineDragging ? 'select-none transition-none' : 'transition-all duration-300 ease-out'
        }`}
      >
        {/* Left Column: Chronological Date Archive Navigator */}
        <aside
          aria-label="Journal Date Navigator"
          style={{ width: `${timelineWidth}px` }}
          className="w-full lg:w-auto shrink-0 atelier-card rounded-2xl p-3 flex flex-col gap-2 max-h-[75vh] overflow-y-auto"
        >
          <div className="px-3 py-2 flex items-center justify-between border-b border-line">
            <span className="index-chip text-fg-subtle">Archive Timeline</span>
            <span className="text-[11px] font-mono text-fg-muted">{dateList.length} days</span>
          </div>

          <div className="space-y-1">
            {dateList.map(date => {
              const hasEntry = sortedEntries.some(e => e.date === date);
              const isSelected = selectedDate === date;
              const dateEntry = sortedEntries.find(e => e.date === date);
              const snippet = dateEntry ? richTextSnippet(dateEntry.content, 50) : '';

              return (
                <button
                  key={date}
                  onClick={() => {
                    setSelectedDate(date);
                  }}
                  className={`w-full text-left p-3 rounded-xl transition flex flex-col gap-1 cursor-pointer ${
                    isSelected
                      ? 'bg-accent text-accent-fg font-semibold keycap'
                      : 'hover:bg-hover text-fg-soft border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">
                      {date === today ? 'Today' : dateLabel(date)}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isSelected
                          ? 'bg-black/20 text-accent-fg'
                          : 'bg-surface-2 text-fg-subtle border border-line'
                      }`}
                    >
                      {date}
                    </span>
                  </div>

                  {hasEntry ? (
                    <p
                      className={`text-[11px] line-clamp-1 truncate ${
                        isSelected ? 'text-accent-fg/80' : 'text-fg-muted'
                      }`}
                    >
                      {snippet || 'Daily review recorded'}
                    </p>
                  ) : (
                    <span
                      className={`text-[11px] italic ${
                        isSelected ? 'text-accent-fg/70' : 'text-fg-subtle'
                      }`}
                    >
                      No entry yet
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Drag Rail Divider */}
        <div
          onPointerDown={handleTimelineResizeDown}
          onDoubleClick={() => {
            setTimelineWidth(300);
            storage.set('focusspace-journal-timeline-width', '300');
          }}
          className="hidden lg:flex self-stretch w-3.5 cursor-col-resize group relative z-20 items-center justify-center hover:bg-accent/20 active:bg-accent/30 transition select-none shrink-0"
          title="Drag to resize timeline (Double-click to reset to 300px)"
        >
          <div className="w-[2px] h-36 rounded-full bg-line-strong/60 group-hover:bg-accent group-hover:h-52 transition-all" />
        </div>

        {/* Right Column: Entry Reader / Editor & Live Telemetry */}
        <main className="flex-1 min-w-0 space-y-4 lg:pl-5 w-full">
          {/* Day Telemetry Header Card */}
          <div className="atelier-card rounded-2xl p-5 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-accent" />
                <span className="text-base font-bold">
                  {relativeDay(selectedDate)} · {dateLabel(selectedDate)}
                </span>
                {isToday && (
                  <span className="size-2 rounded-full bg-accent animate-pulse" title="Active Day" />
                )}
              </div>
              <p className="text-xs text-fg-muted mt-1">
                {activeEntry
                  ? `Last updated at ${new Date(activeEntry.updatedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'No entry logged for this date yet'}
              </p>
            </div>

            {/* 3-Cell Telemetry Badges */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="px-3 py-1.5 rounded-xl border border-line bg-surface-2 flex items-center gap-2">
                <Clock size={13} className="text-accent" />
                <div className="text-xs font-mono">
                  <span className="font-bold">{formatDuration(dayMetrics.focusMinutes)}</span>{' '}
                  <span className="text-fg-subtle">focus</span>
                </div>
              </div>

              <div className="px-3 py-1.5 rounded-xl border border-line bg-surface-2 flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <div className="text-xs font-mono">
                  <span className="font-bold">{dayMetrics.completedCount}</span>{' '}
                  <span className="text-fg-subtle">tasks done</span>
                </div>
              </div>

              <div className="px-3 py-1.5 rounded-xl border border-line bg-surface-2 flex items-center gap-2">
                <Flame size={13} className="text-amber-500" />
                <div className="text-xs font-mono">
                  <span className="font-bold">
                    {dayMetrics.habitsDone}/{dayMetrics.habitsTotal}
                  </span>{' '}
                  <span className="text-fg-subtle">habits</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Entry Container */}
          {activeEntry ? (
            <div className="atelier-card rounded-2xl p-6 border border-line space-y-4">
              {/* Action Toolbar */}
              <div className="flex items-center justify-between pb-3 border-b border-line gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditing(v => !v)}
                    className="h-8 px-3 rounded-xl border border-line bg-surface-2 text-xs font-semibold flex items-center gap-1.5 hover:bg-hover keycap cursor-pointer"
                  >
                    {isEditing ? <Eye size={13} /> : <Pencil size={13} />}
                    <span>{isEditing ? 'View Mode' : 'Edit Mode'}</span>
                  </button>

                  <button
                    onClick={async () => {
                      const summaryDoc = await generateDailySummaryDoc(selectedDate);
                      await saveEntry(activeEntry.id, summaryDoc);
                      toast('Inserted latest automated daily summary!', 'success');
                    }}
                    className="h-8 px-3 rounded-xl border border-line bg-surface-2 text-xs font-semibold flex items-center gap-1.5 hover:bg-hover keycap cursor-pointer"
                    title="Refresh automated daily review content"
                  >
                    <RefreshCw size={13} />
                    <span className="hidden sm:inline">Refresh Summary</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-fg-subtle">
                    Auto-save at 23:59:00
                  </span>
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="size-8 grid place-items-center rounded-lg text-fg-subtle hover:text-red-500 hover:bg-hover cursor-pointer"
                    title="Delete reflection"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Editor or Formatted Rich-Text View */}
              {isEditing ? (
                <RichTextEditor
                  content={activeEntry.content}
                  onChange={handleContentChange}
                  placeholder={`Write your reflection for ${dateLabel(selectedDate)}…`}
                  autoFocus={false}
                />
              ) : (
                <div className="py-2">
                  <RichTextView
                    doc={activeEntry.content}
                    onToggleTask={handleToggleTask}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-surface p-6">
              <EmptyState
                icon={BookOpen}
                title={`No reflection for ${relativeDay(selectedDate)}`}
                text="FocusSpace will automatically generate a summary at 11:59 PM, or you can capture a snapshot or start writing right now."
                action={
                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleCaptureSnapshot()}
                      className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-xs font-semibold flex items-center gap-1.5 hover:bg-accent-hover keycap cursor-pointer"
                    >
                      <Sparkles size={13} /> Snapshot Now
                    </button>
                    <button
                      onClick={() => void handleStartWriting()}
                      className="h-8 px-3 rounded-xl border border-line bg-surface-2 text-xs font-semibold hover:bg-hover keycap cursor-pointer"
                    >
                      <Plus size={13} /> Write Reflection
                    </button>
                  </div>
                }
              />
            </div>
          )}
        </main>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete this daily journal entry?"
          text={`Are you sure you want to delete your reflection for ${dateLabel(
            selectedDate
          )}? This cannot be undone.`}
          confirmLabel="Delete Reflection"
          danger
          onConfirm={() => void handleDeleteEntry()}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
