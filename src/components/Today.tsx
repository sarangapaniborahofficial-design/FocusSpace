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
  Calendar,
  Clock,
  Hash,
  Tag,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { db } from '../db/db';
import { computeStreaks } from '../lib/analytics';
import { toggleHabitDay } from '../lib/habitActions';
import { useToday } from '../lib/hooks';
import { parseTaskInput } from '../lib/taskParser';
import { openTaskEditor } from '../lib/taskEditor';
import { deleteTask, reorderTasks } from '../lib/tasks';
import { toast } from '../lib/toast';
import { buildTodayPlan } from '../lib/todayPlan';
import { focusOnTask } from '../lib/timer';
import { addDays, formatDuration, uid } from '../lib/utils';
import type { Category, Task } from '../types';
import { AppDock } from './AppDock';
import { DailyBriefing } from './DailyBriefing';
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto space-y-6 pb-28">
      {/* Dynamic Time-Aware Daily Briefing Card */}
      <DailyBriefing
        today={today}
        openCount={openCount}
        totalCount={totalCount}
        completionRatio={completionRatio}
        plannedMinutes={plan.plannedMinutes}
        habitsDone={habitsDone}
        totalHabits={habits.length}
        nextTask={plan.next}
        onNavigate={onNavigate}
        onOpenSchedule={() => setScheduleOpen(true)}
      />

      {/* Main 2-Column Workspace */}
      <div className="grid xl:grid-cols-[1fr_390px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          {/* Quick Capture Bar */}
          <TodayQuickCapture categories={cats} today={today} />

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

      {/* Floating Bottom Workspace Dock Tray */}
      <AppDock floating />
    </div>
  );
}

function GoalsSection() {
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  if (goals.length === 0) return null;
  return (
    <section className="atelier-card rounded-3xl p-5">
      <div className="flex items-center gap-2 font-semibold mb-4">
        <Target size={16} className="text-accent-text" /> Active Goals
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {goals.map(g => {
          const pct = Math.min(100, Math.max(0, (g.currentValue / g.targetValue) * 100));
          const cat = g.categoryId ? categories.find(c => c.id === g.categoryId) : undefined;
          return (
            <div key={g.id} className="p-3.5 rounded-2xl border border-line bg-surface-2">
              <div className="flex justify-between items-start mb-2 gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-fg truncate">{g.title}</span>
                    {g.goalType && g.goalType !== 'manual' && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/15 text-accent-text border border-accent/25 shrink-0 flex items-center gap-0.5">
                        <Zap size={9} />
                        {g.goalType === 'tasks-completed' ? 'Tasks' : g.goalType === 'focus-hours' ? 'Focus' : 'Streak'}
                      </span>
                    )}
                  </div>
                  {cat && (
                    <div className="text-[11px] text-fg-subtle flex items-center gap-1 mt-0.5">
                      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span>{cat.name}</span>
                    </div>
                  )}
                </div>
                <span className="text-xs font-mono text-fg-muted tabular-nums shrink-0">
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

function TodayQuickCapture({ categories, today }: { categories: Category[]; today: string }) {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const parsed = useMemo(() => parseTaskInput(input, categories, today), [input, categories, today]);
  const hasTokens = Object.keys(parsed.tokens).length > 0;

  const handleCreate = async () => {
    const raw = input.trim();
    if (!raw) return;
    const title = (hasTokens ? parsed.title : raw).trim();
    if (!title) return;
    const cat = parsed.categoryId ? (categories.find(c => c.id === parsed.categoryId) ?? categories[0]) : categories[0];
    if (!cat) return;

    const task: Task = {
      id: uid(),
      title,
      categoryId: cat.id,
      projectTag: parsed.projectTag ?? '',
      priority: parsed.priority ?? 'Medium',
      status: 'To Do',
      estimatedDuration: parsed.estimatedDuration ?? 30,
      dueDate: parsed.dueDate ?? today,
      dueTime: parsed.dueTime ?? '',
      subtasks: [],
      notes: '',
      colorCode: cat.color,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await db.tasks.add(task);
      toast(`Captured "${title}" into ${cat.name}`, 'success');
      setInput('');
    } catch {
      toast('Could not save task.', 'error');
    }
  };

  return (
    <div className={`atelier-card rounded-3xl border transition-[border-color,box-shadow] p-3.5 sm:p-4 ${isFocused ? 'border-line-strong shadow-card' : 'border-line'}`}>
      <div className="flex items-center gap-2.5">
        <span className="size-9 rounded-2xl bg-surface-2 border border-line grid place-items-center text-fg-subtle shrink-0">
          <Plus size={16} />
        </span>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleCreate();
            }
          }}
          placeholder="Quick capture task... (e.g. Finish report @projects #Q3 !high ~45m 4pm)"
          className="flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
        />
        <button
          onClick={() => void handleCreate()}
          disabled={!input.trim()}
          className="h-8 sm:h-9 px-3.5 rounded-xl bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover disabled:opacity-30 transition keycap shrink-0"
        >
          Capture
        </button>
      </div>

      {hasTokens && (
        <div className="mt-3 pt-2.5 border-t border-line/60 flex flex-wrap items-center gap-1.5 text-xs">
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
    </div>
  );
}

