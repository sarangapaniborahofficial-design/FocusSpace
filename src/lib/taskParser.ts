import { addDays, isoToday, parseISODate, toISODate } from './utils';
import type { Category, Priority } from '../types';

export interface ParsedTaskToken<T = string> {
  raw: string;
  value: T;
  label?: string;
}

export interface ParsedTask {
  title: string;
  categoryId?: string;
  categoryName?: string;
  projectTag?: string;
  priority?: Priority;
  estimatedDuration?: number;
  dueDate?: string;
  dueTime?: string;
  tokens: {
    category?: ParsedTaskToken;
    projectTag?: ParsedTaskToken;
    priority?: ParsedTaskToken<Priority>;
    duration?: ParsedTaskToken<number>;
    date?: ParsedTaskToken;
    time?: ParsedTaskToken;
  };
}

const DAY_MAP: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Computes the next upcoming date for a day of the week (0=Sun, 1=Mon, ..., 6=Sat).
 * If target day is today, returns 7 days ahead so "mon" on a Monday schedules for next Monday.
 */
function getNextDayOfWeek(dayIndex: number, fromDate = isoToday()): string {
  const current = parseISODate(fromDate);
  const currentDay = current.getDay();
  let diff = dayIndex - currentDay;
  if (diff <= 0) diff += 7;
  return addDays(fromDate, diff);
}

/**
 * Zero-dependency natural-language task parser.
 * Extracts @category, #tag, !priority, ~duration, and natural dates/times.
 */
