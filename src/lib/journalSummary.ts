import { db } from '../db/db';
import { formatDuration, isoToday, dateLabel } from './utils';
import { markdownToRichText } from './richtext';
import type { RichTextDoc } from '../types';

/**
 * Builds an automated daily reflection summary for a given day:
 * - Completed tasks and categories
 * - Total focus minutes & session count
 * - Daily habits completed
 * - Carried over tasks
 */
export async function generateDailySummaryMarkdown(date = isoToday()): Promise<string> {
  const [tasks, habits, categories, logs] = await Promise.all([
    db.tasks.toArray(),
    db.habits.toArray(),
    db.categories.toArray(),
    db.focusLogs.toArray(),
  ]);

  const catMap = new Map(categories.map(c => [c.id, c.name]));

  // Completed tasks on this date
  const completedToday = tasks.filter(t => {
    if (t.status !== 'Submitted/Done') return false;
    const completedDay = t.completedAt ? t.completedAt.slice(0, 10) : t.updatedAt?.slice(0, 10);
    return completedDay === date;
  });

  // Focus time on this date
  const todayLogs = logs.filter(l => l.startedAt?.slice(0, 10) === date && l.mode === 'focus');
  const focusMin = todayLogs.reduce((sum, l) => sum + (l.durationMinutes || 0), 0);
  const sessionCount = todayLogs.length;

  // Habits completed on this date
  const activeHabits = habits.filter(h => h.active);
  const habitsDone = activeHabits.filter(h => h.completions.includes(date));

  // Overdue / carried over tasks
  const overdueTasks = tasks.filter(t => t.status !== 'Submitted/Done' && t.dueDate && t.dueDate < date);

  const lines: string[] = [];
  lines.push(`## Daily Log · ${dateLabel(date)}`);
  lines.push('');

  if (sessionCount > 0) {
    lines.push(`- **Focus Time:** ${formatDuration(focusMin)} across ${sessionCount} focus session${sessionCount === 1 ? '' : 's'}`);
  } else {
    lines.push(`- **Focus Time:** No focus sessions recorded`);
  }

  if (activeHabits.length > 0) {
    lines.push(`- **Habits:** ${habitsDone.length} of ${activeHabits.length} checked in`);
  }
  lines.push('');

  lines.push('### Completed Today');
  if (completedToday.length === 0) {
    lines.push('*No tasks marked complete today.*');
  } else {
    for (const t of completedToday) {
      const cat = catMap.get(t.categoryId);
      lines.push(`- [x] ${t.title}${cat ? ` *(${cat})*` : ''}`);
    }
  }
  lines.push('');

  if (overdueTasks.length > 0) {
    lines.push('### Carried Over');
    for (const t of overdueTasks) {
      lines.push(`- [ ] ${t.title} *(due ${t.dueDate})*`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export async function generateDailySummaryDoc(date = isoToday()): Promise<RichTextDoc> {
  const md = await generateDailySummaryMarkdown(date);
  return markdownToRichText(md);
}
