import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DAILY_JOURNAL_PAGE_ID,
  getMsUntilMidnight,
  getYesterdayIso,
} from '../journalAutoSave';

describe('journalAutoSave engine', () => {
  it('defines the reserved daily journal page constant', () => {
    expect(DAILY_JOURNAL_PAGE_ID).toBe('__daily_journal__');
  });

  describe('getMsUntilMidnight', () => {
    it('calculates correct milliseconds when called before 23:59:00 today', () => {
      // 10:00:00.000 local time
      const testDate = new Date(2026, 9, 15, 10, 0, 0, 0);
      const ms = getMsUntilMidnight(testDate);

      // From 10:00:00 to 23:59:00 is 13 hours and 59 minutes
      const expectedMs = (13 * 60 + 59) * 60 * 1000;
      expect(ms).toBe(expectedMs);
    });

    it('calculates correct milliseconds when called exactly at 23:58:30 today', () => {
      // 23:58:30.000 local time
      const testDate = new Date(2026, 9, 15, 23, 58, 30, 0);
      const ms = getMsUntilMidnight(testDate);

      // 30 seconds remaining until 23:59:00
      expect(ms).toBe(30 * 1000);
    });

    it('schedules for tomorrow 23:59:00 when called after 23:59:00 today', () => {
      // 23:59:30.000 local time (30 seconds after target)
      const testDate = new Date(2026, 9, 15, 23, 59, 30, 0);
      const ms = getMsUntilMidnight(testDate);

      // Remaining time is (24 hours - 30 seconds) = 86400000 - 30000 = 86370000 ms
      const expectedMs = 86_400_000 - 30_000;
      expect(ms).toBe(expectedMs);
    });

    it('schedules for tomorrow 23:59:00 when called exactly at 23:59:00 today', () => {
      // 23:59:00.000 local time
      const testDate = new Date(2026, 9, 15, 23, 59, 0, 0);
      const ms = getMsUntilMidnight(testDate);

      // Exactly 24 hours until tomorrow's 23:59:00
      expect(ms).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('getYesterdayIso', () => {
    it('returns yesterday for standard mid-month dates', () => {
      const midMonth = new Date(2026, 9, 15, 8, 0, 0); // Oct 15
      expect(getYesterdayIso(midMonth)).toBe('2026-10-14');
    });

    it('handles month boundaries properly (e.g. Nov 1 -> Oct 31)', () => {
      const monthStart = new Date(2026, 10, 1, 8, 0, 0); // Nov 1
      expect(getYesterdayIso(monthStart)).toBe('2026-10-31');
    });

    it('handles year boundaries properly (e.g. Jan 1 -> Dec 31)', () => {
      const yearStart = new Date(2027, 0, 1, 8, 0, 0); // Jan 1, 2027
      expect(getYesterdayIso(yearStart)).toBe('2026-12-31');
    });

    it('handles leap year boundaries properly (e.g. Mar 1 2028 -> Feb 29 2028)', () => {
      const leapDay = new Date(2028, 2, 1, 8, 0, 0); // Mar 1, 2028
      expect(getYesterdayIso(leapDay)).toBe('2028-02-29');
    });
  });
});
