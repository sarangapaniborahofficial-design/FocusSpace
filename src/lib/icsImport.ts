import { db } from '../db/db';
import { toast } from './toast';
import { uid } from './utils';
import type { Task } from '../types';

export interface ParsedIcsEvent {
  title: string;
  startDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  durationMinutes: number;
  notes?: string;
  uid?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Parses an iCalendar date-time string (e.g. 20261020T153000Z or 20261020T153000 or 20261020)
 */
function parseIcsDate(raw: string): { date: string; time?: string } | null {
  const clean = raw.trim().replace(/^VALUE=DATE:/i, '');
  if (/^\d{8}$/.test(clean)) {
    const y = clean.slice(0, 4);
    const m = clean.slice(4, 6);
    const d = clean.slice(6, 8);
    return { date: `${y}-${m}-${d}` };
  }
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?/);
  if (!match) return null;
  const [, y, m, d, hh, mm, , isUtc] = match;
  if (isUtc) {
    const utcDate = new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), parseInt(hh, 10), parseInt(mm, 10)));
    const localY = utcDate.getFullYear();
    const localM = pad(utcDate.getMonth() + 1);
    const localD = pad(utcDate.getDate());
    const localH = pad(utcDate.getHours());
    const localMin = pad(utcDate.getMinutes());
    return { date: `${localY}-${localM}-${localD}`, time: `${localH}:${localMin}` };
  }
  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}

/**
 * Parses unescaped text from iCalendar fields.
 */
function unescapeIcsText(text: string): string {
  return text
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

/**
 * Pure parser for RFC 5545 .ics / iCalendar text content.
 */
export function parseICS(icsContent: string): ParsedIcsEvent[] {
  const events: ParsedIcsEvent[] = [];
  // Unfold folded lines (RFC 5545 lines beginning with whitespace continue the previous line)
  const unfolded = icsContent.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  let inEvent = false;
  let current: Partial<ParsedIcsEvent> & { dtStartRaw?: string; dtEndRaw?: string } = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      current = {};
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (inEvent && current.title) {
        let durationMinutes = 30;
        let startDate: string | undefined;
        let startTime: string | undefined;

        if (current.dtStartRaw) {
          const startParsed = parseIcsDate(current.dtStartRaw);
          if (startParsed) {
            startDate = startParsed.date;
            startTime = startParsed.time;
          }
        }

        if (current.dtStartRaw && current.dtEndRaw) {
          const startParsed = parseIcsDate(current.dtStartRaw);
          const endParsed = parseIcsDate(current.dtEndRaw);
          if (startParsed?.time && endParsed?.time) {
            const [sh, sm] = startParsed.time.split(':').map(Number);
            const [eh, em] = endParsed.time.split(':').map(Number);
            const diff = (eh * 60 + em) - (sh * 60 + sm);
            if (diff > 0) durationMinutes = diff;
          }
        }

        events.push({
          title: current.title,
          startDate,
          startTime,
          durationMinutes: Math.max(5, durationMinutes),
          notes: current.notes,
          uid: current.uid,
        });
      }
      inEvent = false;
      current = {};
      continue;
    }

    if (!inEvent) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const keyPart = trimmed.slice(0, colonIdx);
    const valuePart = trimmed.slice(colonIdx + 1);
    const key = keyPart.split(';')[0].toUpperCase();

    if (key === 'SUMMARY') {
      current.title = unescapeIcsText(valuePart);
    } else if (key === 'DTSTART') {
      current.dtStartRaw = valuePart;
    } else if (key === 'DTEND') {
      current.dtEndRaw = valuePart;
    } else if (key === 'DESCRIPTION') {
      current.notes = unescapeIcsText(valuePart);
    } else if (key === 'UID') {
      current.uid = valuePart.trim();
    }
  }

  return events;
}

/**
 * Imports parsed .ics events into the local FocusSpace database.
 */
export async function importIcsToDatabase(icsContent: string, categoryId: string): Promise<{ count: number }> {
  const parsedEvents = parseICS(icsContent);
  if (parsedEvents.length === 0) {
    throw new Error('No calendar events (VEVENT) found in that .ics file.');
  }

  const category = await db.categories.get(categoryId);
  const now = new Date().toISOString();

  const newTasks: Task[] = parsedEvents.map(ev => ({
    id: uid(),
    title: ev.title,
    categoryId,
    projectTag: 'CalendarImport',
    priority: 'Medium',
    status: 'To Do',
    estimatedDuration: ev.durationMinutes,
    dueDate: ev.startDate ?? '',
    dueTime: ev.startTime ?? (ev.startDate ? '09:00' : ''),
    subtasks: [],
    notes: ev.notes ?? '',
    colorCode: category?.color ?? '#60a5fa',
    createdAt: now,
    updatedAt: now,
  }));

  await db.tasks.bulkAdd(newTasks);
  toast(`Imported ${newTasks.length} events from calendar.`, 'success');
  return { count: newTasks.length };
}
