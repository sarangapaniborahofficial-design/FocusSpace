import { useLiveQuery } from 'dexie-react-hooks';
import { AlarmClock, Check, CheckCircle2, Circle, Flame, Inbox, Plus, Sparkles, Target, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { db } from '../db/db';
import { computeStreaks } from '../lib/analytics';
import { toggleHabitDay } from '../lib/habitActions';
import { useToday } from '../lib/hooks';
import { openTaskEditor } from '../lib/taskEditor';
import { deleteTask } from '../lib/tasks';
import { buildTodayPlan } from '../lib/todayPlan';
import { focusOnTask } from '../lib/timer';
import { formatDuration } from '../lib/utils';
import type { Task } from '../types';
import { Pomodoro } from './Pomodoro';
import { TaskCard } from './TaskCard';
import { EmptyState, Ring } from './ui';

const nowTime = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/** Home. Answers "what should I do today?" directly: a single suggestion, then overdue, due-today and done. */
export function Today({ onQuickAdd }: { onQuickAdd: () => void }) {
  const today = useToday();
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const habits = useLiveQuery(() => db.habits.filter(h => h.active).toArray(), []) ?? [];
  const cats = useLiveQuery(() => db.categories.toArray(), []) ?? [];

  const plan = useMemo(() => buildTodayPlan(tasks ?? [], today, nowTime()), [tasks, today]);
  const openCount = plan.overdue.length + plan.today.length;
  const habitsDone = habits.filter(h => h.completions.includes(today)).length;

  const update = (task: Task) => db.tasks.put(task);
  const card = (t: Task) => (
    <TaskCard key={t.id} task={t} category={cats.find(c => c.id === t.categoryId)} onUpdate={update} onDelete={() => void deleteTask(t)} onStart={() => focusOnTask(t)} />
  );

  return (
    <div className="p-5 lg:p-7 max-w-[1500px] mx-auto">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[.18em] text-fg-subtle mb-1">Today / Focus</div>
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Make today count.</h1>
            <p className="text-sm text-fg-muted mt-1">{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</p>
          </div>
          <div className="text-right shrink-0">
            {openCount + plan.done.length > 0 ? <div className="text-2xl font-semibold tabular-nums">{plan.done.length}<span className="text-fg-muted">/{openCount + plan.done.length}</span></div> : <div className="text-2xl font-semibold text-fg-subtle">-</div>}
            <div className="text-[10px] uppercase tracking-[.15em] text-fg-subtle">completed</div>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          {tasks !== undefined && plan.next && (
            <section className="rounded-2xl border border-line bg-surface shadow-card p-4 flex items-center gap-3">
              <span className="size-9 rounded-lg bg-accent text-accent-fg grid place-items-center shrink-0"><Sparkles size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[.15em] text-fg-muted">Do this next</div>
                <button onClick={() => openTaskEditor(plan.next!.task.id)} className="font-medium text-fg hover:underline underline-offset-2 truncate block text-left">{plan.next.task.title}</button>
                <div className="text-xs text-fg-muted mt-0.5">{plan.next.reason}</div>
              </div>
              <button onClick={() => focusOnTask(plan.next!.task)} className="shrink-0 h-8 px-3 rounded-xl bg-accent text-accent-fg text-sm font-medium">Focus</button>
            </section>
          )}

          <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
            <div className="p-4 border-b border-line flex justify-between items-center">
              <div className="font-medium flex items-center gap-2">Today's Focus Tasks</div>
              <span className="text-xs text-fg-subtle tabular-nums">{openCount ? `${formatDuration(plan.plannedMinutes)} planned` : `${plan.done.length} done`}</span>
            </div>
            <div className="p-3 space-y-4">
              {tasks === undefined ? (
                <div className="space-y-2" aria-busy="true"><div className="skeleton h-[74px]" /><div className="skeleton h-[74px]" /></div>
              ) : openCount === 0 && plan.done.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Nothing on the books today"
                  text="Enjoy the breathing room, or pull something forward."
                  action={<button onClick={onQuickAdd} className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-sm font-medium flex items-center gap-1.5"><Plus size={15} /> Add a task</button>}
                />
              ) : (
                <>
                  {plan.overdue.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-rose-500 mb-2"><AlarmClock size={13} /> Overdue · {plan.overdue.length}</div>
                      <div className="space-y-2">{plan.overdue.map(card)}</div>
                    </div>
                  )}
                  {plan.today.length > 0 && (
                    <div>
                      {plan.overdue.length > 0 && <div className="text-xs font-medium text-fg-muted mb-2 mt-1">Due today</div>}
                      <div className="space-y-2">{plan.today.map(card)}</div>
                    </div>
                  )}
                  {plan.done.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-fg-subtle mb-2 mt-1"><CheckCircle2 size={13} /> Done today · {plan.done.length}</div>
                      <div className="space-y-2">{plan.done.map(card)}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {plan.upcoming.length > 0 && (
            <section className="rounded-2xl border border-line bg-surface shadow-card overflow-hidden">
              <div className="p-4 border-b border-line font-medium text-sm text-fg-muted">Coming up</div>
              <div className="p-3 space-y-2">{plan.upcoming.map(card)}</div>
            </section>
          )}

          <section className="rounded-2xl border border-line bg-surface shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 font-medium"><Target size={16} /> Daily habits</div>
              {habits.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-fg-muted">
                  <span className="tabular-nums">{habitsDone} of {habits.length}</span>
                  <Ring value={habitsDone / habits.length} size={24} stroke={3} />
                </div>
              )}
            </div>
            {habits.length === 0 ? (
              <EmptyState compact icon={Target} title="No active habits yet" text="Add a habit from Settings to see one-tap check-ins here." />
            ) : (
              <div className="grid sm:grid-cols-3 gap-3">
                {habits.map(h => {
                  const done = h.completions.includes(today);
                  const streak = computeStreaks(h.completions, today).current;
                  return (
                    <button
                      key={h.id}
                      onClick={() => void toggleHabitDay(h.id, today)}
                      aria-pressed={done}
                      className={`text-left p-4 rounded-xl border transition ${done ? 'border-line-strong bg-surface-2' : 'border-line bg-surface/40 hover:bg-hover'}`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="size-9 rounded-lg grid place-items-center" style={{ background: `${h.color}18`, color: h.color }}>{done ? <Check size={17} /> : <Circle size={17} />}</span>
                        {streak > 0 && (
                          <span className="flex items-center gap-1 text-xs text-fg-muted tabular-nums" title={`${streak}-day streak`}><Flame size={13} />{streak}</span>
                        )}
                      </div>
                      <div className="mt-3 text-sm text-fg-soft">{h.name}</div>
                      <div className="text-xs text-fg-subtle mt-1">{h.targetLabel}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
        <Pomodoro />
      </div>
    </div>
  );
}


function GoalsSection() {
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? [];
  if (goals.length === 0) return null;
  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card p-5">
      <div className="flex items-center gap-2 font-medium mb-4"><Target size={16} /> Active Goals</div>
      <div className="space-y-4">
        {goals.map(g => {
          const pct = Math.min(100, Math.max(0, (g.currentValue / g.targetValue) * 100));
          return (
            <div key={g.id}>
              <div className="flex justify-between items-end mb-1.5">
                <span className="text-sm font-medium text-fg">{g.title}</span>
                <span className="text-xs text-fg-muted tabular-nums">{g.currentValue} / {g.targetValue} {g.metricLabel}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--ring-track)] overflow-hidden">
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
