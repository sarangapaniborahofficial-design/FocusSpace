import { describe, it, expect } from 'vitest';
import { generateSmartSchedule, minutesToTime, timeToMinutes } from '../smartScheduler';
import type { Task } from '../../types';

describe('smartScheduler', () => {
  it('converts time string to minutes and back', () => {
    expect(timeToMinutes('09:00')).toBe(540);
    expect(timeToMinutes('14:30')).toBe(870);
    expect(minutesToTime(540)).toBe('09:00');
    expect(minutesToTime(870)).toBe('14:30');
  });

  it('generates an optimized schedule with cognitive-load buffers', () => {
    const today = '2026-10-15';
    const mockTasks: Task[] = [
      {
        id: 't1',
        title: 'Urgent Client Review',
        categoryId: 'work',
        projectTag: 'Q3',
        priority: 'Urgent',
        status: 'To Do',
        estimatedDuration: 60,
        dueDate: today,
        dueTime: '',
        subtasks: [],
        notes: '',
        colorCode: '#60a5fa',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 't2',
        title: 'Quick inbox triage',
        categoryId: 'work',
        projectTag: '',
        priority: 'Medium',
        status: 'To Do',
        estimatedDuration: 15,
        dueDate: today,
        dueTime: '',
        subtasks: [],
        notes: '',
        colorCode: '#60a5fa',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const plan = generateSmartSchedule(mockTasks, today, '09:00', {
      workdayStart: '09:00',
      workdayEnd: '17:00',
      bufferMinutes: 10,
    });

    expect(plan.blocks.length).toBe(2);
    expect(plan.totalWorkMinutes).toBe(75);
    expect(plan.buffers.length).toBeGreaterThan(0);
    expect(plan.isOverbooked).toBe(false);
  });

  it('detects overbooked schedules exceeding workday cutoff', () => {
    const today = '2026-10-15';
    const largeTasks: Task[] = Array.from({ length: 10 }, (_, i) => ({
      id: `task-${i}`,
      title: `Heavy task ${i}`,
      categoryId: 'work',
      projectTag: '',
      priority: 'High',
      status: 'To Do',
      estimatedDuration: 90,
      dueDate: today,
      dueTime: '',
      subtasks: [],
      notes: '',
      colorCode: '#60a5fa',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const plan = generateSmartSchedule(largeTasks, today, '09:00', {
      workdayStart: '09:00',
      workdayEnd: '17:00',
      bufferMinutes: 10,
    });

    expect(plan.isOverbooked).toBe(true);
    expect(plan.suggestedDeferrals.length).toBeGreaterThan(0);
  });
});
