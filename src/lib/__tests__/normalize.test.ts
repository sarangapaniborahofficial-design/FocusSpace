import { describe, it, expect } from 'vitest';
import { normalizeCategory, normalizeHabit, normalizeList, normalizeLog, normalizeTask } from '../normalize';

describe('normalize data helpers', () => {
  it('repairs partially malformed task objects', () => {
    const raw = {
      id: 'task-123',
      title: 'Valid Title',
      categoryId: 'cat-1',
      priority: 'InvalidPriority', // should fallback to Medium
      status: 'NonExistentStatus', // should fallback to To Do
      estimatedDuration: -10, // should fallback to 30
      subtasks: [{ title: 'Sub 1', completed: true }, { invalid: true }],
    };

    const task = normalizeTask(raw);
    expect(task).not.toBeNull();
    expect(task?.priority).toBe('Medium');
    expect(task?.status).toBe('To Do');
    expect(task?.estimatedDuration).toBe(30);
    expect(task?.subtasks).toHaveLength(1);
    expect(task?.subtasks[0].title).toBe('Sub 1');
  });

  it('rejects completely invalid task records without crashing', () => {
    expect(normalizeTask(null)).toBeNull();
    expect(normalizeTask({})).toBeNull();
    expect(normalizeTask({ id: 123 })).toBeNull();
    expect(normalizeTask({ id: 't1', title: 456 })).toBeNull();
  });

  it('normalizes categories and trims names', () => {
    const cat = normalizeCategory({ id: 'c1', name: '  Work  ', color: '#123456' });
    expect(cat).toEqual({ id: 'c1', name: 'Work', color: '#123456' });
    expect(normalizeCategory({ id: 'c2', name: '   ' })).toBeNull();
  });

  it('normalizes lists and counts skipped unusable records', () => {
    const rawList = [
      { id: 'c1', name: 'Cat 1' },
      null,
      { id: 'c2', name: 'Cat 2' },
      { id: 'c3', name: '' }, // invalid empty name
    ];
    const { items, skipped } = normalizeList(rawList, normalizeCategory);
    expect(items).toHaveLength(2);
    expect(skipped).toBe(2);
  });

  it('preserves manual task order and launchLinks when valid', () => {
    const raw = {
      id: 'task-ordered',
      title: 'Ordered Task',
      categoryId: 'cat-1',
      order: 42,
      launchLinks: [{ id: 'link-1', label: 'Spotify', url: 'spotify://' }],
    };
    const task = normalizeTask(raw);
    expect(task?.order).toBe(42);
    expect(task?.launchLinks).toHaveLength(1);
    expect(task?.launchLinks?.[0].label).toBe('Spotify');
  });
});
