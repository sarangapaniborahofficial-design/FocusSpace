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
        <div className="text-xs uppercase tracking-[.18em] text-zinc-300 mb-1">Today / Focus</div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Make today count.</h1>
            <p className="text-sm text-zinc-400 mt-1">{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-semibold tabular-nums">{plan.done.length}<span className="text-zinc-200">/{openCount + plan.done.length}</span></div>
            <div className="text-[10px] uppercase tracking-[.15em] text-zinc-300">completed</div>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          {tasks !== undefined && plan.next && (
            <section className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 flex items-center gap-3">
              <span className="size-9 rounded-lg bg-[var(--accent)] text-[#121214] grid place-items-center shrink-0"><Sparkles size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[.15em] text-zinc-400">Do this next</div>
                <button onClick={() => openTaskEditor(plan.next!.task.id)} className="font-medium text-zinc-900 hover:underline underline-offset-2 truncate block text-left">{plan.next.task.title}</button>
                <div className="text-xs text-zinc-400 mt-0.5">{plan.next.reason}</div>
              </div>
              <button onClick={() => focusOnTask(plan.next!.task)} className="shrink-0 h-8 px-3 rounded-md bg-[var(--accent)] text-[#121214] text-sm font-medium">Focus</button>
            </section>
          )}

          <section className="rounded-2xl border border-zinc-100 bg-zinc-50/40 overflow-hidden">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center">
              <div className="font-medium flex items-center gap-2"><Zap size={16} /> Today's queue</div>
              <span className="text-xs text-zinc-300 tabular-nums">{openCount ? `${formatDuration(plan.plannedMinutes)} planned` : `${plan.done.length} done`}</span>
            </div>
            <div className="p-3 space-y-4">
              {tasks === undefined ? (
                <div className="space-y-2" aria-busy="true"><div className="skeleton h-[74px]" /><div className="skeleton h-[74px]" /></div>
              ) : openCount === 0 && plan.done.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Nothing on the books today"
                  text="Enjoy the breathing room, or pull something forward."
                  action={<button onClick={onQuickAdd} className="h-8 px-3 rounded-md bg-[var(--accent)] text-[#121214] text-sm font-medium flex items-center gap-1.5"><Plus size={15} /> Add a task</button>}
                />
              ) : (
                <>
                  {plan.overdue.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 mb-2"><AlarmClock size={13} /> Overdue · {plan.overdue.length}</div>
                      <div className="space-y-2">{plan.overdue.map(card)}</div>
                    </div>
                  )}
                  {plan.today.length > 0 && (
                    <div>
                      {plan.overdue.length > 0 && <div className="text-xs font-medium text-zinc-400 mb-2 mt-1">Due today</div>}
                      <div className="space-y-2">{plan.today.map(card)}</div>
                    </div>
                  )}
                  {plan.done.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 mb-2 mt-1"><CheckCircle2 size={13} /> Done today · {plan.done.length}</div>
                      <div className="space-y-2">{plan.done.map(card)}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {plan.upcoming.length > 0 && (
            <section className="rounded-2xl border border-zinc-100 bg-zinc-50/40 overflow-hidden">
              <div className="p-4 border-b border-zinc-100 font-medium text-sm text-zinc-500">Coming up</div>
              <div className="p-3 space-y-2">{plan.upcoming.map(card)}</div>
            </section>
          )}

          <section className="rounded-2xl border border-zinc-100 bg-zinc-50/40 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 font-medium"><Target size={16} /> Daily habits</div>
              {habits.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-zinc-400">
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
                      className={`text-left p-4 rounded-xl border transition ${done ? 'border-zinc-300 bg-zinc-100/70' : 'border-zinc-100 bg-white/40 hover:bg-zinc-50'}`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="size-9 rounded-lg grid place-items-center" style={{ background: `${h.color}18`, color: h.color }}>{done ? <Check size={17} /> : <Circle size={17} />}</span>
                        {streak > 0 && (
                          <span className="flex items-center gap-1 text-xs text-zinc-500 tabular-nums" title={`${streak}-day streak`}><Flame size={13} />{streak}</span>
                        )}
                      </div>
                      <div className="mt-3 text-sm text-zinc-700">{h.name}</div>
                      <div className="text-xs text-zinc-300 mt-1">{h.targetLabel}</div>
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
