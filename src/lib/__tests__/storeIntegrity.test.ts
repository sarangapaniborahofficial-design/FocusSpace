import { describe, expect, it, vi } from 'vitest';
import { ambientSound } from '../ambientSound';
import { getTimerState, timer } from '../timer';
import { soundscape } from '../soundscape';
import { pipHUD } from '../pipHud';
import { screenTimer } from '../screenTimer';

describe('Guardrail Suite: External Store Stability & React Error #185 Prevention', () => {
  describe('ambientSound Store Invariants', () => {
    it('maintains strict reference equality on consecutive getState() calls', () => {
      const s1 = ambientSound.getState();
      const s2 = ambientSound.getState();
      const s3 = ambientSound.getState();

      // Strict reference equality check: MUST be identical in memory
      expect(s1).toBe(s2);
      expect(s2).toBe(s3);
      expect(Object.is(s1, s2)).toBe(true);
    });

    it('does NOT call subscribe listener synchronously on subscription', () => {
      const listener = vi.fn();
      const unsub = ambientSound.subscribe(listener);

      // React useSyncExternalStore contract: subscribe must not synchronously trigger onStoreChange
      expect(listener).not.toHaveBeenCalled();
      unsub();
    });

    it('preserves snapshot reference when setVolume is called with identical value', () => {
      ambientSound.setVolume(0.65);
      const s1 = ambientSound.getState();

      ambientSound.setVolume(0.65);
      const s2 = ambientSound.getState();

      expect(s1).toBe(s2);
      expect(Object.is(s1, s2)).toBe(true);
    });

    it('updates snapshot reference only when state actually mutates', () => {
      const s1 = ambientSound.getState();
      ambientSound.setVolume(0.3);
      const s2 = ambientSound.getState();

      expect(s1).not.toBe(s2);
      expect(s2.volume).toBe(0.3);

      // Subsequent read preserves new reference
      const s3 = ambientSound.getState();
      expect(s2).toBe(s3);
    });
  });

  describe('timer Store Invariants', () => {
    it('maintains strict reference equality on getTimerState()', () => {
      const s1 = getTimerState();
      const s2 = getTimerState();
      expect(s1).toBe(s2);
      expect(Object.is(s1, s2)).toBe(true);
    });

    it('does NOT call timer.subscribe listener synchronously on subscription', () => {
      const listener = vi.fn();
      const unsub = timer.subscribe(listener);
      expect(listener).not.toHaveBeenCalled();
      unsub();
    });
  });

  describe('soundscape Store Invariants', () => {
    it('maintains strict reference equality on soundscape.getState()', () => {
      const s1 = soundscape.getState();
      const s2 = soundscape.getState();
      expect(s1).toBe(s2);
      expect(Object.is(s1, s2)).toBe(true);
    });

    it('does NOT call soundscape.subscribe listener synchronously on subscription', () => {
      const listener = vi.fn();
      const unsub = soundscape.subscribe(listener);
      expect(listener).not.toHaveBeenCalled();
      unsub();
    });
  });

  describe('pipHUD Store Invariants', () => {
    it('maintains strict reference equality on pipHUD.getState()', () => {
      const s1 = pipHUD.getState();
      const s2 = pipHUD.getState();
      expect(s1).toBe(s2);
      expect(Object.is(s1, s2)).toBe(true);
    });

    it('does NOT call pipHUD.subscribe listener synchronously on subscription', () => {
      const listener = vi.fn();
      const unsub = pipHUD.subscribe(listener);
      expect(listener).not.toHaveBeenCalled();
      unsub();
    });
  });

  describe('screenTimer Store Invariants', () => {
    it('maintains strict reference equality on screenTimer.getState()', () => {
      const s1 = screenTimer.getState();
      const s2 = screenTimer.getState();
      const s3 = screenTimer.getState();
      expect(s1).toBe(s2);
      expect(s2).toBe(s3);
      expect(Object.is(s1, s2)).toBe(true);
    });

    it('does NOT call screenTimer.subscribe listener synchronously on subscription', () => {
      const listener = vi.fn();
      const unsub = screenTimer.subscribe(listener);
      expect(listener).not.toHaveBeenCalled();
      unsub();
    });

    it('preserves snapshot reference when setDailyLimit is called with identical value', () => {
      const cur = screenTimer.getState().dailyLimitMinutes;
      const s1 = screenTimer.getState();
      screenTimer.setDailyLimit(cur);
      const s2 = screenTimer.getState();
      expect(s1).toBe(s2);
      expect(Object.is(s1, s2)).toBe(true);
    });
  });

  describe('React useSyncExternalStore 50-Render Loop Simulation', () => {
    it('passes 50 consecutive getSnapshot comparisons without reference divergence', () => {
      const stores = [
        { name: 'ambientSound', get: () => ambientSound.getState() },
        { name: 'timer', get: () => getTimerState() },
        { name: 'soundscape', get: () => soundscape.getState() },
        { name: 'pipHUD', get: () => pipHUD.getState() },
        { name: 'screenTimer', get: () => screenTimer.getState() },
      ];

      for (const st of stores) {
        const initial = st.get();
        for (let i = 0; i < 50; i++) {
          const snapshot = st.get();
          if (!Object.is(initial, snapshot)) {
            throw new Error(
              `React Error #185 Risk Detected in ${st.name}: Snapshot mutated at iteration ${i}. ` +
              `useSyncExternalStore getSnapshot must return cached references.`
            );
          }
        }
      }
      expect(true).toBe(true);
    });
  });
});
