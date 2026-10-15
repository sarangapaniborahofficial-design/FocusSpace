import { db } from '../db/db';
import { toast } from './toast';
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

/**
 * Auto-increments goals of type 'tasks-completed'.
 * If categoryId is provided, matches goals tagged with that category or global goals (no category).
 */
export async function recordTaskCompletionForGoals(categoryId?: string) {
  try {
    const goals = await db.goals.filter(g => g.goalType === 'tasks-completed').toArray();
    for (const g of goals) {
      if (!g.categoryId || g.categoryId === categoryId) {
        const next = Math.round((g.currentValue + 1) * 10) / 10;
        await db.goals.update(g.id, { currentValue: next, updatedAt: new Date().toISOString() });
        if (next >= g.targetValue && g.currentValue < g.targetValue) {
          toast(`🎯 Goal Achieved: ${g.title}!`, 'success', { duration: 6000 });
        }
      }
    }
  } catch (err) {
    console.error('Failed to update task completion goals', err);
  }
}

/**
 * Auto-increments goals of type 'focus-hours'.
 * Converts minutes to hours (rounded to 1 decimal place).
 */
export async function recordFocusDurationForGoals(durationMinutes: number, categoryId?: string) {
  if (durationMinutes <= 0) return;
  const hours = Math.round((durationMinutes / 60) * 10) / 10;
  if (hours <= 0) return;
  try {
    const goals = await db.goals.filter(g => g.goalType === 'focus-hours').toArray();
    for (const g of goals) {
      if (!g.categoryId || g.categoryId === categoryId) {
        const next = Math.round((g.currentValue + hours) * 10) / 10;
        await db.goals.update(g.id, { currentValue: next, updatedAt: new Date().toISOString() });
        if (next >= g.targetValue && g.currentValue < g.targetValue) {
          toast(`🎯 Goal Achieved: ${g.title}!`, 'success', { duration: 6000 });
        }
      }
    }
  } catch (err) {
    console.error('Failed to update focus hours goals', err);
  }
}

/**
 * Auto-updates goals of type 'habit-streak' with highest streak achieved.
 */
export async function recordHabitStreakForGoals(streak: number) {
  if (streak <= 0) return;
  try {
    const goals = await db.goals.filter(g => g.goalType === 'habit-streak').toArray();
    for (const g of goals) {
      if (streak > g.currentValue) {
        await db.goals.update(g.id, { currentValue: streak, updatedAt: new Date().toISOString() });
        if (streak >= g.targetValue && g.currentValue < g.targetValue) {
          toast(`🎯 Goal Achieved: ${g.title}!`, 'success', { duration: 6000 });
        }
      }
    }
  } catch (err) {
    console.error('Failed to update habit streak goals', err);
  }
}
