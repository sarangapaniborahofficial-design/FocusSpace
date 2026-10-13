import type { Category, FocusLog, Habit, Task } from '../types';
import { addDays, daysBetween, formatDuration, parseISODate, startOfWeek, storage, toISODate } from './utils';

export type ReviewPeriod = 'this-week' | 'last-week' | 'this-month' | 'last-month';

export interface ReviewPeriodInfo {
  id: ReviewPeriod;
  title: string;
  subtitle: string;
  startDate: string;
  endDate: string;
  storageKey: string;
  daysCount: number;
}

export interface ReviewReflection {
  wins: string;
  challenges: string;
  improvements: string;
  priority1: string;
  priority2: string;
  priority3: string;
}

const DEFAULT_REFLECTION: ReviewReflection = {
  wins: '',
  challenges: '',
  improvements: '',
  priority1: '',
  priority2: '',
  priority3: '',
};

const monthDayFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const fullMonthFmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

export function getReviewPeriodInfo(period: ReviewPeriod, today: string): ReviewPeriodInfo {
  if (period === 'this-week') {
    const startDate = startOfWeek(today);
    const endDate = addDays(startDate, 6);
    const startObj = parseISODate(startDate);
    const endObj = parseISODate(endDate);
    return {
      id: period,
      title: 'This Week',
      subtitle: `${monthDayFmt.format(startObj)} – ${monthDayFmt.format(endObj)}`,
      startDate,
      endDate,
      storageKey: `review-week-${startDate}`,
      daysCount: Math.min(7, Math.max(1, daysBetween(startDate, today) + 1)),
    };
  }

  if (period === 'last-week') {
    const thisWeekStart = startOfWeek(today);
    const startDate = addDays(thisWeekStart, -7);
    const endDate = addDays(startDate, 6);
    const startObj = parseISODate(startDate);
    const endObj = parseISODate(endDate);
    return {
      id: period,
      title: 'Last Week',
      subtitle: `${monthDayFmt.format(startObj)} – ${monthDayFmt.format(endObj)}`,
      startDate,
      endDate,
      storageKey: `review-week-${startDate}`,
      daysCount: 7,
    };
  }

  const d = parseISODate(today);

  if (period === 'this-month') {
    const startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const endDate = toISODate(lastDayOfMonth);
    return {
      id: period,
      title: 'This Month',
      subtitle: fullMonthFmt.format(d),
      startDate,
      endDate,
      storageKey: `review-month-${startDate.slice(0, 7)}`,
      daysCount: Math.max(1, daysBetween(startDate, today) + 1),
    };
  }

  // last-month
  const lastMonthDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const startDate = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDayOfLastMonth = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0);
  const endDate = toISODate(lastDayOfLastMonth);
  return {
    id: period,
    title: 'Last Month',
    subtitle: fullMonthFmt.format(lastMonthDate),
    startDate,
    endDate,
    storageKey: `review-month-${startDate.slice(0, 7)}`,
    daysCount: lastDayOfLastMonth.getDate(),
  };
}

const localDateOf = (iso: string | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : toISODate(d);
};

export const doneDate = (t: Task) => localDateOf(t.completedAt || t.updatedAt);
export const logDate = (l: FocusLog) => localDateOf(l.endedAt || l.startedAt);

export interface ReviewCategoryStat {
  category: Category;
  completedCount: number;
  focusMinutes: number;
  percentage: number;
}

export interface ReviewHabitStat {
  habit: Habit;
  checkins: number;
  expected: number;
  rate: number;
}

export interface ReviewData {
  periodInfo: ReviewPeriodInfo;
  tasksCompleted: Task[];
  tasksCompletedCount: number;
  createdInPeriodCount: number;
  focusMinutes: number;
  focusHoursFormatted: string;
  focusSessionsCount: number;
  avgDailyFocusMinutes: number;
  categoryStats: ReviewCategoryStat[];
  habitStats: ReviewHabitStat[];
  overallHabitScore: number;
  highPriorityCount: number;
}

