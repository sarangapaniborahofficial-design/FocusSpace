import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart3, BookOpen, CalendarDays, CheckSquare2, ExternalLink, FolderKanban, Home, Keyboard, Moon, Plus, Search, Settings, Sparkles, Timer, Trophy, X, FileText, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { db } from '../db/db';
import { timer } from '../lib/timer';
import { launchTarget } from '../lib/launcher';
import { storage } from '../lib/utils';
import { richTextSnippet } from '../lib/richtext';
import { DAILY_JOURNAL_PAGE_ID } from '../lib/journalAutoSave';
import type { Category, JournalEntry, LaunchLink, Page, Task } from '../types';

interface Item {
  id: string;
  group: 'Actions' | 'Go to' | 'Apps & Workspaces' | 'Pages' | 'Tasks';
  label: string;
  hint?: string;
  icon: LucideIcon;
  dot?: string;
  run: () => void;
}

const rank = (label: string, q: string) => (label.toLowerCase().startsWith(q) ? 0 : 1);

export function CommandPalette({ categories, onClose, onNavigate, onNewTask, onOpenTask, onOpenPage, onCycleTheme, onOpenShortcuts, onReplayWelcome }: {
  categories: Category[];
  onClose: () => void;
  onNavigate: (view: string) => void;
  onNewTask: () => void;
  onOpenTask: (task: Task) => void;
  onOpenPage: (page: Page) => void;
  onCycleTheme: () => void;
  onOpenShortcuts?: () => void;
  onReplayWelcome?: () => void;
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
      ...(onReplayWelcome ? [{ id: 'welcome-tour', group: 'Actions' as const, label: 'Welcome Tour & Philosophy', icon: Sparkles, run: () => { onClose(); onReplayWelcome(); } }] : []),
      ...(onOpenShortcuts ? [{ id: 'shortcuts', group: 'Actions' as const, label: 'Keyboard shortcuts', hint: 'Ctrl /', icon: Keyboard, run: () => { onClose(); onOpenShortcuts(); } }] : []),
      { id: 'home', group: 'Go to', label: 'Home / Master', icon: Home, run: () => onNavigate('home') },
      { id: 'calendar', group: 'Go to', label: 'Calendar', icon: CalendarDays, run: () => onNavigate('calendar') },
      { id: 'journal', group: 'Go to', label: 'Daily Journal', hint: 'Ctrl J', icon: BookOpen, run: () => onNavigate('journal') },
      { id: 'review', group: 'Go to', label: 'Weekly Review', icon: Trophy, run: () => onNavigate('review') },
      { id: 'analytics', group: 'Go to', label: 'Analytics', icon: BarChart3, run: () => onNavigate('analytics') },
      { id: 'pages-home', group: 'Go to', label: 'Knowledge Pages', icon: FileText, run: () => onNavigate('pages') },
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
          .filter(p => p.id !== DAILY_JOURNAL_PAGE_ID && p.title.toLowerCase().trim() !== 'daily journal' && (p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || matchesEntry(p)))
          .sort((a, b) => rank(a.title, q) - rank(b.title, q) || b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, 6)
          .map(p => ({ id: `page-${p.id}`, group: 'Pages', label: p.title.trim() || 'Untitled', hint: categories.find(c => c.id === p.categoryId)?.name ?? richTextSnippet(entriesByPage.get(p.id)?.[0]?.content ?? { type: 'doc', content: [] }, 24), icon: FileText, run: () => onOpenPage(p) }))
      : [];
    const allLinksMap = new Map<string, LaunchLink>();
    categories.forEach(c => (c.launchLinks ?? []).forEach(l => allLinksMap.set(`${l.label}-${l.url}`, l)));
    tasks.forEach(t => (t.launchLinks ?? []).forEach(l => allLinksMap.set(`${l.label}-${l.url}`, l)));
    try {
      const saved = storage.get('focusspace-global-appdock');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) parsed.forEach((l: LaunchLink) => allLinksMap.set(`${l.label}-${l.url}`, l));
      }
    } catch { /* fallback */ }

    const appItems: Item[] = q
      ? Array.from(allLinksMap.values())
          .filter(l => l.label.toLowerCase().includes(q) || l.url.toLowerCase().includes(q))
          .sort((a, b) => rank(a.label, q) - rank(b.label, q))
          .slice(0, 5)
          .map(l => ({
            id: `launch-${l.id}`,
            group: 'Apps & Workspaces',
            label: `Launch ${l.label}`,
            hint: l.url,
            icon: ExternalLink,
            run: () => launchTarget(l.url, l.label),
          }))
      : [];

    // Keep groups together in a stable order so the highlighted row matches what is drawn.
    const order = { Actions: 0, 'Go to': 1, 'Apps & Workspaces': 2, Pages: 3, Tasks: 4 } as const;
    return [...matched, ...appItems, ...pageItems, ...taskItems].sort((a, b) => order[a.group] - order[b.group]);
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
      <div role="dialog" aria-modal="true" aria-label="Search and commands" className="pop-in w-full max-w-xl rounded-2xl border border-line bg-surface shadow-2xl overflow-hidden" onMouseDown={e => e.stopPropagation()}>
        <div className="p-4 flex items-center gap-3 border-b border-line">
          <Search size={17} className="text-fg-subtle" />
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
          <button onClick={onClose} aria-label="Close"><X size={17} className="text-fg-subtle" /></button>
        </div>
        <div ref={listRef} id="palette-list" role="listbox" className="p-2 max-h-[52vh] overflow-y-auto">
          {items.length === 0 && <div className="px-3 py-8 text-center text-sm text-fg-subtle">Nothing matches “{query.trim()}”.</div>}
          {items.map((item, i) => {
            const Icon = item.icon;
            const heading = i === 0 || items[i - 1].group !== item.group;
            return (
              <div key={item.id}>
                {heading && <div className="px-3 pt-3 pb-1 text-[11px] text-fg-subtle">{item.group}</div>}
                <button
                  role="option"
                  aria-selected={i === selected}
                  data-selected={i === selected}
                  onMouseMove={() => setSelected(i)}
                  onClick={() => run(item)}
                  className={`w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg text-sm ${i === selected ? 'bg-inv text-on-inv' : 'text-fg-soft hover:bg-hover'}`}
                >
                  {item.dot ? <span className="size-2 rounded-full shrink-0 mx-[3px]" style={{ background: item.dot }} /> : <Icon size={15} className="shrink-0 text-fg-muted" />}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="text-xs text-fg-subtle shrink-0">{item.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-2.5 border-t border-line text-[11px] text-fg-subtle flex gap-4">
          <span>↑↓ to move</span><span>Enter to select</span><span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
