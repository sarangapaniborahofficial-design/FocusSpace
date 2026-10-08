import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import type { EventDropArg } from '@fullcalendar/core';
import { CalendarDays, Clock3, Search, X } from 'lucide-react';
import { db } from '../db/db';
import { useMediaQuery } from '../lib/hooks';
import { openTaskEditor } from '../lib/taskEditor';
import { WEEK_STARTS_ON } from '../lib/utils';
import type { Category, Task } from '../types';

// Only the parts of FullCalendar's event that these handlers use. Typing them structurally means the code
// doesn't depend on which argument types the library happens to export (they differ between versions).
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
  const externalRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const isNarrow = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    if (!selectedTask) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedTask(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedTask]);

  const scheduled = useMemo(
    () => tasks.filter(t => Boolean(t.dueDate && t.dueTime)),
    [tasks]
  );

  const unscheduled = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter(t => !t.dueDate || !t.dueTime)
      .filter(t => !q || t.title.toLowerCase().includes(q) || t.projectTag.toLowerCase().includes(q));
  }, [tasks, query]);

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
        extendedProps: { taskId: element.getAttribute('data-task-id') },
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
    // Keep the task's own estimate unless the dropped block carries an explicit end. (The previous
    // expression mixed `??` with `-` and either forced 30 minutes or produced an epoch-sized duration.)
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

  const events = scheduled.map(task => ({
    id: task.id,
    title: task.title,
    start: `${task.dueDate}T${task.dueTime}:00`,
    duration: durationString(task.estimatedDuration),
    backgroundColor: categoryColor(task, categories),
    borderColor: categoryColor(task, categories),
    textColor: '#09090b',
    editable: true,
    classNames: task.status === 'Submitted/Done' ? ['focusspace-event-done'] : [],
    extendedProps: { taskId: task.id, categoryId: task.categoryId },
  }));

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto h-full min-h-[calc(100vh-64px)] flex flex-col">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-4 shrink-0">
        <div>
          <div className="text-xs uppercase tracking-[.18em] text-zinc-600 dark:text-zinc-400 dark:text-zinc-500 mb-1">Schedule</div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar & Time Blocking</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 mt-1">Drag unscheduled tasks onto the grid. Move or resize blocks to update them.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 dark:text-zinc-500">
          <CalendarDays size={15} />
          <span>{scheduled.length} scheduled · {unscheduled.length} unscheduled</span>
        </div>
      </div>

      <div className="flex-1 min-h-[620px] grid xl:grid-cols-[290px_minmax(0,1fr)] gap-4">
        <aside ref={externalRef} className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60/60 dark:border-zinc-800/60 bg-[var(--card-bg)] shadow-sm overflow-hidden flex flex-col min-h-[280px]">
          <div className="p-4 border-b border-zinc-200/60 dark:border-zinc-800/60/60 dark:border-zinc-800/60">
            <div className="font-medium">Unscheduled</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-500 mt-1">Drag a task to a date/time.</div>
            <div className="relative mt-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 dark:text-zinc-400 dark:text-zinc-500" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a task…" className="w-full h-9 rounded-lg bg-white border border-zinc-200/60 dark:border-zinc-800/60/60 dark:border-zinc-800/60 pl-9 pr-3 text-sm outline-none focus:border-zinc-600" />
            </div>
          </div>
          <div className="p-2 overflow-y-auto space-y-2">
            {unscheduled.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-500">Everything is scheduled.</div>
            ) : unscheduled.map(task => {
              const color = categoryColor(task, categories);
              const category = categories.find(c => c.id === task.categoryId);
              return (
                <div
                  key={task.id}
                  className="fc-external-task rounded-xl border border-zinc-200/60 dark:border-zinc-800/60/60 dark:border-zinc-800/60 bg-white/70 hover:bg-zinc-50 dark:bg-zinc-900/50 cursor-grab active:cursor-grabbing p-3"
                  data-task-id={task.id}
                  data-title={task.title}
                  data-duration={durationString(task.estimatedDuration)}
                  data-color={color}
                  onClick={() => setSelectedTask(task)}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-1 size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-zinc-200 dark:text-zinc-600 leading-5">{task.title}</div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400 dark:text-zinc-500">
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

        <section className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60/60 dark:border-zinc-800/60 bg-white/70 overflow-hidden min-h-[620px] flex flex-col">
          <div className="calendar-shell flex-1 min-h-[620px] p-2 sm:p-3">
            <FullCalendar
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
              eventClick={info => {
                const task = tasks.find(t => t.id === String(info.event.extendedProps.taskId));
                if (task) setSelectedTask(task);
              }}
              eventDidMount={info => {
                info.el.title = info.event.title;
              }}
            />
          </div>
        </section>
      </div>

      {selectedTask && (
        <div className="fade-in fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onMouseDown={() => setSelectedTask(null)}>
          <div role="dialog" aria-modal="true" aria-label="Scheduled task" className="pop-in w-full max-w-md rounded-2xl border border-zinc-700 bg-white shadow-2xl" onMouseDown={e => e.stopPropagation()}>
            <div className="p-5 border-b border-zinc-200/60 dark:border-zinc-800/60/60 dark:border-zinc-800/60 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[.16em] text-zinc-600 dark:text-zinc-400 dark:text-zinc-500">Scheduled task</div>
                <h2 className="font-semibold mt-1">{selectedTask.title}</h2>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-500 hover:text-zinc-200 dark:text-zinc-600"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-500">Date</span><span>{selectedTask.dueDate || '—'}</span></div>
              <div className="flex justify-between"><span className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-500">Time</span><span>{selectedTask.dueTime || '—'}</span></div>
              <div className="flex justify-between"><span className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-500">Duration</span><span>{selectedTask.estimatedDuration || 30} min</span></div>
              <div className="flex justify-between"><span className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-500">Status</span><span>{selectedTask.status}</span></div>
              <div className="pt-2 text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-500">Move or resize the event on the calendar to change its schedule.</div>
            </div>
            <div className="px-5 pb-5">
              <button onClick={() => { openTaskEditor(selectedTask.id); setSelectedTask(null); }} className="w-full h-10 rounded-lg bg-[var(--accent)] text-[#121214] text-sm font-medium hover:bg-[#d97706]">Edit details</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
