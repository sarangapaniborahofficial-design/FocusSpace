import type { Category, Task } from '../types';
import { describeRecurrence } from './recurrence';

/** iCalendar (.ics) export of scheduled tasks. Times are written in UTC so every calendar app shows the right moment. */

const pad = (n: number) => String(n).padStart(2, '0');
const PRIORITY = { Urgent: 1, High: 3, Medium: 5, Low: 9 } as const;

export const icsEscape = (text: string) => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');

/** Content lines may be at most 75 octets; longer ones continue on the next line after a space. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const size = enc.encode(ch).length;
    if (bytes + size > limit) { parts.push(current); current = ''; bytes = 0; limit = 74; }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export const toUtcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

export function taskStart(t: Task): Date | null {
  if (!t.dueDate || !t.dueTime) return null;
  const d = new Date(`${t.dueDate}T${t.dueTime}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface IcsOptions {
  /** Include completed tasks (default: only open ones). */
  includeDone?: boolean;
  /** Only tasks on or after this date (YYYY-MM-DD). */
  fromDate?: string;
  now?: Date;
}

export function scheduledTasks(tasks: Task[], { includeDone = false, fromDate }: IcsOptions = {}) {
  return tasks
    .filter(t => taskStart(t) !== null && (includeDone || t.status !== 'Submitted/Done') && (!fromDate || t.dueDate >= fromDate))
    .sort((a, b) => taskStart(a)!.getTime() - taskStart(b)!.getTime());
}

export function buildICS(tasks: Task[], categories: Category[], options: IcsOptions = {}): { text: string; count: number } {
  const stamp = toUtcStamp(options.now ?? new Date());
  const chosen = scheduledTasks(tasks, options);
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FocusSpace//Schedule export//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:FocusSpace'];

  for (const task of chosen) {
    const start = taskStart(task)!;
    const end = new Date(start.getTime() + Math.max(5, task.estimatedDuration || 30) * 60_000);
    const category = categories.find(c => c.id === task.categoryId);
    const done = task.status === 'Submitted/Done';
    const description = [
      task.notes?.trim(),
      [category ? `Category: ${category.name}` : '', `Priority: ${task.priority}`, `Estimate: ${task.estimatedDuration} min`, task.projectTag ? `Tag: ${task.projectTag}` : '', task.recurrence ? `Repeats: ${describeRecurrence(task.recurrence)}` : ''].filter(Boolean).join('\n'),
      task.subtasks.length ? task.subtasks.map(s => `[${s.completed ? 'x' : ' '}] ${s.title}`).join('\n') : '',
    ].filter(Boolean).join('\n\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${task.id}@focusspace`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toUtcStamp(start)}`,
      `DTEND:${toUtcStamp(end)}`,
      `SUMMARY:${icsEscape(`${done ? '[Done] ' : ''}${task.title}`)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      ...(category ? [`CATEGORIES:${icsEscape(category.name)}`] : []),
      `PRIORITY:${PRIORITY[task.priority] ?? 5}`,
      `LAST-MODIFIED:${toUtcStamp(new Date(task.updatedAt))}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return { text: lines.map(foldLine).join('\r\n') + '\r\n', count: chosen.length };
}
