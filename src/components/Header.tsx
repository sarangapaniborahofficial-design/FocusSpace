import { Menu, Moon, Plus, Search, Sun } from 'lucide-react';

const THEME_LABEL: Record<string, string> = { dark: 'Dark', oled: 'OLED black', light: 'Light' };

export function Header({ title, onMenu, onQuickAdd, onSearch, theme, setTheme }: {
  title: string; onMenu: () => void; onQuickAdd: () => void; onSearch: () => void; theme: string; setTheme: (v: string) => void;
}) {
  const next = theme === 'dark' ? 'oled' : theme === 'oled' ? 'light' : 'dark';
  return (
    <header className="h-16 shrink-0 border-b border-line flex items-center justify-between gap-3 px-3 sm:px-5 bg-surface/80 backdrop-blur-xl sticky top-0 z-30">
      <div className="flex items-center gap-2 text-sm text-fg-muted min-w-0">
        <button onClick={onMenu} aria-label="Open navigation" className="md:hidden size-9 grid place-items-center rounded-lg text-fg-muted hover:text-fg hover:bg-hover -ml-1"><Menu size={18} /></button>
        <span className="hidden sm:inline">Workspace</span>
        <span className="hidden sm:inline text-fg-subtle">/</span>
        <span className="text-fg-soft truncate">{title}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onSearch} aria-label="Search and commands" className="hidden md:flex items-center gap-2 h-8 px-3 rounded-xl border border-line bg-surface-2 text-fg-muted hover:text-fg hover:border-line text-sm">
          <Search size={15} /><span>Search</span><kbd className="ml-4 text-[10px] border border-line rounded px-1.5 py-0.5">Ctrl K</kbd>
        </button>
        <button onClick={onSearch} aria-label="Search and commands" className="md:hidden size-9 grid place-items-center rounded-lg border border-line text-fg-muted hover:text-fg hover:bg-hover"><Search size={16} /></button>
        <button onClick={onQuickAdd} aria-label="Quick add task" className="h-8 px-3 rounded-xl bg-accent text-accent-fg hover:bg-accent-hover text-sm font-medium flex items-center gap-1.5"><Plus size={16} /> <span className="hidden sm:inline">Quick Add</span></button>
        <button title={`Theme: ${THEME_LABEL[theme] ?? theme}. Switch to ${THEME_LABEL[next]}`} aria-label={`Theme: ${THEME_LABEL[theme] ?? theme}. Switch to ${THEME_LABEL[next]}`} onClick={() => setTheme(next)} className="size-9 grid place-items-center rounded-lg border border-line text-fg-muted hover:text-fg hover:bg-hover">
          {theme === 'light' ? <Sun size={16} /> : <Moon size={16} fill={theme === 'oled' ? 'currentColor' : 'none'} />}
        </button>
      </div>
    </header>
  );
}
