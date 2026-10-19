import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../db/db';
import {
  extractPriority,
  extractDueDate,
  extractDuration,
  extractTime,
  parseAdminIntent,
  executeAiAction,
  undoAiAction,
  generateDailyBriefing,
  type AgentContext,
} from '../localAiAgent';
import { isoToday, addDays } from '../utils';
import type { Task, Page, Category, Habit } from '../../types';

describe('localAiAgent Deterministic NLP Engine', () => {
  const today = isoToday();

  const mockCategories: Category[] = [
    { id: 'work', name: 'Work', color: '#38bdf8', icon: 'Briefcase' },
    { id: 'personal', name: 'Personal', color: '#a855f7', icon: 'User' },
  ];

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Fix auth session memory leak',
      categoryId: 'work',
      projectTag: '',
      priority: 'Urgent',
      status: 'To Do',
      estimatedDuration: 45,
      dueDate: addDays(today, -2), // overdue
      dueTime: '10:00',
      subtasks: [],
      notes: '',
      colorCode: '#38bdf8',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-2',
      title: 'Prepare design spec',
      categoryId: 'work',
      projectTag: '',
      priority: 'Medium',
      status: 'Submitted/Done',
      estimatedDuration: 30,
      dueDate: today,
      dueTime: '11:00',
      subtasks: [],
      notes: '',
      colorCode: '#38bdf8',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-3',
      title: 'Untimed backlog item',
      categoryId: 'personal',
      projectTag: '',
      priority: 'Low',
      status: 'To Do',
      estimatedDuration: 25,
      dueDate: '',
      dueTime: '',
      subtasks: [],
      notes: '',
      colorCode: '#a855f7',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockHabits: Habit[] = [
    { id: 'h1', name: 'Morning Meditation', active: true, completions: [today], color: '#38bdf8' },
    { id: 'h2', name: 'Reading 30m', active: true, completions: [], color: '#a855f7' },
  ];

  const mockPages: Page[] = [
    { id: 'p1', title: 'Architecture Notes', description: '', createdAt: '', updatedAt: '' },
  ];

  const context: AgentContext = {
    tasks: mockTasks,
    categories: mockCategories,
    habits: mockHabits,
    pages: mockPages,
  };

  describe('Entity extraction helpers', () => {
    it('extracts priority correctly', () => {
      expect(extractPriority('fix urgent security issue')).toBe('Urgent');
      expect(extractPriority('critical P0 bug')).toBe('Urgent');
      expect(extractPriority('high priority client call')).toBe('High');
      expect(extractPriority('low priority cleanup')).toBe('Low');
      expect(extractPriority('grocery shopping')).toBe('Medium');
    });

    it('extracts due date correctly', () => {
      expect(extractDueDate('finish report today')).toBe(today);
      expect(extractDueDate('meeting due tomorrow')).toBe(addDays(today, 1));
      expect(extractDueDate('launch in 3 days')).toBe(addDays(today, 3));
      expect(extractDueDate('deadline 2026-11-15')).toBe('2026-11-15');
      expect(extractDueDate('no date specified')).toBeUndefined();
    });

    it('extracts duration correctly', () => {
      expect(extractDuration('quick session for 15m')).toBe(15);
      expect(extractDuration('deep work for 45 mins')).toBe(45);
      expect(extractDuration('focus block for 2 hours')).toBe(120);
      expect(extractDuration('study for 1.5 hrs')).toBe(90);
      expect(extractDuration('routine call')).toBeUndefined();
    });

    it('extracts time correctly', () => {
      expect(extractTime('schedule at 2:30pm')).toBe('14:30');
      expect(extractTime('call at 9am')).toBe('09:00');
      expect(extractTime('meeting at 12:00pm')).toBe('12:00');
      expect(extractTime('sync at 15:45')).toBe('15:45');
      expect(extractTime('no time provided')).toBeUndefined();
    });
  });

  describe('parseAdminIntent', () => {
    it('parses auto-schedule intent', () => {
      const action = parseAdminIntent('auto-schedule today', context);
      expect(action).not.toBeNull();
      expect(action?.type).toBe('auto_schedule');
    });

    it('parses reschedule overdue intent', () => {
      const action = parseAdminIntent('reschedule overdue tasks to today', context);
      expect(action).not.toBeNull();
      expect(action?.type).toBe('reschedule_overdue');
      expect(action?.payload.taskIds).toContain('task-1');
    });

    it('parses clean completed intent', () => {
      const action = parseAdminIntent('clean up completed tasks', context);
      expect(action).not.toBeNull();
      expect(action?.type).toBe('clean_completed');
      expect(action?.payload.taskIds).toContain('task-2');
    });

    it('parses create page intent', () => {
      const action = parseAdminIntent('create page Sprint 75 Backlog', context);
      expect(action).not.toBeNull();
      expect(action?.type).toBe('create_page');
      expect(action?.payload.title).toBe('Sprint 75 Backlog');
    });

    it('parses daily briefing intent', () => {
      const action = parseAdminIntent('summarize today and give me daily briefing', context);
      expect(action).not.toBeNull();
      expect(action?.type).toBe('daily_briefing');
    });

    it('parses create task intent with priority and duration', () => {
      const action = parseAdminIntent(
        'create task Deploy release bundle priority urgent due tomorrow for 45m',
        context
      );
      expect(action).not.toBeNull();
      expect(action?.type).toBe('create_task');
      expect(action?.payload.title).toContain('Deploy release bundle');
      expect(action?.payload.priority).toBe('Urgent');
      expect(action?.payload.estimatedDuration).toBe(45);
      expect(action?.payload.dueDate).toBe(addDays(today, 1));
    });
  });

  describe('generateDailyBriefing', () => {
    it('generates a detailed status report with workload and habits', () => {
      const briefing = generateDailyBriefing(context);
      expect(briefing).toContain(today);
      expect(briefing).toContain('Workload:');
      expect(briefing).toContain('Overdue:');
      expect(briefing).toContain('Habits:');
      expect(briefing).toContain('1/2');
    });
  });

  describe('Database Action Execution and Reversibility (Undo)', () => {
    beforeEach(async () => {
      await db.tasks.clear();
      await db.pages.clear();
      await db.categories.bulkAdd(mockCategories);
    });

    afterEach(async () => {
      await db.tasks.clear();
      await db.pages.clear();
      await db.categories.clear();
    });

    it('creates a task and undos its creation cleanly', async () => {
      const action = parseAdminIntent('create task Write documentation priority high', context)!;
      const res = await executeAiAction(action);
      expect(res.success).toBe(true);

      const tasksAfter = await db.tasks.toArray();
      expect(tasksAfter.length).toBe(1);
      expect(tasksAfter[0].title).toContain('Write documentation');
      expect(tasksAfter[0].priority).toBe('High');

      // Undo
      const actionWithUndo = { ...action, undoPayload: res.undoPayload };
      const undoRes = await undoAiAction(actionWithUndo);
      expect(undoRes.success).toBe(true);

      const tasksAfterUndo = await db.tasks.toArray();
      expect(tasksAfterUndo.length).toBe(0);
    });

    it('creates a page and undos its creation cleanly', async () => {
      const action = parseAdminIntent('create page Edge Runtime Notes', context)!;
      const res = await executeAiAction(action);
      expect(res.success).toBe(true);

      const pagesAfter = await db.pages.toArray();
      expect(pagesAfter.length).toBe(1);
      expect(pagesAfter[0].title).toBe('Edge Runtime Notes');

      // Undo
      const actionWithUndo = { ...action, undoPayload: res.undoPayload };
      const undoRes = await undoAiAction(actionWithUndo);
      expect(undoRes.success).toBe(true);

      const pagesAfterUndo = await db.pages.toArray();
      expect(pagesAfterUndo.length).toBe(0);
    });

    it('reschedules overdue tasks and undos restoring previous due dates', async () => {
      const overdueTask: Task = {
        ...mockTasks[0],
        id: 'overdue-test-1',
        dueDate: '2026-10-01',
      };
      await db.tasks.add(overdueTask);

      const action = {
        id: 'act-reschedule',
        type: 'reschedule_overdue' as const,
        title: 'Reschedule',
        description: '',
        payload: { taskIds: ['overdue-test-1'], targetDate: today },
        timestamp: new Date().toISOString(),
        executed: false,
      };

      const res = await executeAiAction(action);
      expect(res.success).toBe(true);

      const updated = await db.tasks.get('overdue-test-1');
      expect(updated?.dueDate).toBe(today);

      // Undo
      const actionWithUndo = { ...action, undoPayload: res.undoPayload };
      const undoRes = await undoAiAction(actionWithUndo);
      expect(undoRes.success).toBe(true);

      const restored = await db.tasks.get('overdue-test-1');
      expect(restored?.dueDate).toBe('2026-10-01');
    });
  });
});
