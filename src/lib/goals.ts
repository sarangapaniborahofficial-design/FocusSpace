import { storage } from './utils';

export interface Goals { tasks: number; focusHours: number; }

export const GOALS_KEY = 'focusspace-goals';
export const DEFAULT_GOALS: Goals = { tasks: 10, focusHours: 10 };

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export const cleanGoals = (raw: Partial<Goals> | null | undefined): Goals => ({
  tasks: clamp(raw?.tasks, 1, 200, DEFAULT_GOALS.tasks),
  focusHours: clamp(raw?.focusHours, 1, 100, DEFAULT_GOALS.focusHours),
});

export function loadGoals(): Goals {
  try {
    const raw = storage.get(GOALS_KEY);
    return raw ? cleanGoals(JSON.parse(raw)) : { ...DEFAULT_GOALS };
  } catch {
    return { ...DEFAULT_GOALS };
  }
}

export const saveGoals = (goals: Goals) => storage.set(GOALS_KEY, JSON.stringify(cleanGoals(goals)));
