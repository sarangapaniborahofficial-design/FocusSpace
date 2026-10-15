import { describe, it, expect } from 'vitest';
import { parseICS } from '../icsImport';

describe('parseICS', () => {
  it('parses standard iCalendar events with folded lines and timestamps', () => {
    const sampleIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Example Corp.//EN
BEGIN:VEVENT
UID:uid1@example.com
DTSTAMP:20261015T100000Z
DTSTART:20261020T140000
DTEND:20261020T153000
SUMMARY:Architecture Review & Planning
DESCRIPTION:Discuss roadmap v3.0 milestones\\nand soundscape procedural synthes
 is.
END:VEVENT
BEGIN:VEVENT
UID:uid2@example.com
DTSTART:20261021
DTEND:20261022
SUMMARY:Design Hackathon
END:VEVENT
END:VCALENDAR`;

    const events = parseICS(sampleIcs);
    expect(events).toHaveLength(2);

    expect(events[0].title).toBe('Architecture Review & Planning');
    expect(events[0].startDate).toBe('2026-10-20');
    expect(events[0].startTime).toBe('14:00');
    expect(events[0].durationMinutes).toBe(90);
    expect(events[0].notes).toContain('Discuss roadmap v3.0 milestones\nand soundscape procedural synthesis.');

    expect(events[1].title).toBe('Design Hackathon');
    expect(events[1].startDate).toBe('2026-10-21');
    expect(events[1].durationMinutes).toBe(30); // Default duration
  });

  it('handles empty or malformed ics gracefully', () => {
    expect(parseICS('')).toEqual([]);
    expect(parseICS('BEGIN:VCALENDAR\nEND:VCALENDAR')).toEqual([]);
    expect(parseICS('Some random text without events')).toEqual([]);
  });
});
