import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import type { EventDropArg } from '@fullcalendar/core';
import { CalendarDays, Clock3, Layers, Plus, Search, Upload, X, Zap, Play, RotateCcw } from 'lucide-react';
import { db } from '../db/db';
import { useMediaQuery } from '../lib/hooks';
import { importIcsToDatabase } from '../lib/icsImport';
import { openTaskEditor } from '../lib/taskEditor';
import { timer, getTimerState, focusOnTask } from '../lib/timer';
import { generateSmartSchedule, applySmartScheduleTimeBlocks } from '../lib/smartScheduler';
import { toast } from '../lib/toast';
import { uid, WEEK_STARTS_ON, addDays, isoToday } from '../lib/utils';
import type { Category, Task } from '../types';

interface CalendarEventLike {
  extendedProps: Record<string, unknown>;
  start: Date | null;
  end: Date | null;
  allDay: boolean;
  setAllDay(allDay: boolean): void;
  setStart(start: Date): void;
}
type EventReceiveArg = { event: CalendarEventLike };
type EventResizeDoneArg = { event: CalendarEventLike };

function localDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function localTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function durationString(minutes: number) {
  const safe = Math.max(5, minutes || 30);
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function categoryColor(task: Task, categories: Category[]) {
  return categories.find(c => c.id === task.categoryId)?.color ?? task.colorCode ?? '#a1a1aa';
}

export function Calendar() {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const focusLogs = useLiveQuery(() => db.focusLogs.toArray(), []) ?? [];
  const externalRef = useRef<HTMLDivElement | null>(null);
  const calendarRef = useRef<FullCalendar | null>(null);
  const [selectedCatId, setSelectedCatId] = useState<string | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [trackView, setTrackView] = useState<'both' | 'planned' | 'actual'>('both');
  const [clickSlot, setClickSlot] = useState<{ date: string; time: string } | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const isNarrow = useMediaQuery('(max-width: 767px)');

  const handleAutoPackDay = async () => {
    const today = isoToday();
    const plan = generateSmartSchedule(tasks, today);
    const newlyScheduled = plan.blocks.filter(b => b.slotType !== 'fixed-anchor');
    if (newlyScheduled.length === 0) {
      toast('No unscheduled tasks found to auto-pack.', 'info');
      return;
    }
    await applySmartScheduleTimeBlocks(plan, today);
    toast(`Auto-packed ${newlyScheduled.length} tasks into today's schedule!`, 'success');
  };

  useEffect(() => {
    if (!selectedTask && !clickSlot) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedTask(null);
        setClickSlot(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedTask, clickSlot]);

  const scheduled = useMemo(
    () => tasks.filter(t => Boolean(t.dueDate && t.dueTime)),
    [tasks]
  );

  const unscheduled = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter(t => !t.dueDate || !t.dueTime)
      .filter(t => selectedCatId === 'all' || t.categoryId === selectedCatId)
      .filter(t => !q || t.title.toLowerCase().includes(q) || t.projectTag.toLowerCase().includes(q));
  }, [tasks, query, selectedCatId]);

  useEffect(() => {
    if (!externalRef.current) return;
    const draggable = new Draggable(externalRef.current, {
      itemSelector: '.fc-external-task',
      eventData: (element) => ({
        title: element.getAttribute('data-title') ?? 'Task',
        duration: element.getAttribute('data-duration') ?? '00:30',
        backgroundColor: element.getAttribute('data-color') ?? '#a1a1aa',
        borderColor: element.getAttribute('data-color') ?? '#a1a1aa',
        textColor: '#09090b',
        extendedProps: { taskId: element.getAttribute('data-task-id'), isPlanned: true },
      }),
    });
    return () => draggable.destroy();
  }, [unscheduled.length, query]);

  const persistEvent = async (taskId: string, start: Date, durationMinutes?: number) => {
    const task = await db.tasks.get(taskId);
    if (!task) return;
    await db.tasks.put({
      ...task,
      dueDate: localDate(start),
      dueTime: localTime(start),
      estimatedDuration: durationMinutes ?? task.estimatedDuration ?? 30,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleReceive = async (info: EventReceiveArg) => {
    const taskId = String(info.event.extendedProps.taskId ?? '');
    if (!taskId || !info.event.start) return;
    const start = new Date(info.event.start);
    if (info.event.allDay) {
      start.setHours(9, 0, 0, 0);
      info.event.setAllDay(false);
      info.event.setStart(start);
    }
    const dropped = info.event.end ? Math.max(5, Math.round((info.event.end.getTime() - start.getTime()) / 60000)) : undefined;
    await persistEvent(taskId, start, dropped);
    await db.tasks.get(taskId).then(task => task && setSelectedTask(task));
  };

  const handleDrop = async (info: EventDropArg) => {
    const taskId = String(info.event.extendedProps.taskId ?? '');
    if (!taskId || !info.event.start) return;
    await persistEvent(taskId, new Date(info.event.start), info.event.end ? Math.max(5, Math.round((info.event.end.getTime() - info.event.start.getTime()) / 60000)) : undefined);
  };

  const handleResize = async (info: EventResizeDoneArg) => {
    const taskId = String(info.event.extendedProps.taskId ?? '');
    if (!taskId || !info.event.start) return;
    const duration = info.event.end
      ? Math.max(5, Math.round((info.event.end.getTime() - info.event.start.getTime()) / 60000))
      : undefined;
    await persistEvent(taskId, new Date(info.event.start), duration);
  };

  const plannedEvents = useMemo(
    () =>
      scheduled
        .filter(t => selectedCatId === 'all' || t.categoryId === selectedCatId)
        .map(task => ({
          id: task.id,
          title: task.title,
          start: `${task.dueDate}T${task.dueTime}:00`,
          duration: durationString(task.estimatedDuration),
          backgroundColor: categoryColor(task, categories),
          borderColor: categoryColor(task, categories),
          textColor: '#09090b',
          editable: true,
          classNames: task.status === 'Submitted/Done' ? ['focusspace-event-done'] : [],
          extendedProps: { taskId: task.id, categoryId: task.categoryId, isPlanned: true },
        })),
    [scheduled, categories, selectedCatId]
  );

  const actualEvents = useMemo(() => {
    return focusLogs
      .filter(l => l.mode === 'focus')
      .map(log => {
        const task = log.taskId ? tasks.find(t => t.id === log.taskId) : undefined;
        return {
          id: `log-${log.id}`,
          title: task ? `⚡ ${task.title}` : `⚡ Focus (${log.durationMinutes}m)`,
          start: log.startedAt,
          end: log.endedAt,
          backgroundColor: 'rgba(56, 189, 248, 0.22)',
          borderColor: '#38bdf8',
          textColor: '#38bdf8',
          editable: false,
          classNames: ['focusspace-actual-event'],
          extendedProps: { logId: log.id, taskId: log.taskId, isActual: true },
        };
      });
  }, [focusLogs, tasks]);

  const events = useMemo(() => {
    if (trackView === 'planned') return plannedEvents;
    if (trackView === 'actual') return actualEvents;
    return [...plannedEvents, ...actualEvents];
  }, [trackView, plannedEvents, actualEvents]);

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto h-full min-h-[calc(100vh-64px)] flex flex-col">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-4 shrink-0">
        <div>
          <div className="index-chip text-fg-soft mb-1">Schedule</div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Calendar & Time Blocking</h1>
          <p className="text-sm text-fg-muted mt-1">Dual-track planning. Drag tasks onto the grid, or click any slot to schedule.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* ⚡ Auto-Pack Day button */}
          <button
            type="button"
            onClick={handleAutoPackDay}
            className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-xs font-semibold flex items-center gap-1.5 hover:bg-accent-hover keycap shadow-xs transition"
            title="Automatically slot unscheduled tasks into open calendar gaps around fixed appointments"
          >
            <Zap size={13} />
            <span>⚡ Auto-Pack Day</span>
          </button>

          {/* Dual-Track Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-2 border border-line text-xs">
            <button
              onClick={() => setTrackView('both')}
              className={`px-2.5 py-1 rounded-lg transition ${trackView === 'both' ? 'bg-accent text-accent-fg font-semibold keycap' : 'text-fg-muted hover:text-fg'}`}
            >
              Dual-Track
            </button>
            <button
              onClick={() => setTrackView('planned')}
              className={`px-2.5 py-1 rounded-lg transition ${trackView === 'planned' ? 'bg-accent text-accent-fg font-semibold keycap' : 'text-fg-muted hover:text-fg'}`}
            >
              Planned
            </button>
            <button
              onClick={() => setTrackView('actual')}
              className={`px-2.5 py-1 rounded-lg transition ${trackView === 'actual' ? 'bg-accent text-accent-fg font-semibold keycap' : 'text-fg-muted hover:text-fg'}`}
            >
              Actual Focus
            </button>
          </div>

          {/* Import .ics button */}
          <label className="h-8 px-3 rounded-xl border border-line bg-surface-2 text-xs font-medium text-fg flex items-center gap-1.5 hover:bg-hover cursor-pointer keycap transition">
            <Upload size={13} className="text-fg-muted" /> Import .ics
            <input
              type="file"
              accept=".ics,text/calendar"
              className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const defaultCat = categories[0]?.id ?? 'personal';
                try {
                  const text = await file.text();
                  await importIcsToDatabase(text, defaultCat);
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Could not import .ics file', 'error');
                }
                e.currentTarget.value = '';
              }}
            />
          </label>

          <div className="flex items-center gap-1 text-xs text-fg-muted ml-2">
            <CalendarDays size={15} />
            <span>{scheduled.length} scheduled · {unscheduled.length} unscheduled</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[620px] grid xl:grid-cols-[290px_minmax(0,1fr)] gap-4">
        <aside ref={externalRef} className="atelier-card rounded-3xl overflow-hidden flex flex-col min-h-[280px]">
          <div className="p-4 border-b border-line space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">Unscheduled Tasks</div>
              <span className="text-[11px] font-mono text-fg-muted bg-surface px-2 py-0.5 rounded-full border border-line">
                {unscheduled.length}
              </span>
            </div>

            {/* Category Filter Pills Strip */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCatId('all')}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 transition ${
                  selectedCatId === 'all'
                    ? 'bg-accent text-accent-fg font-semibold'
                    : 'bg-surface border border-line text-fg-muted hover:text-fg'
                }`}
              >
                All
              </button>
              {categories.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCatId(c.id)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 flex items-center gap-1 transition ${
                    selectedCatId === c.id
                      ? 'bg-accent text-accent-fg font-semibold'
                      : 'bg-surface border border-line text-fg-muted hover:text-fg'
                  }`}
                >
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="truncate max-w-[80px]">{c.name}</span>
                </button>
              ))}
            </div>

            {/* Quick Date Jumper */}
            <div className="flex items-center gap-1 pt-1.5 border-t border-line">
              <button
                type="button"
                onClick={() => calendarRef.current?.getApi().today()}
                className="px-2 py-1 rounded-md text-[11px] font-medium bg-surface border border-line text-fg hover:bg-hover transition"
                title="Go to today"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const tomorrow = addDays(isoToday(), 1);
                  calendarRef.current?.getApi().gotoDate(tomorrow);
                }}
                className="px-2 py-1 rounded-md text-[11px] font-medium bg-surface border border-line text-fg hover:bg-hover transition"
                title="Go to tomorrow"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextWeek = addDays(isoToday(), 7);
                  calendarRef.current?.getApi().gotoDate(nextWeek);
                }}
                className="px-2 py-1 rounded-md text-[11px] font-medium bg-surface border border-line text-fg hover:bg-hover transition"
                title="Go to next week"
              >
                +1 Wk
              </button>
              <input
                type="date"
                onChange={e => {
                  if (e.target.value) {
                    calendarRef.current?.getApi().gotoDate(e.target.value);
                  }
                }}
                className="h-6 px-1 text-[11px] rounded bg-surface border border-line text-fg outline-none ml-auto"
                title="Jump to date"
              />
            </div>

            <div className="relative pt-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-soft" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Find a task…"
                className="w-full h-8 rounded-lg bg-surface border border-line pl-9 pr-3 text-xs outline-none focus:border-accent"
              />
            </div>
          </div>
          <div className="p-2 overflow-y-auto space-y-2">
            {unscheduled.length === 0 ? (
              <div className="p-8 text-center text-xs text-fg-soft">Everything is scheduled.</div>
            ) : unscheduled.map(task => {
              const color = categoryColor(task, categories);
              const category = categories.find(c => c.id === task.categoryId);
              return (
                <div
                  key={task.id}
                  className="fc-external-task rounded-xl border border-line bg-surface/70 hover:bg-hover cursor-grab active:cursor-grabbing p-3"
                  data-task-id={task.id}
                  data-title={task.title}
                  data-duration={durationString(task.estimatedDuration)}
                  data-color={color}
                  onClick={() => setSelectedTask(task)}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-1 size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-fg leading-5">{task.title}</div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-fg-soft">
                        <span>{category?.name ?? 'Uncategorized'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Clock3 size={11} />{task.estimatedDuration || 30}m</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="rounded-2xl border border-line bg-surface/70 overflow-hidden min-h-[620px] flex flex-col">
          <div className="calendar-shell flex-1 min-h-[620px] p-2 sm:p-3">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={isNarrow ? 'timeGridDay' : 'timeGridWeek'}
              firstDay={WEEK_STARTS_ON}
              headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
              height="auto"
              contentHeight="auto"
              expandRows
              nowIndicator
              editable
              droppable
              eventResizableFromStart
              eventDurationEditable
              eventStartEditable
              slotMinTime="05:00:00"
              slotMaxTime="24:00:00"
              slotDuration="00:30:00"
              snapDuration="00:15:00"
              allDaySlot={false}
              events={events}
              eventReceive={handleReceive}
              eventDrop={handleDrop}
              eventResize={handleResize}
              dateClick={info => {
                const d = localDate(info.date);
                const t = info.allDay ? '09:00' : localTime(info.date);
                setClickSlot({ date: d, time: t });
              }}
              eventClick={info => {
                const taskId = info.event.extendedProps.taskId;
                if (taskId) {
                  const task = tasks.find(t => t.id === String(taskId));
                  if (task) setSelectedTask(task);
                }
              }}
              eventDidMount={info => {
                info.el.title = info.event.title;
              }}
            />
          </div>
        </section>
      </div>

      {/* Click-to-create Modal */}
      {clickSlot && (
        <div className="fade-in fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onMouseDown={() => setClickSlot(null)}>
          <form
            onSubmit={async e => {
              e.preventDefault();
              const title = quickTitle.trim();
              if (!title || !categories[0]) return;
              const cat = categories[0];
              const task: Task = {
                id: uid(),
                title,
                categoryId: cat.id,
                projectTag: '',
                priority: 'Medium',
                status: 'To Do',
                estimatedDuration: 30,
                dueDate: clickSlot.date,
                dueTime: clickSlot.time,
                subtasks: [],
                notes: '',
                colorCode: cat.color,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              await db.tasks.add(task);
              toast(`Scheduled "${title}" at ${clickSlot.time}`, 'success');
              setClickSlot(null);
              setQuickTitle('');
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Schedule task at slot"
            className="pop-in w-full max-w-md rounded-2xl border border-line bg-surface shadow-2xl p-5"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-base">Schedule Task</h2>
                <p className="text-xs text-fg-subtle mt-0.5">{clickSlot.date} at {clickSlot.time}</p>
              </div>
              <button type="button" onClick={() => setClickSlot(null)} className="text-fg-subtle hover:text-fg"><X size={16} /></button>
            </div>
            <input
              autoFocus
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              placeholder="What are you scheduling?"
              className="mt-4 w-full h-10 rounded-xl bg-surface-2 border border-line px-3 text-sm outline-none focus:border-accent text-fg"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setClickSlot(null)} className="h-8 px-3 rounded-xl text-sm text-fg-muted hover:bg-hover">Cancel</button>
              <button disabled={!quickTitle.trim()} className="h-8 px-4 rounded-xl bg-accent text-accent-fg text-sm font-semibold hover:bg-accent-hover disabled:opacity-40 keycap">Schedule</button>
            </div>
          </form>
        </div>
      )}

      {selectedTask && (
        <div className="fade-in fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onMouseDown={() => setSelectedTask(null)}>
          <div role="dialog" aria-modal="true" aria-label="Scheduled task" className="pop-in w-full max-w-md rounded-2xl border border-line bg-surface shadow-2xl" onMouseDown={e => e.stopPropagation()}>
            <div className="p-5 border-b border-line flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[.16em] text-fg-soft">Scheduled task</div>
                <h2 className="font-semibold mt-1">{selectedTask.title}</h2>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-fg-soft hover:text-fg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div className="flex justify-between items-center"><span className="text-fg-soft font-medium">Date & Time</span><span className="font-mono">{selectedTask.dueDate || '—'} at {selectedTask.dueTime || '—'}</span></div>
              <div className="flex justify-between items-center"><span className="text-fg-soft font-medium">Current Status</span><span className="font-medium text-fg">{selectedTask.status}</span></div>

              {/* Duration Quick-Pick Pills */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs text-fg-soft font-medium">Duration Quick-Pick</label>
                <div className="grid grid-cols-6 gap-1">
                  {[15, 25, 45, 60, 90, 120].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={async () => {
                        await db.tasks.update(selectedTask.id, { estimatedDuration: mins, updatedAt: new Date().toISOString() });
                        setSelectedTask({ ...selectedTask, estimatedDuration: mins });
                        toast(`Duration set to ${mins}m`, 'success');
                      }}
                      className={`py-1 rounded-md text-xs font-mono font-medium transition ${
                        (selectedTask.estimatedDuration || 30) === mins
                          ? 'bg-accent text-accent-fg font-semibold'
                          : 'bg-surface-2 border border-line text-fg hover:bg-hover'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority Selector Pills */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs text-fg-soft font-medium">Priority</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['Low', 'Medium', 'High', 'Urgent'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={async () => {
                        await db.tasks.update(selectedTask.id, { priority: p, updatedAt: new Date().toISOString() });
                        setSelectedTask({ ...selectedTask, priority: p });
                        toast(`Priority set to ${p}`, 'success');
                      }}
                      className={`py-1 rounded-md text-xs font-medium transition ${
                        selectedTask.priority === p
                          ? 'bg-accent text-accent-fg font-semibold'
                          : 'bg-surface-2 border border-line text-fg hover:bg-hover'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 pb-5 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    focusOnTask({ id: selectedTask.id, title: selectedTask.title });
                    if (!getTimerState().running) timer.toggle();
                    setSelectedTask(null);
                    toast(`Started focus session for "${selectedTask.title}"`, 'success');
                  }}
                  className="h-9 rounded-xl bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover flex items-center justify-center gap-1.5 keycap transition"
                >
                  <Play size={13} />
                  <span>Start Focus Now</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await db.tasks.update(selectedTask.id, {
                      dueTime: '',
                      updatedAt: new Date().toISOString(),
                    });
                    setSelectedTask(null);
                    toast(`Unscheduled "${selectedTask.title}"`, 'info');
                  }}
                  className="h-9 rounded-xl border border-line bg-surface-2 text-xs font-medium text-fg hover:bg-hover flex items-center justify-center gap-1.5 transition"
                >
                  <RotateCcw size={13} />
                  <span>Unschedule</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => { openTaskEditor(selectedTask.id); setSelectedTask(null); }}
                className="w-full h-8 rounded-lg border border-line bg-surface text-fg text-xs font-medium hover:bg-hover transition"
              >
                Edit details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
