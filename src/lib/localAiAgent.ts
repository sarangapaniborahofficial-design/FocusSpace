import { db } from '../db/db';
import { uid, isoToday, addDays } from './utils';
import { generateSmartSchedule, applySmartScheduleTimeBlocks } from './smartScheduler';
import { queryLocalAi } from './runtime';
import type { Task, Page, Category, Habit, Priority } from '../types';

export type AiActionType =
  | 'create_task'
  | 'schedule_task'
  | 'auto_schedule'
  | 'reschedule_overdue'
  | 'clean_completed'
  | 'create_page'
  | 'daily_briefing';

export interface AiAdminAction {
  id: string;
  type: AiActionType;
  title: string;
  description: string;
  payload: any;
  timestamp: string;
  executed: boolean;
  undoPayload?: any;
}

export interface AiAdminResponse {
  message: string;
  action?: AiAdminAction;
  engine: 'ollama' | 'deterministic';
  modelUsed?: string;
}

export interface AgentContext {
  tasks: Task[];
  categories: Category[];
  habits: Habit[];
  pages: Page[];
}

/**
 * Extracts priority from natural language text.
 */
export function extractPriority(text: string): Priority {
  const lower = text.toLowerCase();
  if (/\b(urgent|p0|asap|critical)\b/.test(lower)) return 'Urgent';
  if (/\b(high|important|p1)\b/.test(lower)) return 'High';
  if (/\b(low|trivial|minor|p3)\b/.test(lower)) return 'Low';
  return 'Medium';
}

/**
 * Extracts due date from natural language text.
 */
export function extractDueDate(text: string): string | undefined {
  const lower = text.toLowerCase();
  const today = isoToday();

  if (/\btoday\b/.test(lower)) return today;
  if (/\btomorrow\b/.test(lower)) return addDays(today, 1);
  if (/\b(next week|in a week)\b/.test(lower)) return addDays(today, 7);

  // YYYY-MM-DD
  const isoMatch = text.match(/\b(20\d\d-\d\d-\d\d)\b/);
  if (isoMatch) return isoMatch[1];

  // in X days
  const daysMatch = lower.match(/\bin\s+(\d+)\s+days?\b/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    if (!isNaN(days)) return addDays(today, days);
  }

  return undefined;
}

/**
 * Extracts estimated duration in minutes from natural language text.
 */
export function extractDuration(text: string): number | undefined {
  const lower = text.toLowerCase();
  const minMatch = lower.match(/\b(\d+)\s*(?:m|min|mins|minutes)\b/);
  if (minMatch) return parseInt(minMatch[1], 10);

  const hourMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours)\b/);
  if (hourMatch) return Math.round(parseFloat(hourMatch[1]) * 60);

  return undefined;
}

/**
 * Extracts time (HH:MM in 24hr format) from natural language text.
 */
