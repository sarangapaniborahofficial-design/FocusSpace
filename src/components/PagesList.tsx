import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Paperclip, Plus, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { db } from '../db/db';
import { richTextSnippet } from '../lib/richtext';
import { createPage } from '../lib/pages';
import { toast } from '../lib/toast';
import type { JournalEntry, Page } from '../types';
import { EmptyState } from './ui';

const stamp = (iso: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }).format(new Date(iso));

/** All pages, or (given a categoryId) just that category's — used both as the top-level Pages view and as a category's Pages tab. */
export function PagesList({ categoryId, tabs, onOpenPage }: { categoryId?: string; tabs?: ReactNode; onOpenPage: (pageId: string) => void }) {
  const pages = useLiveQuery(() => (categoryId ? db.pages.where('categoryId').equals(categoryId).toArray() : db.pages.toArray()), [categoryId]);
  const files = useLiveQuery(() => db.files.toArray(), []); // metadata only, never the file bytes
  const entries = useLiveQuery(() => db.journalEntries.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const category = useLiveQuery(async () => (categoryId ? db.categories.get(categoryId) : undefined), [categoryId]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'updated' | 'title'>('updated');
  const [creating, setCreating] = useState(false);

  const fileCounts = useMemo(() => {
    const counts = new Map<string, number>();
    (files ?? []).forEach(f => counts.set(f.pageId, (counts.get(f.pageId) ?? 0) + 1));
    return counts;
  }, [files]);
  // The most recently written entry per page — used for the card snippet when there's no description yet.
  const latestEntry = useMemo(() => {
    const byPage = new Map<string, JournalEntry>();
    for (const entry of entries ?? []) { const cur = byPage.get(entry.pageId); if (!cur || entry.date > cur.date) byPage.set(entry.pageId, entry); }
    return byPage;
  }, [entries]);

  const summary = (p: Page) => (p.description.trim() ? p.description.trim() : (() => { const e = latestEntry.get(p.id); return e ? richTextSnippet(e.content, 150) : ''; })());

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (pages ?? [])
      .filter(p => !needle || p.title.toLowerCase().includes(needle) || summary(p).toLowerCase().includes(needle))
      .sort((a, b) => (sort === 'title' ? a.title.localeCompare(b.title) : b.updatedAt.localeCompare(a.updatedAt)));
  }, [pages, q, sort, latestEntry]);

  const newPage = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const page = await createPage({ categoryId });
      onOpenPage(page.id);
    } catch {
      toast('Could not create the page. Check that browser storage is available.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const createButton = (
    <button onClick={() => void newPage()} disabled={creating} className="h-10 px-4 rounded-lg bg-zinc-900 text-white font-medium text-sm flex items-center gap-2 hover:bg-white disabled:opacity-60"><Plus size={16} /> New page</button>
  );
  const loading = pages === undefined;
  const count = pages?.length ?? 0;
  const title = categoryId ? category?.name ?? 'Category' : 'Pages';

  return (
    <div className="p-5 lg:p-7 max-w-[1500px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[.18em] text-zinc-300 mb-1">{categoryId ? 'Pages' : 'Context & journal'}</div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-zinc-400 mt-1">{loading ? 'Loading…' : count ? `${count} ${count === 1 ? 'page' : 'pages'}` : 'A permanent place to write about a topic and track its related tasks and habits.'}</p>
        </div>
        <div className="self-start md:self-auto">{createButton}</div>
      </header>

      {tabs}

      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3" aria-busy="true"><div className="skeleton h-36" /><div className="skeleton h-36" /><div className="skeleton h-36" /></div>
      ) : count === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-100">
          <EmptyState icon={FileText} title={categoryId ? `No pages in ${category?.name ?? 'this category'} yet` : 'No pages yet'} text="Create a page to write about a topic and keep its related tasks, habits and files together." action={createButton} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search titles and notes…" aria-label="Search pages" className="w-full h-9 rounded-lg bg-zinc-50 border border-zinc-100 pl-9 pr-3 text-sm outline-none focus:border-zinc-300" />
            </div>
            <select value={sort} onChange={e => setSort(e.target.value as 'updated' | 'title')} aria-label="Sort pages" className="h-9 rounded-lg bg-zinc-50 border border-zinc-100 px-3 text-sm text-zinc-500 outline-none">
              <option value="updated">Sort: recently edited</option>
              <option value="title">Sort: title</option>
            </select>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-100">
              <EmptyState icon={Search} title="No pages match your search" text={`Nothing matches “${q.trim()}”.`} action={<button onClick={() => setQ('')} className="h-9 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm hover:bg-zinc-100">Clear search</button>} />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {visible.map(page => {
                const attached = fileCounts.get(page.id) ?? 0;
                const snippet = summary(page);
                const cat = !categoryId ? categories.find(c => c.id === page.categoryId) : undefined;
                return (
                  <button key={page.id} onClick={() => onOpenPage(page.id)} className="text-left rounded-xl border border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50/80 hover:border-zinc-200 transition p-4 flex flex-col min-h-[144px]">
                    <div className="flex items-start gap-3">
                      <span className="size-8 shrink-0 rounded-lg border border-zinc-100 bg-white/60 grid place-items-center text-zinc-400"><FileText size={15} /></span>
                      <span className="font-medium text-zinc-900 break-words min-w-0 pt-1">{page.title.trim() || 'Untitled'}</span>
                    </div>
                    <p className={`mt-3 text-sm leading-relaxed line-clamp-3 break-words ${snippet ? 'text-zinc-400' : 'text-zinc-200 italic'}`}>{snippet || 'Nothing written yet'}</p>
                    <div className="mt-auto pt-3 flex items-center gap-3 text-xs text-zinc-300">
                      {cat && <span style={{ color: cat.color }}>{cat.name}</span>}
                      <span>Edited {stamp(page.updatedAt)}</span>
                      {attached > 0 && <span className="flex items-center gap-1"><Paperclip size={12} />{attached} {attached === 1 ? 'file' : 'files'}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
