import { useLiveQuery } from 'dexie-react-hooks';
import { Award, CheckCircle2, ChevronRight, Clock3, Copy, Flame, FolderKanban, Plus, Sparkles, Target, Trophy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../db/db';
import { useToday } from '../lib/hooks';
import {
  computeReviewData,
  exportReviewMarkdown,
  loadReviewReflection,
  saveReviewReflection,
  type ReviewPeriod,
  type ReviewReflection,
} from '../lib/review';
import { toast } from '../lib/toast';
import { formatDuration, priorityTone } from '../lib/utils';
import { EmptyState } from './ui';
import { useDictation } from '../voice/useDictation';
import { createInputTarget } from '../voice/target/inputTarget';
import type { DictationTarget } from '../voice/target/DictationTarget';
import { MicButton } from '../voice/ui/MicButton';
import { DictationHud } from '../voice/ui/DictationHud';

const card = 'atelier-card rounded-3xl';

const PERIODS: { id: ReviewPeriod; label: string }[] = [
  { id: 'this-week', label: 'This Week' },
  { id: 'last-week', label: 'Last Week' },
  { id: 'this-month', label: 'This Month' },
  { id: 'last-month', label: 'Last Month' },
];

export function Review({ onQuickAdd }: { onNavigate?: (view: string) => void; onQuickAdd?: () => void }) {
  const today = useToday();
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const habits = useLiveQuery(() => db.habits.toArray(), []) ?? [];
  const logs = useLiveQuery(() => db.focusLogs.toArray(), []) ?? [];

  const [period, setPeriod] = useState<ReviewPeriod>('this-week');
  const [copied, setCopied] = useState(false);

  // Compute stats for current period
  const reviewData = useMemo(() => {
    return computeReviewData({
      tasks,
      categories,
      logs,
      habits,
      period,
      today,
    });
  }, [tasks, categories, logs, habits, period, today]);

  // Load reflection for current period key
  const [reflection, setReflection] = useState<ReviewReflection>(() =>
    loadReviewReflection(reviewData.periodInfo.storageKey)
  );

  // When period changes, load the reflection for that specific period
  useEffect(() => {
    setReflection(loadReviewReflection(reviewData.periodInfo.storageKey));
  }, [reviewData.periodInfo.storageKey]);

  // Save reflection debounce
  const updateReflection = (patch: Partial<ReviewReflection>) => {
    setReflection(prev => {
      const next = { ...prev, ...patch };
      saveReviewReflection(reviewData.periodInfo.storageKey, next);
      return next;
    });
  };

  type ReviewField = 'wins' | 'challenges' | 'improvements' | 'priority1' | 'priority2' | 'priority3';
  const [activeVoiceField, setActiveVoiceField] = useState<ReviewField | null>(null);
  const [dictationTarget, setDictationTarget] = useState<DictationTarget | null>(null);

  const winsRef = useRef<HTMLTextAreaElement>(null);
  const challengesRef = useRef<HTMLTextAreaElement>(null);
  const improvementsRef = useRef<HTMLTextAreaElement>(null);
  const priority1Ref = useRef<HTMLInputElement>(null);
  const priority2Ref = useRef<HTMLInputElement>(null);
  const priority3Ref = useRef<HTMLInputElement>(null);

  const dictation = useDictation({
    target: dictationTarget,
  });

  const toggleVoice = (field: ReviewField) => {
    let el: HTMLInputElement | HTMLTextAreaElement | null = null;
    if (field === 'wins') el = winsRef.current;
    else if (field === 'challenges') el = challengesRef.current;
    else if (field === 'improvements') el = improvementsRef.current;
    else if (field === 'priority1') el = priority1Ref.current;
    else if (field === 'priority2') el = priority2Ref.current;
    else if (field === 'priority3') el = priority3Ref.current;

    if (!el) return;
    setActiveVoiceField(field);
    setDictationTarget(createInputTarget(el));
    dictation.toggle();
  };

  const copyMarkdown = async () => {
    try {
      const text = exportReviewMarkdown(reviewData, reflection);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast('Review summary copied to clipboard in Markdown format!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast('Failed to copy to clipboard', 'error');
    }
  };

  const momentumLabel =
    reviewData.tasksCompletedCount >= 10 || reviewData.focusMinutes >= 300
      ? 'High Momentum 🔥'
      : reviewData.tasksCompletedCount >= 4 || reviewData.focusMinutes >= 120
      ? 'Steady Progress 🌱'
      : 'Building Pace ⚡';

  return (
    <div className="p-5 lg:p-7 max-w-[1400px] mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="index-chip text-fg-subtle mb-1 flex items-center gap-1.5">
            <Trophy size={14} className="text-accent" /> Review & Reflection
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{reviewData.periodInfo.title}</h1>
          <p className="text-sm text-fg-muted mt-0.5">{reviewData.periodInfo.subtitle}</p>
        </div>

        {/* Timeframe Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-line bg-surface-2 p-1">
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                  period === p.id
                    ? 'bg-surface text-fg shadow-sm'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={copyMarkdown}
            className="h-8 px-3 rounded-xl border border-line bg-surface text-xs font-medium text-fg-soft hover:bg-hover flex items-center gap-1.5 shadow-sm"
            title="Copy as Markdown summary"
          >
            <Copy size={13} /> {copied ? 'Copied!' : 'Export Summary'}
          </button>

          {onQuickAdd && (
            <button
              onClick={onQuickAdd}
              className="h-8 px-3 rounded-xl bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover flex items-center gap-1.5 keycap"
            >
              <Plus size={13} /> New Task
            </button>
          )}
        </div>
      </div>

      {/* Hero Stats Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${card} p-5 flex flex-col justify-between`}>
          <div className="flex items-center justify-between text-xs font-medium text-fg-muted">
            <span>Tasks Finished</span>
            <span className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight">{reviewData.tasksCompletedCount}</div>
            <div className="text-xs text-fg-muted mt-1">
              {reviewData.highPriorityCount > 0 ? `${reviewData.highPriorityCount} high/urgent priority` : 'Great work shipping!'}
            </div>
          </div>
        </div>

        <div className={`${card} p-5 flex flex-col justify-between`}>
          <div className="flex items-center justify-between text-xs font-medium text-fg-muted">
            <span>Focus Time</span>
            <span className="size-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 grid place-items-center">
              <Clock3 size={16} />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight">{reviewData.focusHoursFormatted}</div>
            <div className="text-xs text-fg-muted mt-1">
              {reviewData.focusSessionsCount} sessions ({formatDuration(reviewData.avgDailyFocusMinutes)}/day)
            </div>
          </div>
        </div>

        <div className={`${card} p-5 flex flex-col justify-between`}>
          <div className="flex items-center justify-between text-xs font-medium text-fg-muted">
            <span>Habit Consistency</span>
            <span className="size-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 grid place-items-center">
              <Flame size={16} />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight">{reviewData.overallHabitScore}%</div>
            <div className="text-xs text-fg-muted mt-1">
              {reviewData.habitStats.length} active daily habit{reviewData.habitStats.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        <div className={`${card} p-5 flex flex-col justify-between`}>
          <div className="flex items-center justify-between text-xs font-medium text-fg-muted">
            <span>Momentum</span>
            <span className="size-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 grid place-items-center">
              <Sparkles size={16} />
            </span>
          </div>
          <div className="mt-4">
            <div className="text-xl font-bold tracking-tight text-fg">{momentumLabel}</div>
            <div className="text-xs text-fg-muted mt-1">
              {reviewData.createdInPeriodCount} tasks planned in period
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Section */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Accomplishments & Breakdown */}
        <div className="space-y-6">
          {/* Shipped & Completed Tasks */}
          <section className={`${card} overflow-hidden`}>
            <div className="p-5 border-b border-line flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-base flex items-center gap-2">
                  <Award size={17} className="text-accent" /> Completed Tasks
                </h2>
                <p className="text-xs text-fg-muted mt-0.5">Everything finished during {reviewData.periodInfo.title.toLowerCase()}.</p>
              </div>
              <span className="text-xs font-medium text-fg-muted bg-surface-2 px-2.5 py-1 rounded-full border border-line">
                {reviewData.tasksCompletedCount} tasks
              </span>
            </div>

            <div className="p-4 max-h-[360px] overflow-y-auto space-y-2">
              {reviewData.tasksCompleted.length === 0 ? (
                <EmptyState
                  compact
                  icon={CheckCircle2}
                  title="No completed tasks in this timeframe"
                  text="Check off tasks on your board or today's queue to see them celebrate here."
                />
              ) : (
                reviewData.tasksCompleted.map(t => {
                  const cat = categories.find(c => c.id === t.categoryId);
                  return (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl border border-line bg-surface-2 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <span className="size-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
                          <CheckCircle2 size={12} />
                        </span>
                        <span className="font-medium text-fg truncate">{t.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-xs">
                        {cat && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium"
                            style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                          >
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                            {cat.name}
                          </span>
                        )}
                        {t.priority && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${priorityTone(t.priority)}`}>
                            {t.priority}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Category Effort Distribution */}
          <section className={`${card} p-5`}>
            <div className="mb-4">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <FolderKanban size={17} className="text-accent" /> Category Effort Distribution
              </h2>
              <p className="text-xs text-fg-muted mt-0.5">Where your finished tasks and focus sessions went.</p>
            </div>

            {reviewData.categoryStats.length === 0 ? (
              <p className="text-xs text-fg-muted">No category data recorded for this period yet.</p>
            ) : (
              <div className="space-y-3">
                {reviewData.categoryStats.map(stat => (
                  <div key={stat.category.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ backgroundColor: stat.category.color }} />
                        {stat.category.name}
                      </span>
                      <span className="text-fg-muted">
                        {stat.completedCount} task{stat.completedCount === 1 ? '' : 's'}
                        {stat.focusMinutes > 0 ? ` · ${formatDuration(stat.focusMinutes)}` : ''} ({stat.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(4, stat.percentage)}%`,
                          backgroundColor: stat.category.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Habit Tracking Consistency */}
          <section className={`${card} p-5`}>
            <div className="mb-4">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <Flame size={17} className="text-amber-500" /> Habit Consistency
              </h2>
              <p className="text-xs text-fg-muted mt-0.5">Daily routines checked in during this review period.</p>
            </div>

            {reviewData.habitStats.length === 0 ? (
              <p className="text-xs text-fg-muted">No active habits configured yet.</p>
            ) : (
              <div className="space-y-3">
                {reviewData.habitStats.map(stat => (
                  <div key={stat.habit.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ backgroundColor: stat.habit.color }} />
                        {stat.habit.name}
                      </span>
                      <span className="text-fg-muted font-mono text-[11px]">
                        {stat.checkins}/{stat.expected} days ({stat.rate}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(4, stat.rate)}%`,
                          backgroundColor: stat.habit.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Guided Reflection Canvas */}
        <div className="space-y-6">
          <section className={`${card} p-6 space-y-5 border-accent/20 bg-surface/90`}>
            <div className="border-b border-line pb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-base flex items-center gap-2">
                  <Sparkles size={17} className="text-accent" /> Reflection & Future Intentions
                </h2>
                <p className="text-xs text-fg-muted mt-0.5">
                  Reflect on what worked, what caused friction, and set up your next priorities.
                </p>
              </div>
              <span className="text-[11px] text-fg-subtle">Auto-saved</span>
            </div>

            {/* Wins prompt */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-fg flex items-center gap-1.5">
                  <span>🌟 Wins & Breakthroughs</span>
                </label>
                <MicButton
                  size="sm"
                  state={activeVoiceField === 'wins' ? dictation.state : 'idle'}
                  onClick={() => toggleVoice('wins')}
                  title="Dictate wins"
                />
              </div>
              <textarea
                ref={winsRef}
                value={reflection.wins}
                onChange={e => updateReflection({ wins: e.target.value })}
                placeholder="What went exceptionally well? What did you ship or finish that felt great?"
                rows={3}
                className="w-full rounded-xl border border-line bg-surface-2 p-3 text-sm text-fg placeholder:text-fg-subtle outline-none focus:border-accent resize-none transition-colors"
              />
            </div>

            {/* Friction prompt */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-fg flex items-center gap-1.5">
                  <span>🧗 Friction & Bottlenecks</span>
                </label>
                <MicButton
                  size="sm"
                  state={activeVoiceField === 'challenges' ? dictation.state : 'idle'}
                  onClick={() => toggleVoice('challenges')}
                  title="Dictate friction"
                />
              </div>
              <textarea
                ref={challengesRef}
                value={reflection.challenges}
                onChange={e => updateReflection({ challenges: e.target.value })}
                placeholder="Where did momentum slow down? What distracted you or created unexpected hurdles?"
                rows={3}
                className="w-full rounded-xl border border-line bg-surface-2 p-3 text-sm text-fg placeholder:text-fg-subtle outline-none focus:border-accent resize-none transition-colors"
              />
            </div>

            {/* Next adjustments prompt */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-fg flex items-center gap-1.5">
                  <span>💡 Adjustments & Lessons</span>
                </label>
                <MicButton
                  size="sm"
                  state={activeVoiceField === 'improvements' ? dictation.state : 'idle'}
                  onClick={() => toggleVoice('improvements')}
                  title="Dictate adjustments"
                />
              </div>
              <textarea
                ref={improvementsRef}
                value={reflection.improvements}
                onChange={e => updateReflection({ improvements: e.target.value })}
                placeholder="What is one small tweak or boundary you will set for the upcoming period?"
                rows={2}
                className="w-full rounded-xl border border-line bg-surface-2 p-3 text-sm text-fg placeholder:text-fg-subtle outline-none focus:border-accent resize-none transition-colors"
              />
            </div>

            {/* Top 3 Priorities */}
            <div className="space-y-2 pt-2 border-t border-line">
              <label className="text-xs font-semibold text-fg flex items-center gap-1.5">
                <Target size={14} className="text-accent" /> Top 3 Upcoming Priorities
              </label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="size-6 rounded-lg bg-surface-3 text-fg-muted text-xs font-medium grid place-items-center shrink-0">1</span>
                  <input
                    ref={priority1Ref}
                    type="text"
                    value={reflection.priority1}
                    onChange={e => updateReflection({ priority1: e.target.value })}
                    placeholder="First major milestone or priority..."
                    className="flex-1 h-9 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-fg-subtle outline-none focus:border-accent"
                  />
                  <MicButton
                    size="sm"
                    state={activeVoiceField === 'priority1' ? dictation.state : 'idle'}
                    onClick={() => toggleVoice('priority1')}
                    title="Dictate priority 1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-6 rounded-lg bg-surface-3 text-fg-muted text-xs font-medium grid place-items-center shrink-0">2</span>
                  <input
                    ref={priority2Ref}
                    type="text"
                    value={reflection.priority2}
                    onChange={e => updateReflection({ priority2: e.target.value })}
                    placeholder="Second key deliverable..."
                    className="flex-1 h-9 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-fg-subtle outline-none focus:border-accent"
                  />
                  <MicButton
                    size="sm"
                    state={activeVoiceField === 'priority2' ? dictation.state : 'idle'}
                    onClick={() => toggleVoice('priority2')}
                    title="Dictate priority 2"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-6 rounded-lg bg-surface-3 text-fg-muted text-xs font-medium grid place-items-center shrink-0">3</span>
                  <input
                    ref={priority3Ref}
                    type="text"
                    value={reflection.priority3}
                    onChange={e => updateReflection({ priority3: e.target.value })}
                    placeholder="Third goal or habit focus..."
                    className="flex-1 h-9 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-fg-subtle outline-none focus:border-accent"
                  />
                  <MicButton
                    size="sm"
                    state={activeVoiceField === 'priority3' ? dictation.state : 'idle'}
                    onClick={() => toggleVoice('priority3')}
                    title="Dictate priority 3"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex justify-between items-center text-xs text-fg-muted">
              <span>Saved locally for this period</span>
              <button
                onClick={copyMarkdown}
                className="h-8 px-4 rounded-xl bg-accent text-accent-fg font-semibold hover:bg-accent-hover flex items-center gap-1.5 transition-colors keycap"
              >
                <Copy size={13} /> {copied ? 'Copied Summary' : 'Export & Copy'}
              </button>
            </div>

            <DictationHud
              state={dictation.state}
              audioLevel={dictation.audioLevel}
              modelProgress={dictation.modelProgress}
              onStop={dictation.stop}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
