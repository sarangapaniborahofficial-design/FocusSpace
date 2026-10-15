import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlarmClock,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Flame,
  Inbox,
  Plus,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { db } from '../db/db';
import { computeStreaks } from '../lib/analytics';
import { toggleHabitDay } from '../lib/habitActions';
import { useToday } from '../lib/hooks';
import { openTaskEditor } from '../lib/taskEditor';
import { deleteTask, reorderTasks } from '../lib/tasks';
import { buildTodayPlan } from '../lib/todayPlan';
import { focusOnTask } from '../lib/timer';
import { addDays, formatDuration } from '../lib/utils';
import type { Task } from '../types';
import { Pomodoro } from './Pomodoro';
import { SmartScheduleModal } from './SmartScheduleModal';
import { TaskCard } from './TaskCard';
import { EmptyState, Ring } from './ui';

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

type QueueTab = 'all' | 'today' | 'overdue' | 'done';

/** Home. Answers "what should I do today?" directly: a single suggestion, then overdue, due-today and done. */
export function Today({ onQuickAdd, onNavigate }: { onQuickAdd: () => void; onNavigate?: (view: string) => void }) {
  const today = useToday();
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const habits = useLiveQuery(() => db.habits.filter(h => h.active).toArray(), []) ?? [];
  const cats = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const catMap = useMemo(() => new Map(cats.map(c => [c.id, c])), [cats]);

  const plan = useMemo(() => buildTodayPlan(tasks ?? [], today, nowTime()), [tasks, today]);
  const openCount = plan.overdue.length + plan.today.length;
  const totalCount = openCount + plan.done.length;
  const completionRatio = totalCount > 0 ? plan.done.length / totalCount : 0;
  const habitsDone = habits.filter(h => h.completions.includes(today)).length;

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [queueTab, setQueueTab] = useState<QueueTab>('all');

  const handleTodayDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const currentIds = plan.today.map(t => t.id);
    const fromIdx = currentIds.indexOf(dragId);
    const toIdx = currentIds.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const updated = [...currentIds];
    updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, dragId);
    await reorderTasks(updated);
    setDragId(null);
    setOverId(null);
  };

  const update = useCallback((task: Task) => db.tasks.put(task), []);
  const onDeleteTask = useCallback((t: Task) => void deleteTask(t), []);
  const onStartTask = useCallback((t: Task) => focusOnTask(t), []);

  const card = (t: Task, isReorderable = false) => {
    const cardEl = (
      <TaskCard
        key={t.id}
        task={t}
        category={catMap.get(t.categoryId)}
        onUpdate={update}
        onDelete={() => onDeleteTask(t)}
        onStart={() => onStartTask(t)}
        dragging={dragId === t.id}
        onDragStart={
          isReorderable
            ? e => {
                e.dataTransfer.setData('text/plain', t.id);
                e.dataTransfer.effectAllowed = 'move';
                setDragId(t.id);
              }
            : undefined
        }
        onDragEnd={
          isReorderable
            ? () => {
                setDragId(null);
                setOverId(null);
              }
            : undefined
        }
      />
    );

    if (!isReorderable) return cardEl;

    return (
      <div
        key={t.id}
        onDragOver={e => {
          if (dragId && dragId !== t.id) {
            e.preventDefault();
            if (overId !== t.id) setOverId(t.id);
          }
        }}
        onDragLeave={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverId(null);
        }}
        onDrop={e => {
          e.preventDefault();
          void handleTodayDrop(t.id);
        }}
        className={`transition-[box-shadow] rounded-2xl ${overId === t.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
      >
        {cardEl}
      </div>
    );
  };

  const last7Days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, -(6 - i))), [today]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto space-y-6">
      {/* Top Hero Header & Summary Cards */}
      <div className="atelier-card rounded-3xl p-5 sm:p-7 overflow-hidden">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
          <div className="space-y-1.5">
            <div className="index-chip text-fg-subtle">Today / Focus</div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-fg leading-none">
              Make today count.
            </h1>
            <p className="text-sm text-fg-muted">
              {new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="rounded-2xl border border-line bg-surface-2 p-3.5 flex items-center gap-3">
              <Ring value={completionRatio} size={38} stroke={4}>
                <span className="text-[10px] font-mono font-bold">{Math.round(completionRatio * 100)}%</span>
              </Ring>
              <div>
                <div className="text-lg font-bold font-mono tabular-nums leading-none">
                  {totalCount > 0 ? (
                    <>
                      {plan.done.length}
                      <span className="text-fg-muted">/{totalCount}</span>
                    </>
                  ) : (
                    '-'
                  )}
                </div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-fg-subtle mt-1">Completed</div>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface-2 p-3.5">
              <div className="flex items-center justify-between text-fg-muted">
                <span className="text-[10px] font-mono uppercase tracking-wider">Planned</span>
                <Clock3 size={13} className="text-accent-text" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums mt-1.5">
                {openCount ? formatDuration(plan.plannedMinutes) : '0m'}
              </div>
              <div className="text-[10px] text-fg-subtle font-mono">{openCount} open tasks</div>
            </div>

            <div className="rounded-2xl border border-line bg-surface-2 p-3.5">
              <div className="flex items-center justify-between text-fg-muted">
                <span className="text-[10px] font-mono uppercase tracking-wider">Habits</span>
                <Flame size={13} className="text-amber-500" />
              </div>
              <div className="text-lg font-bold font-mono tabular-nums mt-1.5">
                {habitsDone}/{habits.length}
              </div>
              <div className="text-[10px] text-fg-subtle font-mono">done today</div>
            </div>

            {onNavigate && (
              <button
                onClick={() => onNavigate('review')}
                className="rounded-2xl border border-line bg-surface-2 hover:bg-hover p-3.5 text-left transition flex flex-col justify-between group keycap"
              >
                <div className="flex items-center justify-between w-full text-fg-muted">
                  <span className="text-[10px] font-mono uppercase tracking-wider">Reflection</span>
                  <Trophy size={13} className="text-accent-text group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex items-center justify-between w-full mt-1.5">
                  <span className="text-xs font-semibold text-fg">Weekly Review</span>
                  <ArrowUpRight size={14} className="text-fg-muted" />
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid xl:grid-cols-[1fr_390px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          {/* "Do this next" Suggestion */}
          {tasks !== undefined && plan.next && (
            <section className="atelier-card rounded-3xl p-5 border-l-4 border-l-accent flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <span className="size-10 rounded-2xl bg-accent text-accent-fg grid place-items-center shrink-0 keycap">
                  <Sparkles size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-fg-muted">
                    Do this next · <span className="text-accent-text">{plan.next.reason}</span>
                  </div>
                  <button
                    onClick={() => openTaskEditor(plan.next!.task.id)}
                    className="font-semibold text-base sm:text-lg text-fg hover:underline underline-offset-4 truncate block text-left mt-0.5"
                  >
                    {plan.next.task.title}
                  </button>
                </div>
              </div>
              <button
                onClick={() => focusOnTask(plan.next!.task)}
                className="shrink-0 h-9 px-4 rounded-xl bg-accent text-accent-fg text-sm font-semibold flex items-center gap-1.5 hover:bg-accent-hover keycap"
              >
                Focus
              </button>
            </section>
          )}

          {/* Today's Focus Tasks */}
          <section className="atelier-card rounded-3xl overflow-hidden">
            <div className="p-5 border-b border-line flex flex-wrap justify-between items-center gap-3 bg-surface-2/40">
              <div className="flex items-center gap-3">
                <div className="font-semibold text-base">Today's Focus Tasks</div>
                <span className="text-xs text-fg-subtle font-mono tabular-nums">
                  {openCount ? `${formatDuration(plan.plannedMinutes)} planned` : `${plan.done.length} done`}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {totalCount > 0 && (
                  <div className="flex items-center p-1 rounded-xl bg-surface border border-line text-xs">
                    {(
                      [
                        ['all', `All (${totalCount})`],
                        ['today', `Due today (${plan.today.length})`],
                        ...(plan.overdue.length > 0 ? [['overdue', `Overdue (${plan.overdue.length})`]] : []),
                        ['done', `Done (${plan.done.length})`],
                      ] as [QueueTab, string][]
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        onClick={() => setQueueTab(id)}
                        className={`px-2.5 py-1 rounded-lg text-xs transition ${
                          queueTab === id ? 'bg-inv text-on-inv font-semibold' : 'text-fg-muted hover:text-fg'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {openCount > 0 && (
                  <button
                    onClick={() => setScheduleOpen(true)}
                    className="h-9 px-3 rounded-xl border border-line bg-surface hover:bg-hover text-xs font-medium text-fg flex items-center gap-1.5 transition keycap"
                    title="Generate an AI-optimized schedule"
                  >
                    <Zap size={13} className="text-accent-text" /> Smart Schedule
                  </button>
                )}
                <button
                  onClick={onQuickAdd}
                  className="h-9 px-3 rounded-xl bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover flex items-center gap-1.5 transition keycap"
                >
                  <Plus size={14} /> Add Task
                </button>
              </div>
            </div>

            <div className="p-4 space-y-5">
              {tasks === undefined ? (
                <div className="space-y-2.5" aria-busy="true">
                  <div className="skeleton h-[76px]" />
                  <div className="skeleton h-[76px]" />
                </div>
              ) : openCount === 0 && plan.done.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Nothing on the books today"
                  text="Enjoy the breathing room, or pull something forward."
                  action={
                    <button
                      onClick={onQuickAdd}
                      className="h-9 px-4 rounded-xl bg-accent text-accent-fg text-sm font-semibold flex items-center gap-1.5 keycap"
                    >
                      <Plus size={15} /> Add a task
                    </button>
                  }
                />
              ) : (
                <>
                  {(queueTab === 'all' || queueTab === 'overdue') && plan.overdue.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-rose-500 mb-2.5 px-1">
                        <AlarmClock size={13} /> Overdue · {plan.overdue.length}
                      </div>
                      <div className="space-y-2">{plan.overdue.map(t => card(t))}</div>
                    </div>
                  )}

                  {(queueTab === 'all' || queueTab === 'today') && plan.today.length > 0 && (
                    <div>
                      {plan.overdue.length > 0 && queueTab === 'all' && (
                        <div className="text-xs font-medium text-fg-muted mb-2.5 mt-2 px-1">Due today</div>
                      )}
                      <div className="space-y-2">{plan.today.map(t => card(t, true))}</div>
                    </div>
                  )}

                  {(queueTab === 'all' || queueTab === 'done') && plan.done.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-fg-subtle mb-2.5 mt-2 px-1">
                        <CheckCircle2 size={13} className="text-emerald-500" /> Done today · {plan.done.length}
                      </div>
                      <div className="space-y-2">{plan.done.map(t => card(t))}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Coming up */}
          {plan.upcoming.length > 0 && (
            <section className="atelier-card rounded-3xl overflow-hidden">
              <div className="p-4 px-5 border-b border-line flex items-center justify-between bg-surface-2/30">
                <span className="font-semibold text-sm text-fg">Coming up</span>
                <span className="text-xs font-mono text-fg-muted">{plan.upcoming.length} scheduled</span>
              </div>
              <div className="p-4 space-y-2">{plan.upcoming.map(t => card(t))}</div>
            </section>
          )}

          {/* Active Goals */}
          <GoalsSection />
        </div>

        {/* Right Column: Pomodoro + Daily habits */}
        <div className="space-y-6">
          <Pomodoro />

          <section className="atelier-card rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 font-semibold text-base">
                <Target size={16} className="text-accent-text" /> Daily habits
              </div>
              {habits.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-fg-muted">
                  <span className="tabular-nums">
                    {habitsDone} of {habits.length}
                  </span>
                  <Ring value={habitsDone / habits.length} size={24} stroke={3.5} />
                </div>
              )}
            </div>

            {habits.length === 0 ? (
              <EmptyState
                compact
                icon={Target}
                title="No active habits yet"
                text="Add a habit from Settings to see one-tap check-ins here."
              />
            ) : (
              <div className="space-y-2.5">
                {habits.map(h => {
                  const done = h.completions.includes(today);
                  const streak = computeStreaks(h.completions, today).current;
                  return (
                    <button
                      key={h.id}
                      onClick={() => void toggleHabitDay(h.id, today)}
                      aria-pressed={done}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-[background-color,border-color,box-shadow,opacity] duration-150 flex items-center justify-between gap-3 ${
                        done
                          ? 'border-line-strong bg-surface-2 keycap'
                          : 'border-line bg-surface hover:bg-hover'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="size-9 rounded-xl grid place-items-center shrink-0 transition-transform"
                          style={{
                            background: done ? h.color : `${h.color}18`,
                            color: done ? '#0b0d10' : h.color,
                          }}
                        >
                          {done ? <Check size={17} strokeWidth={2.5} /> : <Circle size={16} />}
                        </span>
                        <div className="min-w-0">
                          <div className={`text-sm font-medium truncate ${done ? 'text-fg' : 'text-fg-soft'}`}>
                            {h.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1" aria-hidden="true">
                              {last7Days.map(d => {
                                const hit = h.completions.includes(d);
                                return (
                                  <span
                                    key={d}
                                    className="size-1.5 rounded-full"
                                    style={{ background: hit ? h.color : 'var(--c-line-strong)' }}
                                  />
                                );
                              })}
                            </div>
                            {h.targetLabel && (
                              <span className="text-xs text-fg-subtle">· {h.targetLabel}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {streak > 0 && (
                        <span
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface border border-line text-xs text-fg-muted tabular-nums shrink-0"
                          title={`${streak}-day streak`}
                        >
                          <Flame size={12} className="text-amber-500" />
                          {streak}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      <SmartScheduleModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        tasks={[...plan.overdue, ...plan.today]}
        today={today}
        categories={cats}
      />
    </div>
  );
}

function GoalsSection() {
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? [];
  if (goals.length === 0) return null;
  return (
    <section className="atelier-card rounded-3xl p-5">
      <div className="flex items-center gap-2 font-semibold mb-4">
        <Target size={16} className="text-accent-text" /> Active Goals
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {goals.map(g => {
          const pct = Math.min(100, Math.max(0, (g.currentValue / g.targetValue) * 100));
          return (
            <div key={g.id} className="p-3.5 rounded-2xl border border-line bg-surface-2">
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-semibold text-fg truncate">{g.title}</span>
                <span className="text-xs font-mono text-fg-muted tabular-nums">
                  {g.currentValue} / {g.targetValue} {g.metricLabel}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--ring-track)] overflow-hidden">
                <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
