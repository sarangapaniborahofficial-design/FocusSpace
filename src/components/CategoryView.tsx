import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { PageView } from './PageView';
import { PagesList } from './PagesList';
import { TaskManager } from './TaskManager';

export type CategoryTab = 'tasks' | 'pages';

function Tabs({ categoryId, tab, onTab }: { categoryId: string; tab: CategoryTab; onTab: (tab: CategoryTab) => void }) {
  const tasks = useLiveQuery(() => db.tasks.where('categoryId').equals(categoryId).count(), [categoryId]);
  const pages = useLiveQuery(() => db.pages.where('categoryId').equals(categoryId).count(), [categoryId]);
  const items: { id: CategoryTab; label: string; count?: number }[] = [{ id: 'tasks', label: 'Tasks', count: tasks }, { id: 'pages', label: 'Pages', count: pages }];
  return (
    <div className="flex gap-1 mb-5 border-b border-zinc-900" role="tablist" aria-label="Category sections">
      {items.map(item => (
        <button
          key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => onTab(item.id)}
          className={`relative px-3 h-10 text-sm transition-colors ${tab === item.id ? 'text-zinc-50' : 'text-zinc-500 hover:text-zinc-200'}`}
        >
          {item.label}
          {item.count !== undefined && <span className="ml-2 text-xs text-zinc-600 tabular-nums">{item.count}</span>}
          {tab === item.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ background: 'var(--ring-fill)' }} />}
        </button>
      ))}
    </div>
  );
}

/** A category: its tasks, its pages, or one open page. */
export function CategoryView({ categoryId, tab, pageId, query, onTab, onOpenPage, onBackToPages, onQuickAdd }: {
  categoryId: string; tab: CategoryTab; pageId: string | null; query: string;
  onTab: (tab: CategoryTab) => void; onOpenPage: (pageId: string) => void; onBackToPages: () => void; onQuickAdd: () => void;
}) {
  if (pageId) return <PageView key={pageId} pageId={pageId} onBack={onBackToPages} />;
  const tabs = <Tabs categoryId={categoryId} tab={tab} onTab={onTab} />;
  return tab === 'pages'
    ? <PagesList categoryId={categoryId} tabs={tabs} onOpenPage={onOpenPage} />
    : <TaskManager categoryId={categoryId} onQuickAdd={onQuickAdd} initialQuery={query} tabs={tabs} />;
}