export function parseTaskInput(input: string, categories: Category[] = [], baseDate = isoToday()): ParsedTask {
  let text = input;
  const tokens: ParsedTask['tokens'] = {};
  let categoryId: string | undefined;
  let categoryName: string | undefined;
  let projectTag: string | undefined;
  let priority: Priority | undefined;
  let estimatedDuration: number | undefined;
  let dueDate: string | undefined;
  let dueTime: string | undefined;

  // 1. Priority: !urgent, !high, !med, !low or !1, !2, !3, !4
  const priorityMatch = text.match(/(?:^|\s)!([1-4]|urgent|high|med(?:ium)?|low)\b/i);
  if (priorityMatch) {
    const raw = priorityMatch[0].trim();
    const val = priorityMatch[1].toLowerCase();
    let p: Priority = 'Medium';
    if (val === '1' || val === 'urgent') p = 'Urgent';
    else if (val === '2' || val === 'high') p = 'High';
    else if (val === '3' || val === 'med' || val === 'medium') p = 'Medium';
    else if (val === '4' || val === 'low') p = 'Low';
    priority = p;
    tokens.priority = { raw, value: p, label: `!${p}` };
    text = text.replace(priorityMatch[0], ' ');
  }

  // 2. Duration: ~30m, ~1h, ~90m, ~1.5h, ~45
  const durationMatch = text.match(/(?:^|\s)~(\d+(?:\.\d+)?)\s*(m|min|mins|h|hr|hrs)?\b/i);
  if (durationMatch) {
    const raw = durationMatch[0].trim();
    const num = parseFloat(durationMatch[1]);
    const unit = durationMatch[2]?.toLowerCase();
    const isHours = unit && (unit.startsWith('h'));
    const minutes = Math.max(5, Math.min(720, Math.round(isHours ? num * 60 : num)));
    estimatedDuration = minutes;
    tokens.duration = { raw, value: minutes, label: `~${minutes}m` };
    text = text.replace(durationMatch[0], ' ');
  }

  // 3. Category: @category-name or @id
  const catMatch = text.match(/(?:^|\s)@([a-zA-Z0-9_\-]+)\b/i);
  if (catMatch) {
    const raw = catMatch[0].trim();
    const query = catMatch[1].toLowerCase();
    const matched = categories.find(c =>
      c.id.toLowerCase() === query ||
      c.name.toLowerCase() === query ||
      c.name.toLowerCase().replace(/\s+/g, '-').startsWith(query) ||
      c.name.toLowerCase().startsWith(query)
    );
    if (matched) {
      categoryId = matched.id;
      categoryName = matched.name;
      tokens.category = { raw, value: matched.id, label: `@${matched.name}` };
      text = text.replace(catMatch[0], ' ');
    }
  }

  // 4. Project / context tag: #CS101, #DeepWork
  const tagMatch = text.match(/(?:^|\s)#([a-zA-Z0-9_\-]+)\b/);
  if (tagMatch) {
    const raw = tagMatch[0].trim();
    const tag = tagMatch[1];
    projectTag = tag;
    tokens.projectTag = { raw, value: tag, label: `#${tag}` };
    text = text.replace(tagMatch[0], ' ');
  }

  // 5. Time extraction: e.g. 5pm, 17:00, 9:30am, at 2pm, noon, midnight
  const timeAmPm = text.match(/(?:^|\s)(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  const time24 = !timeAmPm && text.match(/(?:^|\s)(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i);
  const timeNamed = !timeAmPm && !time24 && text.match(/(?:^|\s)\b(noon|midnight)\b/i);

  if (timeAmPm) {
    const raw = timeAmPm[0].trim();
    let hours = parseInt(timeAmPm[1], 10);
    const minutes = timeAmPm[2] ? parseInt(timeAmPm[2], 10) : 0;
    const meridian = timeAmPm[3].toLowerCase();
    if (meridian === 'pm' && hours < 12) hours += 12;
    if (meridian === 'am' && hours === 12) hours = 0;
    dueTime = `${pad(hours)}:${pad(minutes)}`;
    tokens.time = { raw, value: dueTime, label: dueTime };
    text = text.replace(timeAmPm[0], ' ');
  } else if (time24) {
    const raw = time24[0].trim();
    dueTime = `${pad(parseInt(time24[1], 10))}:${pad(parseInt(time24[2], 10))}`;
    tokens.time = { raw, value: dueTime, label: dueTime };
    text = text.replace(time24[0], ' ');
  } else if (timeNamed) {
    const raw = timeNamed[0].trim();
    const val = timeNamed[1].toLowerCase();
    dueTime = val === 'noon' ? '12:00' : '00:00';
    tokens.time = { raw, value: dueTime, label: dueTime };
    text = text.replace(timeNamed[0], ' ');
  }

  // 6. Date extraction: today, tomorrow, tmrw, in N days, next week, day of week, or YYYY-MM-DD
  const todayMatch = text.match(/(?:^|\s)\b(today)\b/i);
  const tomorrowMatch = !todayMatch && text.match(/(?:^|\s)\b(tomorrow|tmrw)\b/i);
  const inDaysMatch = !todayMatch && !tomorrowMatch && text.match(/(?:^|\s)\bin\s+(\d+)\s+days?\b/i);
  const nextWeekMatch = !todayMatch && !tomorrowMatch && !inDaysMatch && text.match(/(?:^|\s)\bnext\s+week\b/i);
  const dayOfWeekMatch = !todayMatch && !tomorrowMatch && !inDaysMatch && !nextWeekMatch && text.match(/(?:^|\s)\b(mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday|sun|sunday)\b/i);
  const isoMatch = !todayMatch && !tomorrowMatch && !inDaysMatch && !nextWeekMatch && !dayOfWeekMatch && text.match(/(?:^|\s)\b(\d{4}-\d{2}-\d{2})\b/);
  const slashMatch = !todayMatch && !tomorrowMatch && !inDaysMatch && !nextWeekMatch && !dayOfWeekMatch && !isoMatch && text.match(/(?:^|\s)\b(\d{1,2})\/(\d{1,2})\b/);

  if (todayMatch) {
    dueDate = baseDate;
    tokens.date = { raw: todayMatch[0].trim(), value: baseDate, label: 'Today' };
    text = text.replace(todayMatch[0], ' ');
  } else if (tomorrowMatch) {
    const d = addDays(baseDate, 1);
    dueDate = d;
    tokens.date = { raw: tomorrowMatch[0].trim(), value: d, label: 'Tomorrow' };
    text = text.replace(tomorrowMatch[0], ' ');
  } else if (inDaysMatch) {
    const count = parseInt(inDaysMatch[1], 10);
    const d = addDays(baseDate, count);
    dueDate = d;
    tokens.date = { raw: inDaysMatch[0].trim(), value: d, label: `In ${count}d` };
    text = text.replace(inDaysMatch[0], ' ');
  } else if (nextWeekMatch) {
    const d = addDays(baseDate, 7);
    dueDate = d;
    tokens.date = { raw: nextWeekMatch[0].trim(), value: d, label: 'Next week' };
    text = text.replace(nextWeekMatch[0], ' ');
  } else if (dayOfWeekMatch) {
    const key = dayOfWeekMatch[1].toLowerCase();
    const dayIdx = DAY_MAP[key];
    if (dayIdx !== undefined) {
      const d = getNextDayOfWeek(dayIdx, baseDate);
      dueDate = d;
      tokens.date = { raw: dayOfWeekMatch[0].trim(), value: d, label: key.charAt(0).toUpperCase() + key.slice(1, 3) };
      text = text.replace(dayOfWeekMatch[0], ' ');
    }
  } else if (isoMatch) {
    dueDate = isoMatch[1];
    tokens.date = { raw: isoMatch[0].trim(), value: isoMatch[1], label: isoMatch[1] };
    text = text.replace(isoMatch[0], ' ');
  } else if (slashMatch) {
    const m = parseInt(slashMatch[1], 10);
    const d = parseInt(slashMatch[2], 10);
    const y = new Date().getFullYear();
    const dateStr = `${y}-${pad(m)}-${pad(d)}`;
    dueDate = dateStr;
    tokens.date = { raw: slashMatch[0].trim(), value: dateStr, label: dateStr };
    text = text.replace(slashMatch[0], ' ');
  }

  // Clean title: collapse extra spaces and trim
  const cleanTitle = text.replace(/\s+/g, ' ').trim();

  return {
    title: cleanTitle || input.trim(),
    categoryId,
    categoryName,
    projectTag,
    priority,
    estimatedDuration,
    dueDate,
    dueTime,
    tokens,
  };
}
