import { db } from '../db/db';
import type { Priority, Task } from '../types';
import { reorderTasks } from './tasks';
import { addDays, storage } from './utils';

export interface SchedulePreferences {
  workdayStart?: string;
  workdayEnd?: string;
  bufferMinutes?: number;
}

export function loadSchedulePreferences(): Required<SchedulePreferences> {
  return {
    workdayStart: storage.get('focusspace-workday-start') || '09:00',
    workdayEnd: storage.get('focusspace-workday-end') || '19:30',
    bufferMinutes: Number(storage.get('focusspace-buffer-mins')) || 10,
  };
}

export function saveSchedulePreferences(prefs: SchedulePreferences): void {
  if (prefs.workdayStart) storage.set('focusspace-workday-start', prefs.workdayStart);
  if (prefs.workdayEnd) storage.set('focusspace-workday-end', prefs.workdayEnd);
  if (prefs.bufferMinutes) storage.set('focusspace-buffer-mins', String(prefs.bufferMinutes));
}

export type SlotType = 'quick-win' | 'deep-work' | 'fixed-anchor' | 'standard' | 'buffer';

export interface ScheduledBlock {
  id: string;
  task: Task;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  slotType: SlotType;
  rationale: string;
}

export interface BufferBlock {
  id: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  reason: string;
}

export interface SchedulePlan {
  blocks: ScheduledBlock[];
  buffers: BufferBlock[];
  totalWorkMinutes: number;
  totalBufferMinutes: number;
  projectedEndTime: string;
  isOverbooked: boolean;
  overbookedMinutes: number;
  suggestedDeferrals: Task[];
}

const RANK: Record<Priority, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

