import { describe, it, expect } from 'vitest';
import { parseTaskInput } from '../taskParser';
import type { Category } from '../../types';

describe('parseTaskInput', () => {
  const categories: Category[] = [
    { id: 'academics', name: 'Academics', color: '#60a5fa' },
    { id: 'projects', name: 'Side Projects', color: '#f472b6' },
    { id: 'fitness', name: 'Fitness', color: '#34d399' },
  ];
  const baseDate = '2026-10-15'; // Thursday

  it('extracts priority tokens accurately', () => {
    expect(parseTaskInput('Finish math homework !urgent', categories, baseDate).priority).toBe('Urgent');
    expect(parseTaskInput('Finish math homework !1', categories, baseDate).priority).toBe('Urgent');
    expect(parseTaskInput('Clean desk !high', categories, baseDate).priority).toBe('High');
    expect(parseTaskInput('Clean desk !2', categories, baseDate).priority).toBe('High');
    expect(parseTaskInput('Read book !med', categories, baseDate).priority).toBe('Medium');
    expect(parseTaskInput('Water plants !low', categories, baseDate).priority).toBe('Low');
  });

  it('extracts duration tokens in minutes and hours', () => {
    expect(parseTaskInput('Study biology ~45m', categories, baseDate).estimatedDuration).toBe(45);
    expect(parseTaskInput('Deep focus session ~1.5h', categories, baseDate).estimatedDuration).toBe(90);
    expect(parseTaskInput('Quick standup ~15', categories, baseDate).estimatedDuration).toBe(15);
    expect(parseTaskInput('Full block ~2h', categories, baseDate).estimatedDuration).toBe(120);
  });

  it('matches categories by ID or name prefix', () => {
    const res1 = parseTaskInput('Write essay @academics', categories, baseDate);
    expect(res1.categoryId).toBe('academics');
    expect(res1.categoryName).toBe('Academics');

    const res2 = parseTaskInput('Fix bug @projects', categories, baseDate);
    expect(res2.categoryId).toBe('projects');
    expect(res2.categoryName).toBe('Side Projects');
  });

  it('extracts project context tags', () => {
    const res = parseTaskInput('Implement auth #Security @projects', categories, baseDate);
    expect(res.projectTag).toBe('Security');
  });

  it('extracts natural language dates', () => {
    expect(parseTaskInput('File taxes today', categories, baseDate).dueDate).toBe('2026-10-15');
    expect(parseTaskInput('File taxes tomorrow', categories, baseDate).dueDate).toBe('2026-10-16');
    expect(parseTaskInput('Review pull request in 3 days', categories, baseDate).dueDate).toBe('2026-10-18');
    expect(parseTaskInput('Weekly retro next week', categories, baseDate).dueDate).toBe('2026-10-22');
    expect(parseTaskInput('Team meeting fri', categories, baseDate).dueDate).toBe('2026-10-16'); // Next Friday from Thursday
  });

  it('extracts 12-hour and 24-hour times', () => {
    expect(parseTaskInput('Dentist appointment 5pm', categories, baseDate).dueTime).toBe('17:00');
    expect(parseTaskInput('Morning run 9:30am', categories, baseDate).dueTime).toBe('09:30');
    expect(parseTaskInput('Lunch at noon', categories, baseDate).dueTime).toBe('12:00');
    expect(parseTaskInput('Server deploy 14:45', categories, baseDate).dueTime).toBe('14:45');
  });

  it('extracts a comprehensive multi-token string and preserves clean title', () => {
    const input = 'Finish Data Structures problem set @academics #CS101 !urgent ~90m tomorrow 5pm';
    const res = parseTaskInput(input, categories, baseDate);
    expect(res.title).toBe('Finish Data Structures problem set');
    expect(res.categoryId).toBe('academics');
    expect(res.projectTag).toBe('CS101');
    expect(res.priority).toBe('Urgent');
    expect(res.estimatedDuration).toBe(90);
    expect(res.dueDate).toBe('2026-10-16');
    expect(res.dueTime).toBe('17:00');
    expect(Object.keys(res.tokens)).toHaveLength(6);
  });
});
