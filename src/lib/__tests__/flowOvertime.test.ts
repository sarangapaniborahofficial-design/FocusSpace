import { describe, expect, it } from 'vitest';
import { formatClock, formatOvertimeClock } from '../timer';
import { soundscape } from '../soundscape';

describe('Sprint 1: Flow Overtime & Sonic Ducking Suite', () => {
  describe('formatOvertimeClock', () => {
    it('formats 0 ms as +00:00', () => {
      expect(formatOvertimeClock(0)).toBe('+00:00');
    });

    it('formats seconds and minutes correctly', () => {
      expect(formatOvertimeClock(5000)).toBe('+00:05');
      expect(formatOvertimeClock(65000)).toBe('+01:05');
      expect(formatOvertimeClock(599000)).toBe('+09:59');
      expect(formatOvertimeClock(600000)).toBe('+10:00');
    });

    it('formats deep overtime beyond 60 minutes', () => {
      expect(formatOvertimeClock(3665000)).toBe('+61:05');
    });
  });

  describe('formatClock standard countdown', () => {
    it('formats remaining ms as MM:SS', () => {
      expect(formatClock(1500000)).toBe('25:00');
      expect(formatClock(59000)).toBe('00:59');
      expect(formatClock(0)).toBe('00:00');
    });
  });

  describe('Sonic Anchor Ducking Engine', () => {
    it('initializes with ducked = false', () => {
      expect(soundscape.getState().isDucked).toBe(false);
    });

    it('toggles ducked state cleanly and updates snapshot', () => {
      soundscape.setDucked(true);
      expect(soundscape.getState().isDucked).toBe(true);

      soundscape.setDucked(false);
      expect(soundscape.getState().isDucked).toBe(false);
    });

    it('does not re-trigger listeners when ducked state is unchanged', () => {
      soundscape.setDucked(false);
      let callCount = 0;
      const unsub = soundscape.subscribe(() => { callCount++; });

      soundscape.setDucked(false);
      expect(callCount).toBe(0);

      soundscape.setDucked(true);
      expect(callCount).toBe(1);

      unsub();
      soundscape.setDucked(false);
    });
  });
});
