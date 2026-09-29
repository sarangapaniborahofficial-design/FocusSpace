import type { Task } from '../types';

/** A copy of a task that starts fresh: not done, subtasks unticked, no link to a previous occurrence. */
export function buildDuplicate(task: Task, now: string, newId: string, newSubtaskId: () => string): Task {
  return {
    ...task,
    id: newId,
    title: `${task.title} (copy)`,
    status: 'To Do',
    completedAt: undefined,
    spawnedNextId: undefined,
    subtasks: task.subtasks.map(s => ({ ...s, id: newSubtaskId(), completed: false })),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * New due date/time when rescheduling. The time of day is kept, except when moving to today and that time has
 * already passed (a stale 09:00 on a task you are moving at 14:00 would just be overdue again).
 */
export function rescheduledFields(task: Pick<Task, 'dueTime'>, date: string, today: string, nowTime: string) {
  const passed = date === today && !!task.dueTime && task.dueTime < nowTime;
  return { dueDate: date, dueTime: passed ? '' : task.dueTime };
}