export function extractTime(text: string): string | undefined {
  const lower = text.toLowerCase();

  // 14:30 or 2:30pm
  const match12 = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const mins = match12[2] ? parseInt(match12[2], 10) : 0;
    const meridian = match12[3];
    if (meridian === 'pm' && hours < 12) hours += 12;
    if (meridian === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  const match24 = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (match24) {
    return `${String(match24[1]).padStart(2, '0')}:${match24[2]}`;
  }

  return undefined;
}

/**
 * Deterministic Natural Language Parser for administrative user intents.
 */
export function parseAdminIntent(input: string, context: AgentContext): AiAdminAction | null {
  const text = input.trim();
  const lower = text.toLowerCase();
  const today = isoToday();

  // 1. Auto-schedule
  if (
    lower.includes('auto-schedule') ||
    lower.includes('smart schedule') ||
    lower.includes('pack today') ||
    lower.includes('pack my day') ||
    lower.includes('fill calendar') ||
    lower.includes('optimize schedule')
  ) {
    const unscheduled = context.tasks.filter(t => !t.dueDate || !t.dueTime);
    return {
      id: uid(),
      type: 'auto_schedule',
      title: 'Auto-Pack Day & Time-Block Open Gaps',
      description: `Automatically allocate time slots for ${unscheduled.length} unscheduled tasks around fixed appointments for ${today}.`,
      payload: { today },
      timestamp: new Date().toISOString(),
      executed: false,
    };
  }

  // 2. Reschedule Overdue
  if (
    lower.includes('reschedule overdue') ||
    lower.includes('move overdue') ||
    lower.includes('push overdue') ||
    lower.includes('postpone overdue')
  ) {
    const overdueTasks = context.tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'Submitted/Done');
    return {
      id: uid(),
      type: 'reschedule_overdue',
      title: 'Reschedule Overdue Tasks to Today',
      description: `Move ${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'} from past dates to today (${today}).`,
      payload: { taskIds: overdueTasks.map(t => t.id), targetDate: today },
      timestamp: new Date().toISOString(),
      executed: false,
    };
  }

  // 3. Clean Up Completed
  if (
    lower.includes('clean up completed') ||
    lower.includes('clear done') ||
    lower.includes('archive done') ||
    lower.includes('remove completed') ||
    lower.includes('delete completed')
  ) {
    const doneTasks = context.tasks.filter(t => t.status === 'Submitted/Done');
    return {
      id: uid(),
      type: 'clean_completed',
      title: 'Clean Up Completed Tasks',
      description: `Archive and remove ${doneTasks.length} completed task${doneTasks.length === 1 ? '' : 's'} from active view.`,
      payload: { taskIds: doneTasks.map(t => t.id) },
      timestamp: new Date().toISOString(),
      executed: false,
    };
  }

  // 4. Create Page / Note
  if (
    lower.startsWith('create page') ||
    lower.startsWith('new page') ||
    lower.startsWith('create note') ||
    lower.startsWith('new note')
  ) {
    let pageTitle = text.replace(/^(create\s+page|new\s+page|create\s+note|new\s+note)\s*(?:named|called|titled|:\s*)?/i, '').trim();
    if (!pageTitle) pageTitle = 'Untitled Workspace Page';

    return {
      id: uid(),
      type: 'create_page',
      title: `Create Page: "${pageTitle}"`,
      description: `Initialize a new offline atelier journal page titled "${pageTitle}".`,
      payload: { title: pageTitle },
      timestamp: new Date().toISOString(),
      executed: false,
    };
  }

  // 5. Daily Briefing / Summarize Today
  if (
    lower.includes('summarize today') ||
    lower.includes('daily briefing') ||
    lower.includes('what should i focus on') ||
    lower.includes('daily summary') ||
    lower.includes('status report') ||
    lower.includes('briefing')
  ) {
    return {
      id: uid(),
      type: 'daily_briefing',
      title: 'Executive Daily Briefing',
      description: `Generate a status digest of today's schedule, pending priorities, and habits.`,
      payload: { today },
      timestamp: new Date().toISOString(),
      executed: false,
    };
  }

  // 6. Schedule Existing Task: "schedule [task title] at [time]"
  const scheduleMatch = lower.match(/^(?:schedule|set)\s+(.+?)\s+(?:at|for)\s+([0-9apm:]+)\b/i);
  if (scheduleMatch) {
    const query = scheduleMatch[1].trim();
    const time = extractTime(scheduleMatch[2]) || '14:00';
    const targetTask = context.tasks.find(t => t.title.toLowerCase().includes(query.toLowerCase()));

    if (targetTask) {
      return {
        id: uid(),
        type: 'schedule_task',
        title: `Schedule "${targetTask.title}" at ${time}`,
        description: `Set due date to today (${today}) and due time to ${time}.`,
        payload: { taskId: targetTask.id, dueDate: today, dueTime: time },
        timestamp: new Date().toISOString(),
        executed: false,
      };
    }
  }

  // 7. Create Task: "create task ...", "add task ...", "remind me to ..."
  if (
    lower.startsWith('create task') ||
    lower.startsWith('add task') ||
    lower.startsWith('new task') ||
    lower.startsWith('remind me to') ||
    lower.startsWith('todo:')
  ) {
    const priority = extractPriority(text);
    const dueDate = extractDueDate(text) || today;
    const duration = extractDuration(text) || 30;
    const time = extractTime(text);

    // Find category
    let categoryId = context.categories[0]?.id || 'personal';
    for (const cat of context.categories) {
      if (lower.includes(cat.name.toLowerCase())) {
        categoryId = cat.id;
        break;
      }
    }

    // Clean task title
    let taskTitle = text
      .replace(/^(create\s+task|add\s+task|new\s+task|remind\s+me\s+to|todo:)\s*/i, '')
      .replace(/\b(priority\s+(urgent|high|medium|low)|urgent|high\s+priority)\b/gi, '')
      .replace(/\b(due\s+(today|tomorrow|next\s+week|\d{4}-\d{2}-\d{2})|today|tomorrow)\b/gi, '')
      .replace(/\b(for\s+\d+\s*(?:m|min|mins|minutes|h|hr|hours?))\b/gi, '')
      .replace(/\b(at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/gi, '')
      .trim();

    if (!taskTitle) taskTitle = 'Untitled Task';

    return {
      id: uid(),
      type: 'create_task',
      title: `Create Task: "${taskTitle}"`,
      description: `Add task to ${context.categories.find(c => c.id === categoryId)?.name || 'workspace'} (Priority: ${priority}, Duration: ${duration}m, Due: ${dueDate}${time ? ` at ${time}` : ''}).`,
      payload: {
        title: taskTitle,
        categoryId,
        priority,
        dueDate,
        dueTime: time || '',
        estimatedDuration: duration,
      },
      timestamp: new Date().toISOString(),
      executed: false,
    };
  }

  return null;
}

/**
 * Executes an AiAdminAction against Dexie database and stores inverse undo information.
 */
export async function executeAiAction(action: AiAdminAction): Promise<{ success: boolean; message: string; undoPayload?: any }> {
  const now = new Date().toISOString();

  switch (action.type) {
    case 'create_task': {
      const p = action.payload;
      const cat = await db.categories.get(p.categoryId);
      const newTask: Task = {
        id: uid(),
        title: p.title,
        categoryId: p.categoryId,
        projectTag: '',
        priority: p.priority || 'Medium',
        status: 'To Do',
        estimatedDuration: p.estimatedDuration || 30,
        dueDate: p.dueDate || '',
        dueTime: p.dueTime || '',
        subtasks: [],
        notes: '',
        colorCode: cat?.color || '#a1a1aa',
        createdAt: now,
        updatedAt: now,
      };
      await db.tasks.add(newTask);
      return {
        success: true,
        message: `Task "${newTask.title}" created successfully.`,
        undoPayload: { taskId: newTask.id },
      };
    }

    case 'create_page': {
      const p = action.payload;
      const newPage: Page = {
        id: uid(),
        title: p.title,
        description: '',
        createdAt: now,
        updatedAt: now,
      };
      await db.pages.add(newPage);
      return {
        success: true,
        message: `Page "${newPage.title}" created successfully.`,
        undoPayload: { pageId: newPage.id },
      };
    }

    case 'auto_schedule': {
      const allTasks = await db.tasks.toArray();
      const plan = generateSmartSchedule(allTasks, action.payload.today);
      const newlyScheduled = plan.blocks.filter(b => b.slotType !== 'fixed-anchor');

      // Save previous state of these tasks for undo
      const prevStates: Record<string, { dueDate?: string; dueTime?: string }> = {};
      for (const block of newlyScheduled) {
        const t = allTasks.find(x => x.id === block.task.id);
        if (t) {
          prevStates[t.id] = { dueDate: t.dueDate, dueTime: t.dueTime };
        }
      }

      await applySmartScheduleTimeBlocks(plan, action.payload.today);
      return {
        success: true,
        message: `Auto-packed ${newlyScheduled.length} tasks into today's schedule!`,
        undoPayload: { prevStates },
      };
    }

    case 'reschedule_overdue': {
      const taskIds: string[] = action.payload.taskIds || [];
      const prevDates: Record<string, string | undefined> = {};
      await db.transaction('rw', db.tasks, async () => {
        for (const id of taskIds) {
          const t = await db.tasks.get(id);
          if (t) {
            prevDates[id] = t.dueDate;
            await db.tasks.update(id, { dueDate: action.payload.targetDate, updatedAt: now });
          }
        }
      });
      return {
        success: true,
        message: `Rescheduled ${taskIds.length} overdue tasks to today.`,
        undoPayload: { prevDates },
      };
    }

    case 'clean_completed': {
      const taskIds: string[] = action.payload.taskIds || [];
      const removedTasks: Task[] = [];
      await db.transaction('rw', db.tasks, async () => {
        for (const id of taskIds) {
          const t = await db.tasks.get(id);
          if (t) {
            removedTasks.push(t);
            await db.tasks.delete(id);
          }
        }
      });
      return {
        success: true,
        message: `Cleaned up ${removedTasks.length} completed tasks.`,
        undoPayload: { removedTasks },
      };
    }

    case 'schedule_task': {
      const { taskId, dueDate, dueTime } = action.payload;
      const t = await db.tasks.get(taskId);
      if (!t) return { success: false, message: 'Task not found' };

      const prevState = { dueDate: t.dueDate, dueTime: t.dueTime };
      await db.tasks.update(taskId, { dueDate, dueTime, updatedAt: now });
      return {
        success: true,
        message: `Scheduled "${t.title}" at ${dueTime}.`,
        undoPayload: { taskId, prevState },
      };
    }

    case 'daily_briefing': {
      return {
        success: true,
        message: 'Daily briefing generated.',
      };
    }

    default:
      return { success: false, message: 'Unknown action type.' };
  }
}

/**
 * Undoes an executed AiAdminAction using its saved undoPayload.
 */
export async function undoAiAction(action: AiAdminAction): Promise<{ success: boolean; message: string }> {
  if (!action.undoPayload) {
    return { success: false, message: 'No undo data available for this action.' };
  }

  const now = new Date().toISOString();

  switch (action.type) {
    case 'create_task': {
      await db.tasks.delete(action.undoPayload.taskId);
      return { success: true, message: `Reverted creation of task.` };
    }

    case 'create_page': {
      await db.pages.delete(action.undoPayload.pageId);
      return { success: true, message: `Reverted creation of page.` };
    }

    case 'auto_schedule': {
      const prev: Record<string, { dueDate?: string; dueTime?: string }> = action.undoPayload.prevStates || {};
      await db.transaction('rw', db.tasks, async () => {
        for (const [id, state] of Object.entries(prev)) {
          await db.tasks.update(id, { ...state, updatedAt: now });
        }
      });
      return { success: true, message: `Reverted auto-schedule time blocks.` };
    }

    case 'reschedule_overdue': {
      const prev = action.undoPayload.prevDates || {};
      await db.transaction('rw', db.tasks, async () => {
        for (const [id, date] of Object.entries(prev)) {
          await db.tasks.update(id, { dueDate: date as string, updatedAt: now });
        }
      });
      return { success: true, message: `Restored original due dates for overdue tasks.` };
    }

    case 'clean_completed': {
      const tasks: Task[] = action.undoPayload.removedTasks || [];
      await db.transaction('rw', db.tasks, async () => {
        for (const t of tasks) {
          await db.tasks.put(t);
        }
      });
      return { success: true, message: `Restored ${tasks.length} completed tasks.` };
    }

    case 'schedule_task': {
      const { taskId, prevState } = action.undoPayload;
      await db.tasks.update(taskId, { ...prevState, updatedAt: now });
      return { success: true, message: `Restored previous schedule for task.` };
    }

    default:
      return { success: false, message: 'Cannot undo this action.' };
  }
}

/**
 * Generates an executive daily briefing text summary.
 */
export function generateDailyBriefing(context: AgentContext): string {
  const today = isoToday();
  const openTasks = context.tasks.filter(t => t.status !== 'Submitted/Done');
  const overdueTasks = openTasks.filter(t => t.dueDate && t.dueDate < today);
  const scheduledToday = openTasks.filter(t => t.dueDate === today && t.dueTime);
  const urgentTasks = openTasks.filter(t => t.priority === 'Urgent' || t.priority === 'High');
  const habitsDone = context.habits.filter(h => h.completions.includes(today)).length;

  let briefing = `### ☀️ Daily Briefing for ${today}\n\n`;
  briefing += `• **Workload:** You have **${openTasks.length} open tasks** across your workspace.\n`;

  if (overdueTasks.length > 0) {
    briefing += `• ⚠️ **Overdue:** **${overdueTasks.length} tasks** require immediate rescheduling.\n`;
  } else {
    briefing += `• ✅ **Clean Horizon:** No overdue backlog tasks.\n`;
  }

  if (scheduledToday.length > 0) {
    briefing += `• 📅 **Scheduled Today:** **${scheduledToday.length} time-blocks** on your calendar.\n`;
  } else {
    briefing += `• 💡 **Free Slots:** No tasks scheduled for today yet. Use *⚡ Auto-Pack Day* to slot open priorities.\n`;
  }

  if (urgentTasks.length > 0) {
    briefing += `• 🎯 **Top Priorities:** ${urgentTasks.slice(0, 3).map(t => `"${t.title}"`).join(', ')}.\n`;
  }

  briefing += `• 🧘 **Habits:** **${habitsDone}/${context.habits.length} daily habits** completed so far.\n\n`;
  briefing += `*Tip: Type "auto-schedule today" or "create task [name]" to execute actions in 1 click.*`;

  return briefing;
}

/**
 * Master query processor: runs through Ollama local LLM if running, or falls back to
 * zero-cloud deterministic NLP engine.
 */
export async function processAiAdminQuery(
  input: string,
  context: AgentContext,
  preferredModel?: string
): Promise<AiAdminResponse> {
  const deterministicAction = parseAdminIntent(input, context);

  // If input matches daily briefing
  if (deterministicAction?.type === 'daily_briefing') {
    return {
      message: generateDailyBriefing(context),
      action: deterministicAction,
      engine: 'deterministic',
    };
  }

  // Attempt local Ollama query if available
  try {
    const aiResult = await queryLocalAi({
      prompt: input,
      model: preferredModel || 'llama3',
      systemPrompt: `You are FocusSpace Local AI Admin, an offline workspace assistant. The user can create tasks, reschedule overdue items, and auto-pack their day. Context: ${context.tasks.length} tasks, ${context.categories.length} categories. Keep answers concise (under 2 sentences).`,
    });

    if (aiResult.response && !aiResult.error) {
      return {
        message: aiResult.response.trim(),
        action: deterministicAction || undefined,
        engine: 'ollama',
        modelUsed: aiResult.model,
      };
    }
  } catch {}

  // Fallback to Deterministic NLP Engine
  if (deterministicAction) {
    return {
      message: `Parsed intent: ${deterministicAction.title}. Ready to execute.`,
      action: deterministicAction,
      engine: 'deterministic',
    };
  }

  return {
    message: `I understood: "${input}". Try commands like "auto-schedule my day", "clean up completed tasks", "reschedule overdue tasks", or "create task [name] priority [high]".`,
    engine: 'deterministic',
  };
}
