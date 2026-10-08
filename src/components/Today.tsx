import { useLiveQuery } from 'dexie-react-hooks';
import { MoreHorizontal, Plus, Target, CheckCircle2 } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { db } from '../db/db';
import { useToday } from '../lib/hooks';
import { buildTodayPlan } from '../lib/todayPlan';
import { focusOnTask } from '../lib/timer';
import { Pomodoro } from './Pomodoro';
import { TaskCard } from './TaskCard';
import { EmptyState } from './ui';

export function Today({ onQuickAdd }: { onQuickAdd: () => void }) {
  const today = useToday();
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const plan = useMemo(() => buildTodayPlan(tasks ?? [], today, "12:00"), [tasks, today]);
  
  const allToday = [...plan.overdue, ...plan.today, ...plan.done];

  const card = "rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-[var(--card-bg)] shadow-sm";

  return (
    <div className="max-w-5xl mx-auto py-2 h-full">
      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-6">
          
          {/* Today's Focus Tasks */}
          <section className={`${card} overflow-hidden`}>
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/60 flex justify-between items-center bg-white dark:bg-zinc-900/50">
              <h2 className="font-semibold text-lg">Today's Focus Tasks</h2>
              <button onClick={onQuickAdd} className="h-8 px-3 rounded-lg bg-[var(--accent)] text-zinc-900 text-sm font-medium hover:opacity-90">Add Task</button>
            </div>
            <div className="p-4 space-y-1">
              {allToday.length > 0 ? (
                allToday.map(t => <TaskCard key={t.id} task={t} onUpdate={u => db.tasks.put(u)} onDelete={() => db.tasks.delete(t.id)} onStart={() => focusOnTask(t)} />)
              ) : (
                <EmptyState icon={CheckCircle2} title="All clear" text="No tasks scheduled for today." />
              )}
            </div>
            {allToday.length > 0 && (
              <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800/60 flex justify-between items-center bg-white dark:bg-zinc-900/50">
                <button onClick={onQuickAdd} className="h-8 px-4 rounded-lg bg-[var(--accent)]/30 text-[var(--text-primary)] dark:text-zinc-100 text-sm font-medium">Add Task</button>
                <button className="h-8 px-4 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300">Reset</button>
              </div>
            )}
          </section>

          {/* Quick Notes */}
          <QuickNotes card={card} />
          
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-6">
          
          <Pomodoro />

          {/* Weekly Performance */}
          <WeeklyPerformance card={card} />

          {/* Productivity Trend */}
          <ProductivityTrend card={card} />

        </div>
      </div>
    </div>
  );
}

function QuickNotes({ card }: { card: string }) {
  const [notes, setNotes] = useState(() => localStorage.getItem('focus-quick-notes') || '');
  
  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem('focus-quick-notes', notes), 500);
    return () => clearTimeout(t);
  }, [notes]);

  return (
    <section className={`${card} overflow-hidden flex flex-col h-[280px]`}>
      <div className="px-5 py-4 flex justify-between items-center bg-white dark:bg-zinc-900/50">
        <h2 className="font-semibold text-lg">Quick Notes</h2>
        <button className="text-zinc-400 hover:text-zinc-600"><MoreHorizontal size={18} /></button>
      </div>
      <div className="px-5 pb-5 flex-1 flex flex-col">
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">Capture ideas while you work — click to edit.</p>
        <textarea 
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="- Follow up on client meeting\n- Draft outline for blog post\n- Review design feedback"
          className="w-full flex-1 resize-none bg-transparent outline-none text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-300 dark:placeholder-zinc-600 leading-relaxed"
        />
      </div>
    </section>
  );
}

function WeeklyPerformance({ card }: { card: string }) {
  return (
    <section className={`${card} p-5 bg-white dark:bg-zinc-900/50`}>
      <div className="flex gap-4">
        {/* Left side (Chart) */}
        <div className="flex-1">
          <h2 className="font-semibold text-lg mb-1">Weekly Performance</h2>
          <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Focus Hours: <span className="font-medium text-zinc-700 dark:text-zinc-300">5.8h</span></div>
          
          {/* Mock Area Chart */}
          <div className="relative h-24 w-full mt-4">
            <div className="absolute inset-0 flex justify-between items-end text-[10px] text-zinc-400 font-medium">
              <span>Tue</span><span>Wed</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>
            <div className="absolute top-0 left-0 w-full h-[calc(100%-16px)]">
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d="M0,25 L25,35 L50,15 L75,20 L100,28 L100,40 L0,40 Z" fill="url(#grad)" />
                <path d="M0,25 L25,35 L50,15 L75,20 L100,28" fill="none" stroke="var(--accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                
                {/* Data points */}
                <g className="text-[9px] fill-zinc-600 dark:fill-zinc-300 font-medium" transform="translate(0, -6)">
                  <text x="0" y="25" textAnchor="middle">5.8h</text>
                  <text x="25" y="35" textAnchor="middle">5.8h</text>
                  <text x="50" y="15" textAnchor="middle">6.2h</text>
                  <text x="75" y="20" textAnchor="middle">6.2h</text>
                  <text x="100" y="28" textAnchor="middle">5.2h</text>
                </g>
              </svg>
            </div>
          </div>
        </div>
        
        {/* Right side (Stats) */}
        <div className="w-32 flex flex-col gap-3 shrink-0">
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800">
            <div className="text-xs text-zinc-500 font-medium mb-1">Deep Work</div>
            <div className="text-xl font-bold">3.5h</div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-zinc-100 dark:border-zinc-800">
            <div className="text-xs text-zinc-500 font-medium mb-1">Tasks Completed</div>
            <div className="text-xl font-bold flex items-baseline gap-1">18<span className="text-sm text-zinc-400 font-medium">/24</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductivityTrend({ card }: { card: string }) {
  return (
    <section className={`${card} p-5 bg-white dark:bg-zinc-900/50`}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-semibold text-lg">Productivity Trend</h2>
        <button className="text-zinc-400 hover:text-zinc-600"><MoreHorizontal size={18} /></button>
      </div>
      
      <div className="relative h-32 w-full flex">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between text-[10px] text-zinc-400 font-medium pr-3 h-[calc(100%-16px)]">
          <span>150</span>
          <span>100</span>
          <span>50</span>
        </div>
        
        {/* Chart area */}
        <div className="flex-1 relative h-full">
           {/* Grid lines */}
           <div className="absolute inset-0 flex flex-col justify-between h-[calc(100%-16px)]">
             <div className="w-full border-t border-zinc-100 dark:border-zinc-800"></div>
             <div className="w-full border-t border-zinc-100 dark:border-zinc-800"></div>
             <div className="w-full border-t border-zinc-100 dark:border-zinc-800"></div>
           </div>
           
           <div className="absolute inset-0 h-[calc(100%-16px)]">
             <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d="M0,35 L15,25 L30,40 L45,15 L60,35 L75,10 L90,20 L100,5 L100,40 L0,40 Z" fill="url(#trendGrad)" />
                <path d="M0,35 L15,25 L30,40 L45,15 L60,35 L75,10 L90,20 L100,5" fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
             </svg>
           </div>
        </div>
      </div>
    </section>
  );
}
