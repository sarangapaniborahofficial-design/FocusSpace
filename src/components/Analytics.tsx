import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, type ReactNode } from 'react';
import { BarChart3, Clock3, Flame, Target } from 'lucide-react';
import { db } from '../db/db';
import {
  RANGE_OPTIONS, habitStats, computeAnalytics, weekProgress,
  type Analytics as AnalyticsData, type RangeId,
} from '../lib/analytics';
import { cleanGoals, loadGoals, saveGoals, type Goals } from '../lib/goals';
import { useToday } from '../lib/hooks';
import { dateLabel, formatDuration, storage } from '../lib/utils';
import { EmptyState } from './ui';

const RANGE_KEY = 'focusspace-analytics-range';
const readRange = (): RangeId => {
  const saved = storage.get(RANGE_KEY);
  return RANGE_OPTIONS.some(o => o.id === saved) ? (saved as RangeId) : '7d';
};

const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toString();
const card = 'rounded-2xl border border-zinc-100 bg-zinc-50/40';

export function Analytics() {
  const today = useToday();
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const habits = useLiveQuery(() => db.habits.toArray(), []);
  const logs = useLiveQuery(() => db.focusLogs.toArray(), []);

  const [range, setRangeState] = useState<RangeId>(readRange);
  const [categoryPick, setCategoryPick] = useState('all');
  const [goals, setGoals] = useState<Goals>(loadGoals);
  const [editingGoals, setEditingGoals] = useState(false);

  // If the selected category was deleted, quietly fall back to "all".
  const categoryId = categoryPick === 'all' || categories?.some(c => c.id === categoryPick) ? categoryPick : 'all';
  const setRange = (id: RangeId) => { setRangeState(id); storage.set(RANGE_KEY, id); };

  const data = useMemo(
    () => (tasks && categories && logs ? computeAnalytics({ tasks, categories, logs, range, categoryId, today }) : null),
    [tasks, categories, logs, range, categoryId, today],
  );
  const habitRows = useMemo(() => (habits ? habitStats(habits, today) : []), [habits, today]);
  const week = useMemo(() => (tasks && logs && habits ? weekProgress(tasks, logs, habits, today) : null), [tasks, logs, habits, today]);

  const rangeInfo = RANGE_OPTIONS.find(o => o.id === range)!;
  const perUnit = data ? (rangeInfo.unit === 'week' ? data.completed / (data.lengthDays / 7) : data.completed / data.lengthDays) : 0;
  const focusPerUnit = data ? (rangeInfo.unit === 'week' ? data.focusMin / (data.lengthDays / 7) : data.focusMin / data.lengthDays) : 0;
  const bestStreak = habitRows.reduce<(typeof habitRows)[number] | null>((best, row) => (!best || row.current > best.current ? row : best), null);

  return (
    <div className="p-5 lg:p-7 max-w-[1200px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[.18em] text-zinc-600 mb-1">Insights</div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-zinc-500 mt-1">What you finished and how long you focused, across every workspace.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 rounded-lg border border-zinc-100 overflow-hidden" role="group" aria-label="Time range">
            {RANGE_OPTIONS.map(o => (
              <button key={o.id} onClick={() => setRange(o.id)} aria-pressed={range === o.id} className={`px-3 text-sm transition-colors ${range === o.id ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)]' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-900 dark:hover:text-zinc-200'}`}>{o.label}</button>
            ))}
          </div>
          <select value={categoryId} onChange={e => setCategoryPick(e.target.value)} aria-label="Category" className="h-9 rounded-lg bg-zinc-50 border border-zinc-100 px-3 text-sm text-zinc-500 outline-none">
            <option value="all">All categories</option>
            {(categories ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </header>

      {!data || !week ? <AnalyticsSkeleton /> : (
        <div key={`${range}-${categoryId}`} className="space-y-4">
          {/* Summary */}
          <section className={`${card} grid grid-cols-2 lg:grid-cols-4`} aria-label="Summary">
            <Stat className="border-b border-r lg:border-b-0" label="Tasks completed" value={String(data.completed)} sub={<Delta now={data.completed} prev={data.prevCompleted} unit={rangeInfo.label} />} />
            <Stat className="border-b lg:border-b-0 lg:border-r" label="Focus time" value={formatDuration(data.focusMin)} sub={<Delta now={data.focusMin} prev={data.prevFocusMin} unit={rangeInfo.label} />} />
            <Stat
              className="border-r"
              label="On-time completion"
              value={data.dueTotal ? `${Math.round((data.dueDone / data.dueTotal) * 100)}%` : '–'}
              sub={data.dueTotal ? <>{data.dueDone} of {data.dueTotal} due tasks{data.overdue > 0 && <span className="text-zinc-300"> · {data.overdue} overdue</span>}</> : <>No tasks were due{data.overdue > 0 && <span className="text-zinc-300"> · {data.overdue} overdue</span>}</>}
            />
            <Stat
              label="Habit streak"
              value={bestStreak ? `${bestStreak.current} ${bestStreak.current === 1 ? 'day' : 'days'}` : '–'}
              sub={bestStreak ? (bestStreak.current > 0 ? bestStreak.habit.name : 'Check off a habit to start one') : 'No active habits'}
            />
          </section>

          <div className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-4">
            {/* Completion velocity */}
            <section className={`${card} p-5`} aria-labelledby="velocity-title">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 id="velocity-title" className="font-medium">Completion velocity</h2>
                  <p className="text-xs text-zinc-600 mt-1">Tasks finished per {rangeInfo.unit}, coloured by category.</p>
                </div>
                <Legend items={data.seriesCategories} />
              </div>
              <BarChart
                title="Tasks completed"
                data={data.buckets.map(b => ({
                  key: b.bucket.key, label: b.bucket.label, detail: b.bucket.long, total: b.completed,
                  parts: data.seriesCategories.map(c => ({ id: c.id, value: b.byCategory[c.id] ?? 0 })).filter(p => p.value > 0),
                }))}
                colors={Object.fromEntries(data.seriesCategories.map(c => [c.id, c.color]))}
                formatValue={n => `${n} ${n === 1 ? 'task' : 'tasks'}`}
                formatAxis={n => String(n)}
                caption={`${data.completed} completed · ${oneDecimal(perUnit)} per ${rangeInfo.unit}`}
                emptyText="Nothing completed in this range yet. Finished tasks show up here."
                labelEvery={range === '30d' ? 5 : range === '12w' ? 2 : 1}
              />
            </section>

            {/* Weekly goals */}
            <section className={`${card} p-5`} aria-labelledby="goals-title">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 id="goals-title" className="font-medium flex items-center gap-2"><Target size={15} /> This week</h2>
                  <p className="text-xs text-zinc-600 mt-1">
                    Week of {dateLabel(week.start)} · {week.daysLeft === 0 ? 'last day' : `${week.daysLeft} ${week.daysLeft === 1 ? 'day' : 'days'} left`}
                  </p>
                </div>
                <button onClick={() => setEditingGoals(v => !v)} className="text-xs text-zinc-500 hover:text-zinc-200 px-2 py-1 rounded-md hover:bg-zinc-100">{editingGoals ? 'Done' : 'Edit goals'}</button>
              </div>
              {editingGoals && (
                <div className="pop-in grid grid-cols-2 gap-2 mb-4 rounded-xl border border-zinc-100 bg-zinc-50/60 p-3">
                  <GoalInput label="Tasks per week" value={goals.tasks} max={200} onChange={v => { const next = cleanGoals({ ...goals, tasks: v }); setGoals(next); saveGoals(next); }} />
                  <GoalInput label="Focus hours per week" value={goals.focusHours} max={100} onChange={v => { const next = cleanGoals({ ...goals, focusHours: v }); setGoals(next); saveGoals(next); }} />
                </div>
              )}
              <div className="space-y-5">
                <GoalRow label="Tasks completed" value={week.tasksDone} target={goals.tasks} text={`${week.tasksDone} / ${goals.tasks}`} />
                <GoalRow label="Focus time" value={week.focusMin} target={goals.focusHours * 60} text={`${formatDuration(week.focusMin)} / ${goals.focusHours}h`} />
                <GoalRow label="Habit check-ins" value={week.checkins} target={week.habitTarget} text={week.habitTarget ? `${week.checkins} / ${week.habitTarget}` : 'No active habits'} />
              </div>
              <p className="text-[11px] text-zinc-600 mt-5">Goals cover the whole workspace and ignore the category filter.</p>
            </section>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Focus time */}
            <section className={`${card} p-5`} aria-labelledby="focus-title">
              <div className="mb-4">
                <h2 id="focus-title" className="font-medium flex items-center gap-2"><Clock3 size={15} /> Focus time</h2>
                <p className="text-xs text-zinc-600 mt-1">Minutes logged by the Pomodoro timer per {rangeInfo.unit}.</p>
              </div>
              <BarChart
                title="Focus time"
                data={data.buckets.map(b => ({ key: b.bucket.key, label: b.bucket.label, detail: b.bucket.long, total: b.focusMin, parts: b.focusMin > 0 ? [{ id: 'focus', value: b.focusMin }] : [] }))}
                colors={{ focus: 'var(--accent)' }}
                formatValue={formatDuration}
                formatAxis={formatDuration}
                caption={`${formatDuration(data.focusMin)} total · ${formatDuration(focusPerUnit)} per ${rangeInfo.unit}`}
                emptyText="No focus sessions in this range. Start the timer on any task to log time here."
                labelEvery={range === '30d' ? 5 : range === '12w' ? 2 : 1}
              />
            </section>

            {/* Category breakdown */}
            <section className={`${card} p-5`} aria-labelledby="categories-title">
              <div className="mb-4">
                <h2 id="categories-title" className="font-medium">Where the time goes</h2>
                <p className="text-xs text-zinc-600 mt-1">{data.focusMin > 0 ? 'Bars compare focus time by category.' : 'Bars compare completed tasks by category.'}</p>
              </div>
              <CategoryBars data={data} />
            </section>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Estimate vs actual */}
            <section className={`${card} p-5`} aria-labelledby="estimate-title">
              <div className="mb-4">
                <h2 id="estimate-title" className="font-medium">Estimated vs actual</h2>
                <p className="text-xs text-zinc-600 mt-1">Tasks you focused on in this range. The tick marks your estimate.</p>
              </div>
              {data.taskRows.length === 0 ? (
                <EmptyState compact icon={Clock3} title="No task time yet" text="Use Focus on a task, then run the timer to compare time spent with your estimate." />
              ) : (
                <ul className="space-y-4">
                  {data.taskRows.map((row, i) => {
                    const estimate = row.task.estimatedDuration || 0;
                    const scale = Math.max(row.totalMin, estimate, 1);
                    const over = estimate > 0 && row.totalMin > estimate;
                    return (
                      <li key={row.task.id}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="size-2 rounded-full shrink-0" style={{ background: row.category?.color ?? '#71717a' }} />
                            <span className="truncate text-zinc-200">{row.task.title}</span>
                          </span>
                          <span className={`shrink-0 text-xs tabular-nums ${over ? 'text-amber-300' : 'text-zinc-500'}`}>{formatDuration(row.totalMin)} / {formatDuration(estimate)}</span>
                        </div>
                        <div className="relative mt-2 h-1.5 rounded-full" style={{ background: 'var(--ring-track)' }}>
                          <div className="bar-x h-full rounded-full" style={{ width: `${(row.totalMin / scale) * 100}%`, background: over ? '#fbbf24' : 'var(--accent)', animationDelay: `${i * 40}ms` }} />
                          {estimate > 0 && <div className="absolute -top-0.5 h-2.5 w-0.5 rounded-full" style={{ left: `calc(${(estimate / scale) * 100}% - 1px)`, background: 'var(--ink-3)' }} />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Habits */}
            <section className={`${card} p-5`} aria-labelledby="habits-title">
              <div className="mb-4">
                <h2 id="habits-title" className="font-medium flex items-center gap-2"><Flame size={15} /> Habits</h2>
                <p className="text-xs text-zinc-600 mt-1">Last 14 days across all categories. Streaks survive until a day is missed.</p>
              </div>
              {habitRows.length === 0 ? (
                <EmptyState compact icon={Flame} title="No active habits" text="Active habits appear here with their streaks." />
              ) : (
                <ul className="space-y-4">
                  {habitRows.map(row => (
                    <li key={row.habit.id} className="flex items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="size-2 rounded-full shrink-0" style={{ background: row.habit.color }} />
                          <span className="truncate text-zinc-200">{row.habit.name}</span>
                        </div>
                        <div className="text-[11px] text-zinc-600 mt-1 tabular-nums">
                          {row.current} {row.current === 1 ? 'day' : 'days'} streak · best {row.best} · {Math.round(row.rate30 * 100)}% of last 30 days
                        </div>
                      </div>
                      <div className="flex gap-[3px] shrink-0" aria-label={`${row.last14.filter(Boolean).length} of the last 14 days completed`} role="img">
                        {row.last14.map((on, i) => (
                          <span key={i} className="size-2.5 rounded-[3px]" style={on ? { background: row.habit.color } : { background: 'var(--ring-track)' }} />
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {!data.hasActivity && (
            <div className={card}>
              <EmptyState icon={BarChart3} title="Your charts will fill in as you work" text="Complete a task or run a focus session and it shows up here right away. Everything is calculated on this device." />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- pieces ---------- */

function Stat({ label, value, sub, className = '' }: { label: string; value: string; sub: ReactNode; className?: string }) {
  return (
    <div className={`p-5 border-zinc-100 min-w-0 ${className}`}>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-2xl font-semibold tracking-tight mt-1.5 tabular-nums">{value}</div>
      <div className="text-xs text-zinc-600 mt-1.5">{sub}</div>
    </div>
  );
}

function Delta({ now, prev, unit }: { now: number; prev: number; unit: string }) {
  if (prev === 0 && now === 0) return <>Nothing yet</>;
  if (prev === 0) return <>None in the previous {unit}</>;
  const pct = Math.round(((now - prev) / prev) * 100);
  if (pct === 0) return <>Same as the previous {unit}</>;
  return <>{pct > 0 ? '↑' : '↓'} {Math.abs(pct)}% vs previous {unit}</>;
}

function Legend({ items }: { items: { id: string; name: string; color: string }[] }) {
  if (!items.length) return null;
  return (
    <ul className="flex flex-wrap justify-end gap-x-3 gap-y-1 max-w-[50%]">
      {items.map(item => (
        <li key={item.id} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span className="size-2 rounded-full" style={{ background: item.color }} />{item.name}
        </li>
      ))}
    </ul>
  );
}

function GoalRow({ label, value, target, text }: { label: string; value: number; target: number; text: string }) {
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const met = target > 0 && value >= target;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-zinc-300">{label}</span>
        <span className={`text-xs tabular-nums ${met ? 'text-zinc-200' : 'text-zinc-500'}`}>{text}{met && ' ✓'}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ring-track)' }} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
        <div className="bar-x h-full rounded-full" style={{ width: `${pct * 100}%`, background: 'var(--accent)' }} />
      </div>
    </div>
  );
}

function GoalInput({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="text-xs text-zinc-500">
      {label}
      <input type="number" min={1} max={max} value={value} onChange={e => onChange(Number(e.target.value))} className="mt-1 w-full h-9 rounded-lg bg-zinc-50 border border-zinc-100 px-2 text-sm outline-none" />
    </label>
  );
}

function CategoryBars({ data }: { data: AnalyticsData }) {
  const useFocus = data.focusMin > 0;
  const rows = data.categoryRows;
  if (rows.length === 0) return <EmptyState compact icon={BarChart3} title="No activity yet" text="Finish a task or log focus time to see how your effort splits across categories." />;
  const max = Math.max(1, ...rows.map(r => (useFocus ? r.focusMin : r.completed)));
  return (
    <ul className="space-y-4">
      {rows.map((row, i) => {
        const value = useFocus ? row.focusMin : row.completed;
        return (
          <li key={row.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 min-w-0"><span className="size-2 rounded-full shrink-0" style={{ background: row.color }} /><span className="truncate text-zinc-200">{row.name}</span></span>
              <span className="shrink-0 text-xs text-zinc-500 tabular-nums">
                {[useFocus && row.focusMin > 0 ? formatDuration(row.focusMin) : '', row.completed > 0 || !useFocus ? `${row.completed} done` : ''].filter(Boolean).join(' · ')}
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ring-track)' }}>
              <div className="bar-x h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: row.color, animationDelay: `${i * 40}ms` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const niceCeil = (v: number) => {
  if (v <= 1) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return ([1, 1.5, 2, 3, 4, 5, 6, 8, 10].find(s => n <= s) ?? 10) * p;
};

interface ChartDatum { key: string; label: string; detail: string; total: number; parts: { id: string; value: number }[]; }

/** Stacked column chart made of plain divs: crisp text, fluid width, no chart library. */
function BarChart({ data, colors, formatValue, formatAxis, caption, emptyText, labelEvery, title }: {
  data: ChartDatum[];
  colors: Record<string, string>;
  formatValue: (n: number) => string;
  formatAxis: (n: number) => string;
  caption: string;
  emptyText: string;
  labelEvery: number;
  title: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceCeil(Math.max(0, ...data.map(d => d.total)));
  const empty = data.every(d => d.total === 0);
  const hovered = hover !== null ? data[hover] : null;
  const gap = 'gap-[3px] sm:gap-1';

  return (
    <div>
      <div className="h-5 text-xs text-zinc-500 mb-3 tabular-nums" aria-hidden="true">
        {hovered ? <><span className="text-zinc-300">{hovered.detail}</span> · {formatValue(hovered.total)}</> : caption}
      </div>

      <div className="flex gap-2">
        <div className="w-10 shrink-0 h-44 relative text-[10px] text-zinc-600 text-right tabular-nums" aria-hidden="true">
          <span className="absolute right-0 top-0 -translate-y-1/2">{formatAxis(max)}</span>
          <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative h-44" onMouseLeave={() => setHover(null)}>
            <div className="absolute inset-x-0 top-0 border-t" style={{ borderColor: 'var(--grid)' }} />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed" style={{ borderColor: 'var(--grid)' }} />
            <div className="absolute inset-x-0 bottom-0 border-t" style={{ borderColor: 'var(--grid)' }} />
            <div className={`absolute inset-0 flex items-end ${gap}`} aria-hidden="true">
              {data.map((d, i) => (
                <div key={d.key} className="flex-1 h-full flex items-end cursor-default" onMouseEnter={() => setHover(i)} onClick={() => setHover(h => (h === i ? null : i))}>
                  {d.total > 0 && (
                    <div
                      className="bar-y w-full flex flex-col-reverse overflow-hidden rounded-t-[3px]"
                      style={{ height: `${(d.total / max) * 100}%`, minHeight: 3, opacity: hover === null || hover === i ? 1 : 0.35, transition: 'opacity .12s', animationDelay: `${i * 14}ms` }}
                    >
                      {d.parts.map(p => <div key={p.id} style={{ flex: `${p.value} 0 0`, background: colors[p.id] ?? 'var(--accent)' }} />)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {empty && (
              <div className="absolute inset-0 grid place-items-center px-6 text-center text-xs text-zinc-600 pointer-events-none">{emptyText}</div>
            )}
          </div>
          <div className={`flex ${gap} mt-2 h-4`} aria-hidden="true">
            {data.map((d, i) => (
              <div key={d.key} className="flex-1 relative">
                {(data.length - 1 - i) % labelEvery === 0 && (
                  <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-zinc-600">{d.label}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <thead><tr><th>Period</th><th>Value</th></tr></thead>
        <tbody>{data.map(d => <tr key={d.key}><th>{d.detail}</th><td>{formatValue(d.total)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading analytics">
      <div className="skeleton h-28" />
      <div className="grid lg:grid-cols-[1.7fr_1fr] gap-4"><div className="skeleton h-72" /><div className="skeleton h-72" /></div>
      <div className="grid lg:grid-cols-2 gap-4"><div className="skeleton h-72" /><div className="skeleton h-72" /></div>
    </div>
  );
}
