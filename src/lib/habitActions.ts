import { db } from '../db/db';
import type { Habit } from '../types';
import { linksTo, removeLink } from './pageLinks';
import { uid } from './utils';

export const HABIT_COLORS = ['#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#f59e0b', '#fb7185', '#22d3ee', '#a3e635'];

export async function addHabit(input: { name: string; color?: string; targetLabel?: string }): Promise<Habit | null> {
  const name = input.name.trim();
  if (!name) return null;
  const habit: Habit = { id: uid(), name, color: input.color ?? HABIT_COLORS[0], active: true, completions: [], targetLabel: input.targetLabel?.trim() || undefined };
  await db.habits.add(habit);
  return habit;
}

export const updateHabit = (id: string, changes: Partial<Pick<Habit, 'name' | 'color' | 'targetLabel' | 'active'>>) => db.habits.update(id, changes);

export async function deleteHabit(id: string) {
  const dangling = await linksTo('habit', id);
  await db.habits.delete(id);
  await Promise.all(dangling.map(l => removeLink(l.id)));
}

/** Atomic read-modify-write so two quick taps can't overwrite each other. Works for any past day, which lets you fix a missed check-in. */
export const toggleHabitDay = (id: string, date: string) =>
  db.habits.where('id').equals(id).modify(h => {
    h.completions = h.completions.includes(date) ? h.completions.filter(d => d !== date) : [...h.completions, date];
  });
