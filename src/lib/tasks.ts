import { db, withStatus } from '../db/db';
import { linksTo, removeLink } from './pageLinks';
import type { Priority, Status, Task } from '../types';
import { buildNextInstance } from './recurrence';
import { buildDuplicate, rescheduledFields } from './taskOps';
import { getTimerState, timer } from './timer';
import { toast } from './toast';
import { isoToday, relativeDay, uid } from './utils';

const nowTime = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/** Deletes a task and offers a short "Undo" window. Any page referencing it drops the (now dangling) link. */
export async function deleteTask(task: Task) {
  if (getTimerState().taskId === task.id) timer.setTask(undefined);
  const dangling = await linksTo('task', task.id);
  await db.tasks.delete(task.id);
  await Promise.all(dangling.map(l => removeLink(l.id)));
  toast(`Deleted “${task.title}”`, 'info', { action: { label: 'Undo', run: () => { void db.tasks.put(task); } } });
}

/**
 * The one place a task's status changes. It keeps `completedAt` right, creates the next occurrence when a
 * recurring task is completed, and removes that occurrence again if the completion is undone before it is touched.
 */
export async function changeStatus(task: Task, status: Status, options: { quiet?: boolean } = {}): Promise<Task> {
  if (task.status === status) return task;
  const updated = withStatus(task, status);

  if (status === 'Submitted/Done' && task.recurrence && task.dueDate) {
    const now = new Date().toISOString();
    const next = buildNextInstance(updated, isoToday(), now, uid(), uid);
    if (next) {
      updated.spawnedNextId = next.id;
      await db.transaction('rw', db.tasks, async () => { await db.tasks.put(updated); await db.tasks.add(next); });
      if (!options.quiet) toast(`Done. Next one is ${relativeDay(next.dueDate).toLowerCase()}.`, 'success');
      return updated;
    }
  }

  if (task.status === 'Submitted/Done' && task.spawnedNextId) {
    const spawned = await db.tasks.get(task.spawnedNextId);
    const untouched = !!spawned && spawned.status === 'To Do' && spawned.updatedAt === spawned.createdAt;
    updated.spawnedNextId = undefined;
    await db.transaction('rw', db.tasks, async () => { await db.tasks.put(updated); if (untouched && spawned) await db.tasks.delete(spawned.id); });
    return updated;
  }

  await db.tasks.put(updated);
  return updated;
}

export async function duplicateTask(task: Task): Promise<Task> {
  const copy = buildDuplicate(task, new Date().toISOString(), uid(), uid);
  await db.tasks.add(copy);
  return copy;
}

/** Moves tasks to a date (keeping their time of day where that still makes sense). */
export async function rescheduleTasks(tasks: Task[], date: string) {
  const today = isoToday();
  const time = nowTime();
  const now = new Date().toISOString();
  await db.transaction('rw', db.tasks, async () => {
    for (const task of tasks) await db.tasks.put({ ...task, ...rescheduledFields(task, date, today, time), updatedAt: now });
  });
}

/* ---------- bulk actions ---------- */

export async function bulkPatch(ids: string[], patch: Partial<Pick<Task, 'priority' | 'categoryId' | 'colorCode'>>) {
  const now = new Date().toISOString();
  await db.transaction('rw', db.tasks, async () => {
    for (const id of ids) {
      const task = await db.tasks.get(id);
      if (task) await db.tasks.put({ ...task, ...patch, updatedAt: now });
    }
  });
}

export const bulkSetPriority = (ids: string[], priority: Priority) => bulkPatch(ids, { priority });

export async function bulkComplete(tasks: Task[]) {
  let created = 0;
  for (const task of tasks) {
    const before = task.recurrence && task.status !== 'Submitted/Done';
    await changeStatus(task, 'Submitted/Done', { quiet: true });
    if (before) created += 1;
  }
  toast(`Marked ${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} done${created ? ` and scheduled ${created} repeat${created === 1 ? '' : 's'}` : ''}.`, 'success');
}

export async function bulkDelete(tasks: Task[]) {
  const ids = tasks.map(t => t.id);
  if (ids.includes(getTimerState().taskId ?? '')) timer.setTask(undefined);
  const dangling = (await Promise.all(ids.map(id => linksTo('task', id)))).flat();
  await db.tasks.bulkDelete(ids);
  await Promise.all(dangling.map(l => removeLink(l.id)));
  toast(`Deleted ${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`, 'info', { action: { label: 'Undo', run: () => { void db.tasks.bulkPut(tasks); } }, duration: 8000 });
}
