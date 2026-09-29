import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart3, CalendarDays, CheckSquare2, FolderKanban, Home, Moon, Plus, Search, Settings, Timer, X, FileText, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { db } from '../db/db';
import { timer } from '../lib/timer';
import { richTextSnippet } from '../lib/richtext';
import type { Category, JournalEntry, Page, Task } from '../types';

interface Item {
  id: string;
  group: 'Actions' | 'Go to' | 'Pages' | 'Tasks';
  label: string;
  hint?: string;
  icon: LucideIcon;
  dot?: string;
  run: () => void;
}

const rank = (label: string, q: string) => (label.toLowerCase().startsWith(q) ? 0 : 1);

export function CommandPalette({ categories, onClose, onNavigate, onNewTask, onOpenTask, onOpenPage, onCycleTheme }: {
  categories: Category[];
  onClose: () => void;
  onNavigate: (view: string) => void;
  onNewTask: () => void;
  onOpenTask: (task: Task) => void;
  onOpenPage: (page: Page) => void;
  onCycleTheme: () => void;
}) {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const pages = useLiveQuery(() => db.pages.toArray(), []) ?? [];
  const journalEntries = useLiveQuery(() => db.journalEntries.toArray(), []) ?? [];
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base: Item[] = [
      { id: 'new', group: 'Actions', label: 'New task', hint: 'Ctrl N', icon: Plus, run: onNewTask },
      { id: 'timer', group: 'Actions', label: 'Start or pause timer', hint: 'Space', icon: Timer, run: () => timer.toggle() },
      { id: 'theme', group: 'Actions', label: 'Switch theme', icon: Moon, run: onCycleTheme },
      { id: 'home', group: 'Go to', label: 'Home / Master', icon: Home, run: () => onNavigate('home') },
      { id: 'calendar', group: 'Go to', label: 'Calendar', icon: CalendarDays, run: () => onNavigate('calendar') },
      { id: 'analytics', group: 'Go to', label: 'Analytics', icon: BarChart3, run: () => onNavigate('analytics') },
      { id: 'pages-home', group: 'Go to', label: 'Pages', icon: FileText, run: () => onNavigate('pages') },
      { id: 'settings', group: 'Go to', label: 'Settings', icon: Settings, run: () => onNavigate('settings') },
      ...categories.map<Item>(c => ({ id: `cat-${c.id}`, group: 'Go to', label: c.name, hint: 'Category', icon: FolderKanban, dot: c.color, run: () => onNavigate(c.id) })),
    ];
    const matched = q ? base.filter(i => i.label.toLowerCase().includes(q)).sort((a, b) => rank(a.label, q) - rank(b.label, q)) : base;
    const taskItems: Item[] = q
      ? tasks
          .filter(t => t.title.toLowerCase().includes(q) || (t.projectTag ?? '').toLowerCase().includes(q))
          .sort((a, b) => rank(a.title, q) - rank(b.title, q))
          .slice(0, 8)
          .map(t => ({ id: `task-${t.id}`, group: 'Tasks', label: t.title, hint: categories.find(c => c.id === t.categoryId)?.name, icon: CheckSquare2, run: () => onOpenTask(t) }))
      : [];
    const entriesByPage = new Map<string, JournalEntry[]>();
    journalEntries.forEach(e => entriesByPage.set(e.pageId, [...(entriesByPage.get(e.pageId) ?? []), e]));
    const matchesEntry = (p: Page) => (entriesByPage.get(p.id) ?? []).some(e => e.plainText.toLowerCase().includes(q));
    const pageItems: Item[] = q
      ? pages
          .filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || matchesEntry(p))
          .sort((a, b) => rank(a.title, q) - rank(b.title, q) || b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, 6)
          .map(p => ({ id: `page-${p.id}`, group: 'Pages', label: p.title.trim() || 'Untitled', hint: categories.find(c => c.id === p.categoryId)?.name ?? richTextSnippet(entriesByPage.get(p.id)?.[0]?.content ?? { type: 'doc', content: [] }, 24), icon: FileText, run: () => onOpenPage(p) }))
      : [];
    // Keep groups together in a stable order so the highlighted row matches what is drawn.
    const order = { Actions: 0, 'Go to': 1, Pages: 2, Tasks: 3 } as const;
    return [...matched, ...pageItems, ...taskItems].sort((a, b) => order[a.group] - order[b.group]);
  }, [query, tasks, pages, journalEntries, categories, onNavigate, onNewTask, onOpenTask, onOpenPage, onCycleTheme]);

  useEffect(() => { setSelected(0); }, [query]);
  useEffect(() => { listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [selected, items]);

  const run = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => (items.length ? (s + 1) % items.length : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => (items.length ? (s - 1 + items.length) % items.length : 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(items[selected]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <div className="fade-in fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-center items-start pt-[10vh] p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Search and commands" className="pop-in w-full max-w-xl rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden" onMouseDown={e => e.stopPropagation()}>
        <div className="p-4 flex items-center gap-3 border-b border-zinc-100">
          <Search size={17} className="text-zinc-300" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search tasks and pages, jump to a view, run a command…"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <button onClick={onClose} aria-label="Close"><X size={17} className="text-zinc-300" /></button>
        </div>
        <div ref={listRef} id="palette-list" role="listbox" className="p-2 max-h-[52vh] overflow-y-auto">
          {items.length === 0 && <div className="px-3 py-8 text-center text-sm text-zinc-300">Nothing matches “{query.trim()}”.</div>}
          {items.map((item, i) => {
            const Icon = item.icon;
            const heading = i === 0 || items[i - 1].group !== item.group;
            return (
              <div key={item.id}>
                {heading && <div className="px-3 pt-3 pb-1 text-[11px] text-zinc-300">{item.group}</div>}
                <button
                  role="option"
                  aria-selected={i === selected}
                  data-selected={i === selected}
                  onMouseMove={() => setSelected(i)}
                  onClick={() => run(item)}
                  className={`w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg text-sm ${i === selected ? 'bg-zinc-100 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}
                >
                  {item.dot ? <span className="size-2 rounded-full shrink-0 mx-[3px]" style={{ background: item.dot }} /> : <Icon size={15} className="shrink-0 text-zinc-400" />}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="text-xs text-zinc-300 shrink-0">{item.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-2.5 border-t border-zinc-100 text-[11px] text-zinc-300 flex gap-4">
          <span>↑↓ to move</span><span>Enter to select</span><span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
