import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, FolderKanban, Paperclip, Plus, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { db } from '../db/db';
import { richTextSnippet } from '../lib/richtext';
import { createPage } from '../lib/pages';
import { DAILY_JOURNAL_PAGE_ID } from '../lib/journalAutoSave';
import { toast } from '../lib/toast';
import type { Category, JournalEntry, Page } from '../types';
import { EmptyState } from './ui';

const stamp = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(new Date(iso));

/** All pages, or (given a categoryId) just that category's — with strict daily journal exclusion and category grouping. */
export function PagesList({
  categoryId,
  tabs,
  onOpenPage,
}: {
  categoryId?: string;
  tabs?: ReactNode;
  onOpenPage: (pageId: string) => void;
}) {
  const rawPages = useLiveQuery(
    () =>
      categoryId
        ? db.pages.where('categoryId').equals(categoryId).toArray()
        : db.pages.toArray(),
    [categoryId]
  );
  const files = useLiveQuery(() => db.files.toArray(), []); // metadata only, never the file bytes
  const entries = useLiveQuery(() => db.journalEntries.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const category = useLiveQuery(
    async () => (categoryId ? db.categories.get(categoryId) : undefined),
    [categoryId]
  );
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'updated' | 'title'>('updated');
  const [creating, setCreating] = useState(false);

  // Strict isolation: Exclude daily journal pages from the Pages tab
  const pages = useMemo(() => {
    if (!rawPages) return undefined;
    return rawPages.filter(
      p =>
        p.id !== DAILY_JOURNAL_PAGE_ID &&
        p.title.toLowerCase().trim() !== 'daily journal'
    );
  }, [rawPages]);

  const fileCounts = useMemo(() => {
    const counts = new Map<string, number>();
    (files ?? []).forEach(f => counts.set(f.pageId, (counts.get(f.pageId) ?? 0) + 1));
    return counts;
  }, [files]);

  // The most recently written entry per page — used for the card snippet when there's no description yet.
  const latestEntry = useMemo(() => {
    const byPage = new Map<string, JournalEntry>();
    for (const entry of entries ?? []) {
      const cur = byPage.get(entry.pageId);
      if (!cur || entry.date > cur.date) byPage.set(entry.pageId, entry);
    }
    return byPage;
  }, [entries]);

  const summary = (p: Page) =>
    p.description.trim()
      ? p.description.trim()
      : (() => {
          const e = latestEntry.get(p.id);
          return e ? richTextSnippet(e.content, 150) : '';
        })();

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (pages ?? [])
      .filter(
        p =>
          !needle ||
          p.title.toLowerCase().includes(needle) ||
          summary(p).toLowerCase().includes(needle)
      )
      .sort((a, b) =>
        sort === 'title' ? a.title.localeCompare(b.title) : b.updatedAt.localeCompare(a.updatedAt)
      );
  }, [pages, q, sort, latestEntry]);

  // Group pages by Category for top-level view
  const groupedByCategory = useMemo(() => {
    if (categoryId) return null; // Inside a specific category, no secondary grouping needed
    const groups: { category: Category | null; pages: Page[] }[] = [];
    const catMap = new Map<string, Category>(categories.map(c => [c.id, c]));
    const byCat = new Map<string, Page[]>();
    const uncategorized: Page[] = [];

    for (const page of visible) {
      if (page.categoryId && catMap.has(page.categoryId)) {
        const list = byCat.get(page.categoryId) ?? [];
        list.push(page);
        byCat.set(page.categoryId, list);
      } else {
        uncategorized.push(page);
      }
    }

    // Add each category in order
    categories.forEach(cat => {
      const catPages = byCat.get(cat.id);
      if (catPages && catPages.length > 0) {
        groups.push({ category: cat, pages: catPages });
      }
    });

    // Add uncategorized section if any
    if (uncategorized.length > 0) {
      groups.push({ category: null, pages: uncategorized });
    }

    return groups;
  }, [categoryId, visible, categories]);

  const newPage = async (catId?: string) => {
    if (creating) return;
    setCreating(true);
    try {
      const page = await createPage({ categoryId: catId ?? categoryId });
      onOpenPage(page.id);
    } catch {
      toast('Could not create the page. Check that browser storage is available.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const createButton = (
    <button
      onClick={() => void newPage()}
      disabled={creating}
      className="h-8 px-3 rounded-xl bg-accent text-accent-fg font-semibold text-sm flex items-center gap-2 hover:bg-accent-hover disabled:opacity-60 keycap cursor-pointer"
    >
      <Plus size={16} /> New page
    </button>
  );

  const loading = pages === undefined;
  const count = pages?.length ?? 0;
  const title = categoryId ? category?.name ?? 'Category' : 'Knowledge Pages';

  const renderPageCard = (page: Page) => {
    const attached = fileCounts.get(page.id) ?? 0;
    const snippet = summary(page);
    const cat = !categoryId ? categories.find(c => c.id === page.categoryId) : undefined;
    return (
      <button
        key={page.id}
        onClick={() => onOpenPage(page.id)}
        className="text-left rounded-xl border border-line bg-surface hover:bg-hover hover:border-line transition p-4 flex flex-col min-h-[144px] shadow-card cursor-pointer"
      >
        <div className="flex items-start gap-3">
          <span className="size-8 shrink-0 rounded-lg border border-line bg-surface/60 grid place-items-center text-fg-muted">
            <FileText size={15} />
          </span>
          <span className="font-medium text-fg break-words min-w-0 pt-1">
            {page.title.trim() || 'Untitled'}
          </span>
        </div>
        <p
          className={`mt-3 text-sm leading-relaxed line-clamp-3 break-words ${
            snippet ? 'text-fg-muted' : 'text-fg-subtle italic'
          }`}
        >
          {snippet || 'Nothing written yet'}
        </p>
        <div className="mt-auto pt-3 flex items-center gap-3 text-xs text-fg-subtle">
          {cat && (
            <span className="flex items-center gap-1.5 font-medium" style={{ color: cat.color }}>
              <span className="size-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
              {cat.name}
            </span>
          )}
          <span>Edited {stamp(page.updatedAt)}</span>
          {attached > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip size={12} />
              {attached} {attached === 1 ? 'file' : 'files'}
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="p-5 lg:p-7 max-w-[1500px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="index-chip text-fg-subtle mb-1">
            {categoryId ? 'Category Knowledge' : 'Workspace · Structured Knowledge'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-fg-muted mt-1">
            {loading
              ? 'Loading…'
              : count
              ? `${count} ${count === 1 ? 'page' : 'pages'} sorted by category and recency`
              : 'A permanent home for category dashboards, research notes, and project documentation.'}
          </p>
        </div>
        <div className="self-start md:self-auto">{createButton}</div>
      </header>

      {tabs}

      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3" aria-busy="true">
          <div className="skeleton h-36" />
          <div className="skeleton h-36" />
          <div className="skeleton h-36" />
        </div>
      ) : count === 0 ? (
        <div className="rounded-2xl border border-dashed border-line">
          <EmptyState
            icon={FileText}
            title={categoryId ? `No pages in ${category?.name ?? 'this category'} yet` : 'No category pages yet'}
            text="Create a page to write about a topic and organize related tasks, notes, and documentation."
            action={createButton}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
              />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search category pages and notes…"
                aria-label="Search pages"
                className="w-full h-9 rounded-lg bg-surface-2 border border-line pl-9 pr-3 text-sm outline-none focus:border-accent"
              />
            </div>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as 'updated' | 'title')}
              aria-label="Sort pages"
              className="h-9 rounded-lg bg-surface-2 border border-line px-3 text-sm text-fg-muted outline-none"
            >
              <option value="updated">Sort: recently edited</option>
              <option value="title">Sort: title</option>
            </select>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line">
              <EmptyState
                icon={Search}
                title="No pages match your search"
                text={`Nothing matches “${q.trim()}”.`}
                action={
                  <button
                    onClick={() => setQ('')}
                    className="h-8 px-3 rounded-xl border border-line bg-surface-2 text-sm hover:bg-hover keycap cursor-pointer"
                  >
                    Clear search
                  </button>
                }
              />
            </div>
          ) : categoryId || !groupedByCategory ? (
            /* Single-Category Flat Grid */
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {visible.map(page => renderPageCard(page))}
            </div>
          ) : (
            /* Top-Level Category-Grouped Sections */
            <div className="space-y-8">
              {groupedByCategory.map(group => {
                const cat = group.category;
                const groupTitle = cat ? cat.name : 'General Knowledge';
                const groupColor = cat?.color ?? '#888888';

                return (
                  <section
                    key={cat?.id ?? 'uncategorized'}
                    aria-label={groupTitle}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-line/60">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="size-3 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: groupColor }}
                        />
                        <h2 className="text-base font-bold text-fg tracking-tight">
                          {groupTitle}
                        </h2>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-surface-2 border border-line text-fg-muted">
                          {group.pages.length}
                        </span>
                      </div>

                      {cat && (
                        <button
                          onClick={() => void newPage(cat.id)}
                          className="text-xs font-medium text-fg-muted hover:text-accent flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={13} /> Add to {cat.name}
                        </button>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {group.pages.map(page => renderPageCard(page))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