export const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const minutesToTime = (min: number): string => {
  const m = Math.max(0, Math.floor(min));
  const hours = Math.floor(m / 60) % 24;
  const mins = m % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const roundUpToFive = (m: number): number => Math.ceil(m / 5) * 5;

/**
 * Generates an optimized, cognitive-load-aware daily timeline for Today's tasks.
 */
export function generateSmartSchedule(
  tasks: Task[],
  today: string,
  nowTimeStr?: string,
  customPrefs?: SchedulePreferences,
): SchedulePlan {
  const prefs = { ...loadSchedulePreferences(), ...customPrefs };
  const workdayStartMin = timeToMinutes(prefs.workdayStart);
  const workdayEndMin = timeToMinutes(prefs.workdayEnd);
  const bufferDuration = Math.max(5, prefs.bufferMinutes);

  const now = new Date();
  const defaultNow = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const nowTime = nowTimeStr || defaultNow;
  const currentMin = timeToMinutes(nowTime);

  // Filter for incomplete tasks only
  const openTasks = tasks.filter(t => t.status !== 'Submitted/Done');

  if (openTasks.length === 0) {
    return {
      blocks: [],
      buffers: [],
      totalWorkMinutes: 0,
      totalBufferMinutes: 0,
      projectedEndTime: nowTime,
      isOverbooked: false,
      overbookedMinutes: 0,
      suggestedDeferrals: [],
    };
  }

  // Work start cursor (round up to next 5-min slot)
  let cursorMin = roundUpToFive(currentMin);
  // If running before configured workday start, anchor to workday start
  if (cursorMin < workdayStartMin) cursorMin = workdayStartMin;

  // Separate fixed timed tasks from floating untimed tasks
  const fixedTasks = openTasks
    .filter(t => !!t.dueTime)
    .sort((a, b) => (a.dueTime || '').localeCompare(b.dueTime || ''));

  const floatingTasks = openTasks.filter(t => !t.dueTime);

  // Categorize floating tasks
  const isQuickWin = (t: Task) => (t.estimatedDuration || 25) <= 15;
  const isDeepWork = (t: Task) =>
    (t.priority === 'Urgent' || t.priority === 'High') && (t.estimatedDuration || 25) >= 30;

  // Sort floating tasks:
  // Overdue first -> 1 Quick win starter -> Deep work -> Standard -> Low priority
  const overdue = floatingTasks.filter(t => !!t.dueDate && t.dueDate < today);
  const remainingFloating = floatingTasks.filter(t => !overdue.includes(t));

  const quickWins = remainingFloating.filter(isQuickWin);
  const deepWork = remainingFloating.filter(isDeepWork);
  const others = remainingFloating
    .filter(t => !quickWins.includes(t) && !deepWork.includes(t))
    .sort((a, b) => RANK[a.priority] - RANK[b.priority] || (b.estimatedDuration || 25) - (a.estimatedDuration || 25));

  const orderedQueue: { task: Task; slotType: SlotType; rationale: string }[] = [];

  // 1. Overdue tasks are non-negotiable emergencies
  for (const t of overdue) {
    orderedQueue.push({
      task: t,
      slotType: isDeepWork(t) ? 'deep-work' : 'standard',
      rationale: 'Overdue deadline — clear immediately to prevent backlog.',
    });
  }

  // 2. Momentum starter: 1 quick win to overcome initial friction
  if (quickWins.length > 0) {
    const starter = quickWins[0];
    orderedQueue.push({
      task: starter,
      slotType: 'quick-win',
      rationale: 'Quick win (≤15m) to overcome inertia and establish flow state.',
    });
  }

  // 3. Deep work in peak focus hours
  for (const t of deepWork) {
    orderedQueue.push({
      task: t,
      slotType: 'deep-work',
      rationale: 'High cognitive load allocated to peak mental focus window.',
    });
  }

  // 4. Standard tasks & remaining quick wins
  for (const t of others) {
    orderedQueue.push({
      task: t,
      slotType: 'standard',
      rationale: `${t.priority} priority deliverable.`,
    });
  }

  // Remaining quick wins in the afternoon
  for (const t of quickWins.slice(1)) {
    orderedQueue.push({
      task: t,
      slotType: 'quick-win',
      rationale: 'Low-friction task to maintain output velocity.',
    });
  }

  const blocks: ScheduledBlock[] = [];
  const buffers: BufferBlock[] = [];
  let totalWorkMinutes = 0;
  let totalBufferMinutes = 0;

  let queueIdx = 0;
  let fixedIdx = 0;

  // Interleave queue with fixed appointments
  while (queueIdx < orderedQueue.length || fixedIdx < fixedTasks.length) {
    const nextFixed = fixedTasks[fixedIdx];
    const fixedMin = nextFixed ? timeToMinutes(nextFixed.dueTime!) : Infinity;

    // Check if next fixed task is ready or about to happen
    if (nextFixed && fixedMin <= cursorMin + 5) {
      const duration = nextFixed.estimatedDuration || 30;
      const start = minutesToTime(Math.max(cursorMin, fixedMin));
      const end = minutesToTime(Math.max(cursorMin, fixedMin) + duration);

      blocks.push({
        id: `fixed-${nextFixed.id}`,
        task: nextFixed,
        startTime: start,
        endTime: end,
        durationMinutes: duration,
        slotType: 'fixed-anchor',
        rationale: `Scheduled appointment at ${nextFixed.dueTime}.`,
      });

      cursorMin = Math.max(cursorMin, fixedMin) + duration;
      totalWorkMinutes += duration;
      fixedIdx++;

      // Buffer after fixed meeting
      const bufStart = minutesToTime(cursorMin);
      cursorMin += bufferDuration;
      buffers.push({
        id: `buf-${cursorMin}`,
        startTime: bufStart,
        endTime: minutesToTime(cursorMin),
        durationMinutes: bufferDuration,
        reason: 'Post-meeting decompression buffer',
      });
      totalBufferMinutes += bufferDuration;
      continue;
    }

    // Process next floating queue item
    if (queueIdx < orderedQueue.length) {
      const item = orderedQueue[queueIdx];
      const duration = item.task.estimatedDuration || 25;

      // Check if item fits before next fixed appointment
      if (fixedMin < cursorMin + duration) {
        // Can't fit full item before fixed meeting, jump to fixed
        const gap = fixedMin - cursorMin;
        if (gap >= 10) {
          buffers.push({
            id: `gap-${cursorMin}`,
            startTime: minutesToTime(cursorMin),
            endTime: minutesToTime(fixedMin),
            durationMinutes: gap,
            reason: 'Buffer before scheduled appointment',
          });
          totalBufferMinutes += gap;
        }
        cursorMin = fixedMin;
        continue;
      }

      const start = minutesToTime(cursorMin);
      const end = minutesToTime(cursorMin + duration);

      blocks.push({
        id: `block-${item.task.id}`,
        task: item.task,
        startTime: start,
        endTime: end,
        durationMinutes: duration,
        slotType: item.slotType,
        rationale: item.rationale,
      });

      cursorMin += duration;
      totalWorkMinutes += duration;
      queueIdx++;

      // Insert buffer break after deep work blocks (>= 45m)
      if (item.slotType === 'deep-work' || duration >= 45) {
        const bufStart = minutesToTime(cursorMin);
        cursorMin += 10;
        buffers.push({
          id: `buf-${cursorMin}`,
          startTime: bufStart,
          endTime: minutesToTime(cursorMin),
          durationMinutes: 10,
          reason: 'Cognitive recovery break after deep work session',
        });
        totalBufferMinutes += 10;
      }
    } else if (fixedIdx < fixedTasks.length) {
      // Only fixed tasks remain
      cursorMin = Math.max(cursorMin, fixedMin);
      const duration = nextFixed.estimatedDuration || 30;
      blocks.push({
        id: `fixed-${nextFixed.id}`,
        task: nextFixed,
        startTime: minutesToTime(cursorMin),
        endTime: minutesToTime(cursorMin + duration),
        durationMinutes: duration,
        slotType: 'fixed-anchor',
        rationale: `Scheduled appointment at ${nextFixed.dueTime}.`,
      });
      cursorMin += duration;
      totalWorkMinutes += duration;
      fixedIdx++;
    }
  }

  // Evaluate capacity and overbooking (against configured workday cutoff)
  const isOverbooked = cursorMin > workdayEndMin;
  const overbookedMinutes = isOverbooked ? cursorMin - workdayEndMin : 0;

  // Suggest low-priority or non-urgent tasks to defer if overbooked
  const suggestedDeferrals = isOverbooked
    ? blocks
        .map(b => b.task)
        .filter(t => !t.dueTime && t.priority !== 'Urgent' && (!t.dueDate || t.dueDate >= today))
        .sort((a, b) => RANK[b.priority] - RANK[a.priority])
        .slice(0, 3)
    : [];

  return {
    blocks,
    buffers,
    totalWorkMinutes,
    totalBufferMinutes,
    projectedEndTime: minutesToTime(cursorMin),
    isOverbooked,
    overbookedMinutes,
    suggestedDeferrals,
  };
}

/**
 * Persists the optimized order of tasks into Dexie.
 */
export async function applySmartScheduleOrder(plan: SchedulePlan): Promise<void> {
  const ids = plan.blocks.map(b => b.task.id);
  await reorderTasks(ids);
}

/**
 * Assigns the calculated dueTime to untimed tasks in Dexie so they appear time-blocked on calendar.
 */
export async function applySmartScheduleTimeBlocks(plan: SchedulePlan): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction('rw', db.tasks, async () => {
    for (const block of plan.blocks) {
      const task = await db.tasks.get(block.task.id);
      if (task) {
        await db.tasks.put({
          ...task,
          dueTime: block.startTime,
          updatedAt: now,
        });
      }
    }
  });
}

/**
 * Defers tasks to tomorrow.
 */
export async function deferTasksToTomorrow(taskIds: string[], today: string): Promise<void> {
  const tomorrow = addDays(today, 1);
  const now = new Date().toISOString();
  await db.transaction('rw', db.tasks, async () => {
    for (const id of taskIds) {
      const task = await db.tasks.get(id);
      if (task) {
        await db.tasks.put({
          ...task,
          dueDate: tomorrow,
          updatedAt: now,
        });
      }
    }
  });
}
