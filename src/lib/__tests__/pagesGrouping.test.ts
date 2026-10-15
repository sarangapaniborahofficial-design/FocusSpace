import { describe, it, expect } from 'vitest';
import { DAILY_JOURNAL_PAGE_ID } from '../journalAutoSave';
import type { Category, Page } from '../../types';

describe('Pages tab isolation and category grouping', () => {
  const sampleCategories: Category[] = [
    { id: 'academics', name: 'Academics', color: '#60a5fa' },
    { id: 'fitness', name: 'Fitness', color: '#34d399' },
    { id: 'projects', name: 'Side Projects', color: '#f472b6' },
  ];

  const samplePages: Page[] = [
    {
      id: DAILY_JOURNAL_PAGE_ID,
      title: 'Daily Journal',
      description: 'Automated daily review',
      createdAt: '2026-10-15T00:00:00Z',
      updatedAt: '2026-10-15T23:59:00Z',
    },
    {
      id: 'legacy-journal',
      title: 'Daily Journal',
      description: 'Old manual daily journal',
      createdAt: '2026-10-14T00:00:00Z',
      updatedAt: '2026-10-14T23:59:00Z',
    },
    {
      id: 'p1',
      categoryId: 'academics',
      title: 'Data Structures Trees',
      description: 'BST and AVL notes',
      createdAt: '2026-10-10T10:00:00Z',
      updatedAt: '2026-10-15T12:00:00Z',
    },
    {
      id: 'p2',
      categoryId: 'academics',
      title: 'Algorithms Graph Theory',
      description: 'Dijkstra and A*',
      createdAt: '2026-10-09T10:00:00Z',
      updatedAt: '2026-10-14T10:00:00Z',
    },
    {
      id: 'p3',
      categoryId: 'projects',
      title: 'FocusSpace Architecture',
      description: 'Master system design',
      createdAt: '2026-10-08T10:00:00Z',
      updatedAt: '2026-10-15T18:00:00Z',
    },
    {
      id: 'p4',
      // Uncategorized
      title: 'General Philosophy',
      description: 'Stoicism notes',
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-12T10:00:00Z',
    },
  ];

  it('strictly excludes daily journal pages from the knowledge pages list', () => {
    const filtered = samplePages.filter(
      p =>
        p.id !== DAILY_JOURNAL_PAGE_ID &&
        p.title.toLowerCase().trim() !== 'daily journal'
    );

    expect(filtered.some(p => p.id === DAILY_JOURNAL_PAGE_ID)).toBe(false);
    expect(filtered.some(p => p.id === 'legacy-journal')).toBe(false);
    expect(filtered.map(p => p.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('groups pages correctly by category and isolates uncategorized pages', () => {
    const filtered = samplePages.filter(
      p =>
        p.id !== DAILY_JOURNAL_PAGE_ID &&
        p.title.toLowerCase().trim() !== 'daily journal'
    );

    const catMap = new Map(sampleCategories.map(c => [c.id, c]));
    const byCat = new Map<string, Page[]>();
    const uncategorized: Page[] = [];

    for (const page of filtered) {
      if (page.categoryId && catMap.has(page.categoryId)) {
        const list = byCat.get(page.categoryId) ?? [];
        list.push(page);
        byCat.set(page.categoryId, list);
      } else {
        uncategorized.push(page);
      }
    }

    expect(byCat.get('academics')?.length).toBe(2);
    expect(byCat.get('projects')?.length).toBe(1);
    expect(byCat.get('fitness')).toBeUndefined();
    expect(uncategorized.length).toBe(1);
    expect(uncategorized[0].title).toBe('General Philosophy');
  });

  it('sorts pages chronologically by updatedAt descending within categories', () => {
    const academicsPages = samplePages.filter(p => p.categoryId === 'academics');
    const sorted = [...academicsPages].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    expect(sorted[0].id).toBe('p1'); // Oct 15
    expect(sorted[1].id).toBe('p2'); // Oct 14
  });
});