export function computeReviewData(input: {
  tasks: Task[];
  categories: Category[];
  logs: FocusLog[];
  habits: Habit[];
  period: ReviewPeriod;
  today: string;
}): ReviewData {
  const { tasks, categories, logs, habits, period, today } = input;
  const periodInfo = getReviewPeriodInfo(period, today);
  const { startDate, endDate, daysCount } = periodInfo;

  // Completed tasks in range
  const tasksCompleted = tasks.filter(t => {
    if (t.status !== 'Submitted/Done') return false;
    const date = doneDate(t);
    return date >= startDate && date <= endDate;
  });

  const createdInPeriodCount = tasks.filter(t => {
    const created = localDateOf(t.createdAt);
    return created >= startDate && created <= endDate;
  }).length;

  const highPriorityCount = tasksCompleted.filter(t => t.priority === 'High' || t.priority === 'Urgent').length;

  // Focus logs in range
  const validLogs = logs.filter(l => {
    if (l.mode !== 'focus') return false;
    const date = logDate(l);
    return date >= startDate && date <= endDate;
  });

  const focusMinutes = validLogs.reduce((acc, l) => acc + Math.max(0, l.durationMinutes || 0), 0);
  const focusSessionsCount = validLogs.length;
  const avgDailyFocusMinutes = Math.round(focusMinutes / Math.max(1, daysCount));

  // Category breakdown
  const catTasksMap = new Map<string, number>();
  const catFocusMap = new Map<string, number>();

  for (const t of tasksCompleted) {
    catTasksMap.set(t.categoryId, (catTasksMap.get(t.categoryId) ?? 0) + 1);
  }

  for (const l of validLogs) {
    if (l.taskId) {
      const task = tasks.find(t => t.id === l.taskId);
      if (task) {
        catFocusMap.set(task.categoryId, (catFocusMap.get(task.categoryId) ?? 0) + (l.durationMinutes || 0));
      }
    }
  }

  const categoryStats: ReviewCategoryStat[] = categories.map(category => {
    const completedCount = catTasksMap.get(category.id) ?? 0;
    const catFocus = catFocusMap.get(category.id) ?? 0;
    const percentage = tasksCompleted.length > 0 ? Math.round((completedCount / tasksCompleted.length) * 100) : 0;
    return {
      category,
      completedCount,
      focusMinutes: catFocus,
      percentage,
    };
  }).filter(c => c.completedCount > 0 || c.focusMinutes > 0);

  // Habits breakdown
  const activeHabits = habits.filter(h => h.active);
  let totalHabitCheckins = 0;
  let totalHabitExpected = 0;

  const limitDate = endDate < today ? endDate : today;

  const habitStats: ReviewHabitStat[] = activeHabits.map(habit => {
    const checkins = new Set(habit.completions.filter(c => c >= startDate && c <= limitDate)).size;
    const expected = daysCount;
    const rate = expected > 0 ? Math.min(100, Math.round((checkins / expected) * 100)) : 0;
    totalHabitCheckins += checkins;
    totalHabitExpected += expected;
    return {
      habit,
      checkins,
      expected,
      rate,
    };
  });

  const overallHabitScore = totalHabitExpected > 0 ? Math.min(100, Math.round((totalHabitCheckins / totalHabitExpected) * 100)) : 0;

  return {
    periodInfo,
    tasksCompleted,
    tasksCompletedCount: tasksCompleted.length,
    createdInPeriodCount,
    focusMinutes,
    focusHoursFormatted: formatDuration(focusMinutes),
    focusSessionsCount,
    avgDailyFocusMinutes,
    categoryStats,
    habitStats,
    overallHabitScore,
    highPriorityCount,
  };
}

export function loadReviewReflection(storageKey: string): ReviewReflection {
  try {
    const raw = storage.get(`focusspace-${storageKey}`);
    return raw ? { ...DEFAULT_REFLECTION, ...JSON.parse(raw) } : { ...DEFAULT_REFLECTION };
  } catch {
    return { ...DEFAULT_REFLECTION };
  }
}

export function saveReviewReflection(storageKey: string, reflection: ReviewReflection): void {
  storage.set(`focusspace-${storageKey}`, JSON.stringify(reflection));
}

export function exportReviewMarkdown(data: ReviewData, reflection: ReviewReflection): string {
  const { periodInfo, tasksCompletedCount, focusHoursFormatted, focusSessionsCount, overallHabitScore, categoryStats, habitStats, tasksCompleted } = data;

  const lines = [
    `# 🎯 FocusSpace Review: ${periodInfo.title} (${periodInfo.subtitle})`,
    '',
    `## 📊 Performance Summary`,
    `- **Tasks Completed:** ${tasksCompletedCount}`,
    `- **Focus Time:** ${focusHoursFormatted} across ${focusSessionsCount} session${focusSessionsCount === 1 ? '' : 's'}`,
    `- **Habit Consistency:** ${overallHabitScore}%`,
    '',
  ];

  if (categoryStats.length > 0) {
    lines.push('### Category Effort');
    for (const c of categoryStats) {
      lines.push(`- **${c.category.name}:** ${c.completedCount} tasks completed (${c.percentage}%)`);
    }
    lines.push('');
  }

  if (habitStats.length > 0) {
    lines.push('### Habit Tracking');
    for (const h of habitStats) {
      lines.push(`- **${h.habit.name}:** ${h.checkins}/${h.expected} days (${h.rate}%)`);
    }
    lines.push('');
  }

  if (tasksCompleted.length > 0) {
    lines.push('### ✅ Accomplishments');
    for (const t of tasksCompleted.slice(0, 15)) {
      lines.push(`- [x] ${t.title}`);
    }
    if (tasksCompleted.length > 15) {
      lines.push(`- ...and ${tasksCompleted.length - 15} more completed tasks`);
    }
    lines.push('');
  }

  lines.push('## 💭 Reflection & Next Steps');
  if (reflection.wins.trim()) {
    lines.push(`### Wins & Breakthroughs\n${reflection.wins.trim()}\n`);
  }
  if (reflection.challenges.trim()) {
    lines.push(`### Challenges & Friction\n${reflection.challenges.trim()}\n`);
  }
  if (reflection.improvements.trim()) {
    lines.push(`### Adjustments\n${reflection.improvements.trim()}\n`);
  }

  const priorities = [reflection.priority1, reflection.priority2, reflection.priority3].filter(p => p.trim());
  if (priorities.length > 0) {
    lines.push('### Upcoming Top Priorities');
    priorities.forEach((p, idx) => {
      lines.push(`${idx + 1}. ${p.trim()}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}
