import { beforeEach, describe, expect, it } from 'vitest';
import { formatScreenTimeClock, screenTimer } from '../screenTimer';

describe('ScreenTimer Engine & Wellbeing Metrics', () => {
  beforeEach(() => {
    screenTimer.resetTodayUsage();
  });

  describe('formatScreenTimeClock formatting', () => {
    it('formats 0 seconds as 0m', () => {
      expect(formatScreenTimeClock(0)).toBe('0m');
    });

    it('formats seconds under an hour as mm', () => {
      expect(formatScreenTimeClock(45)).toBe('0m');
      expect(formatScreenTimeClock(60)).toBe('1m');
      expect(formatScreenTimeClock(3540)).toBe('59m');
    });

    it('formats hours and minutes accurately', () => {
      expect(formatScreenTimeClock(3600)).toBe('1h 0m');
      expect(formatScreenTimeClock(3660)).toBe('1h 1m');
      expect(formatScreenTimeClock(7325)).toBe('2h 2m');
    });
  });

  describe('Section Tracking & Dynamic Navigation', () => {
    it('switches section without mutating previous section data unexpectedly', () => {
      screenTimer.setSection('calendar');
      expect(screenTimer.getState().activeSection).toBe('calendar');

      screenTimer.setSection('journal');
      expect(screenTimer.getState().activeSection).toBe('journal');
    });
  });

  describe('Daily Limits & Wellbeing Configurations', () => {
    it('clamps daily limit between 0 and 1440 minutes', () => {
      screenTimer.setDailyLimit(180);
      expect(screenTimer.getState().dailyLimitMinutes).toBe(180);

      screenTimer.setDailyLimit(-10);
      expect(screenTimer.getState().dailyLimitMinutes).toBe(0);

      screenTimer.setDailyLimit(2000);
      expect(screenTimer.getState().dailyLimitMinutes).toBe(1440);
    });

    it('clamps break reminder interval between 0 and 240 minutes', () => {
      screenTimer.setBreakReminder(30);
      expect(screenTimer.getState().breakReminderMinutes).toBe(30);

      screenTimer.setBreakReminder(-5);
      expect(screenTimer.getState().breakReminderMinutes).toBe(0);

      screenTimer.setBreakReminder(500);
      expect(screenTimer.getState().breakReminderMinutes).toBe(240);
    });
  });

  describe('Continuous Session Resets', () => {
    it('resets continuous session counter on demand', () => {
      screenTimer.resetCurrentSession();
      expect(screenTimer.getState().currentSessionSeconds).toBe(0);
      expect(screenTimer.getState().breakReminderDue).toBe(false);
    });

    it('clears today counters completely on resetTodayUsage', () => {
      screenTimer.resetTodayUsage();
      const state = screenTimer.getState();
      expect(state.todaySeconds).toBe(0);
      expect(state.currentSessionSeconds).toBe(0);
      expect(state.limitReached).toBe(false);
      expect(state.limitWarningReached).toBe(false);
      expect(state.breakReminderDue).toBe(false);
    });
  });
});
