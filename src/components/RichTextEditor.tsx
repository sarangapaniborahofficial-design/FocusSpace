import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { Bold, Italic, Link2, List, ListChecks, ListOrdered, Quote, Strikethrough, X, FileText, CheckSquare, Flame, Target } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { addLink } from '../lib/pageLinks';
import { sanitizeDoc } from '../lib/richtext';
import type { RichTextDoc } from '../types';
import { useDictation } from '../voice/useDictation';
import { createTipTapTarget } from '../voice/target/tiptapTarget';
import type { DictationTarget } from '../voice/target/DictationTarget';
import { MicButton } from '../voice/ui/MicButton';
import { DictationHud } from '../voice/ui/DictationHud';

/**
 * True rich-text editing (TipTap/ProseMirror), scoped to what Pages needs: headings (2-3), paragraphs,
 * bullet/ordered/task lists, blockquotes, bold/italic/strike/code, links. No tables, images or custom
 * blocks — kept deliberately small per the Pages design (this stays a note editor, not a page builder).
 */

const extensions = [
  StarterKit.configure({ heading: { levels: [2, 3] } }),
  Link.configure({ openOnClick: false, autolink: false, protocols: ['http', 'https', 'mailto'] }),
  TaskList,
  TaskItem.configure({ nested: false }),
];

export interface AutocompleteItem {
  id: string;
  title: string;
  kind: 'page' | 'task' | 'habit' | 'goal';
  subtitle?: string;
}

export function RichTextEditor({ content, onChange, placeholder = 'Write today’s entry…', autoFocus = false, pageId }: {
  content: RichTextDoc;
  onChange: (doc: RichTextDoc) => void;
  placeholder?: string;
  autoFocus?: boolean;
  pageId?: string;
}) {
  const lastEmitted = useRef<string | null>(null);

  const allPages = useLiveQuery(() => db.pages.toArray(), []) ?? [];
  const allTasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const allHabits = useLiveQuery(() => db.habits.toArray(), []) ?? [];
  const allGoals = useLiveQuery(() => db.goals.toArray(), []) ?? [];

  const [autocompleteState, setAutocompleteState] = useState<{
    trigger: '@' | '[[';
    query: string;
    from: number;
    to: number;
    selectedIndex: number;
  } | null>(null);

  const autocompleteRef = useRef<{ selectedIndex: number; matches: AutocompleteItem[] } | null>(null);

  const matches: AutocompleteItem[] = useMemo(() => {
    if (!autocompleteState) return [];
    const q = autocompleteState.query.trim().toLowerCase();
    const trigger = autocompleteState.trigger;
    const list: AutocompleteItem[] = [];

    if (trigger === '[[') {
      for (const p of allPages) {
        if (pageId && p.id === pageId) continue;
        if (!q || p.title.toLowerCase().includes(q)) {
          list.push({ id: p.id, title: p.title || 'Untitled Page', kind: 'page', subtitle: 'Knowledge Page' });
        }
      }
      for (const t of allTasks) {
        if (!q || t.title.toLowerCase().includes(q)) {
          list.push({ id: t.id, title: t.title, kind: 'task', subtitle: 'Task' });
        }
      }
    } else {
      for (const t of allTasks) {
        if (!q || t.title.toLowerCase().includes(q)) {
          list.push({ id: t.id, title: t.title, kind: 'task', subtitle: 'Task' });
        }
      }
      for (const h of allHabits) {
        if (!q || h.name.toLowerCase().includes(q)) {
          list.push({ id: h.id, title: h.name, kind: 'habit', subtitle: 'Habit' });
        }
      }
      for (const g of allGoals) {
        if (!q || g.title.toLowerCase().includes(q)) {
          list.push({ id: g.id, title: g.title, kind: 'goal', subtitle: 'Goal' });
        }
      }
      for (const p of allPages) {
        if (pageId && p.id === pageId) continue;
        if (!q || p.title.toLowerCase().includes(q)) {
          list.push({ id: p.id, title: p.title || 'Untitled Page', kind: 'page', subtitle: 'Knowledge Page' });
        }
      }
    }

    return list.slice(0, 8);
  }, [autocompleteState, allPages, allTasks, allHabits, allGoals, pageId]);

  autocompleteRef.current = autocompleteState ? { selectedIndex: autocompleteState.selectedIndex, matches } : null;

  const checkAutocomplete = (ed: Editor) => {
    const { from, to } = ed.state.selection;
    if (from !== to) {
      setAutocompleteState(null);
      return;
    }
    const textBefore = ed.state.doc.textBetween(Math.max(0, from - 50), from, '\n');
    const match = textBefore.match(/(?:^|\s)(@|\[\[)([^@\[\]\n]*)$/);
    if (!match) {
      setAutocompleteState(null);
      return;
    }
    const trigger = match[1] as '@' | '[[';
    const query = match[2];
    const matchStart = from - trigger.length - query.length;
    setAutocompleteState(prev => ({
      trigger,
      query,
      from: matchStart,
      to: from,
      selectedIndex: prev?.query === query ? prev.selectedIndex : 0,
    }));
  };

  const applyAutocompleteItem = (item: AutocompleteItem) => {
    if (!editor || !autocompleteState) return;
    const { from, to, trigger } = autocompleteState;
    let label = '';
    let href = '';
    if (item.kind === 'page') {
      label = trigger === '[[' ? `[[${item.title}]]` : `@${item.title}`;
      href = `#page:${item.id}`;
    } else if (item.kind === 'task') {
      label = `@${item.title}`;
      href = `#task:${item.id}`;
    } else if (item.kind === 'habit') {
      label = `@${item.title}`;
      href = `#habit:${item.id}`;
    } else if (item.kind === 'goal') {
      label = `@${item.title}`;
      href = `#goal:${item.id}`;
    }

    editor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContent([
        {
          type: 'text',
          text: label,
          marks: [{ type: 'link', attrs: { href } }],
        },
        { type: 'text', text: ' ' },
      ])
      .run();

    if (pageId && item.id !== pageId) {
      void addLink(pageId, item.kind, item.id);
    }

    setAutocompleteState(null);
  };

  const editor = useEditor({
    extensions,
    content: content as object,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: { class: 'rt-prose', 'aria-label': 'Journal entry' },
      handleKeyDown: (_view, event) => {
        if (!autocompleteRef.current) return false;
        const { selectedIndex, matches: currentMatches } = autocompleteRef.current;
        if (!currentMatches.length) return false;

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setAutocompleteState(prev => prev ? { ...prev, selectedIndex: (prev.selectedIndex + 1) % currentMatches.length } : null);
          return true;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setAutocompleteState(prev => prev ? { ...prev, selectedIndex: (prev.selectedIndex - 1 + currentMatches.length) % currentMatches.length } : null);
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          const target = currentMatches[selectedIndex % currentMatches.length];
          if (target) {
            applyAutocompleteItem(target);
            return true;
          }
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setAutocompleteState(null);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const doc = sanitizeDoc(ed.getJSON());
      lastEmitted.current = JSON.stringify(doc);
      onChange(doc);
      checkAutocomplete(ed);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      checkAutocomplete(ed);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const incoming = JSON.stringify(content);
    if (incoming === lastEmitted.current) return;
    if (incoming !== JSON.stringify(editor.getJSON())) editor.commands.setContent(content as object, { emitUpdate: false });
  }, [editor, content]);

  const [tiptapTarget, setTiptapTarget] = useState<DictationTarget | null>(null);

  useEffect(() => {
    if (editor) {
      setTiptapTarget(createTipTapTarget(editor));
    }
  }, [editor]);

  const dictation = useDictation({ target: tiptapTarget });

  if (!editor) return null;

  return (
    <div className="rounded-xl border border-line bg-surface-2 focus-within:border-accent relative">
      <Toolbar editor={editor} dictation={dictation} />
      <EditorContent editor={editor} placeholder={placeholder} />

      {/* Inline @ or [[ Wiki-Link Autocomplete Dropdown */}
      {autocompleteState && matches.length > 0 && (
        <div className="absolute z-40 top-12 left-3 w-80 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface shadow-2xl p-1.5 space-y-0.5 pop-in">
          <div className="px-2 py-1 text-[10px] font-semibold tracking-wider uppercase text-fg-subtle border-b border-line/50 mb-1 flex items-center justify-between">
            <span>Link {autocompleteState.trigger === '[[' ? 'Wiki Page' : 'Reference'}</span>
            <span className="font-mono text-[9px] text-fg-subtle">↑↓ navigate · ↵ select</span>
          </div>
          {matches.map((item, idx) => {
            const isSelected = idx === (autocompleteState.selectedIndex % matches.length);
            return (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyAutocompleteItem(item);
                }}
                className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 text-xs transition cursor-pointer ${
                  isSelected ? 'bg-accent/15 text-accent-text font-medium' : 'text-fg-soft hover:bg-hover'
                }`}
              >
                <span className="shrink-0 opacity-80">
                  {item.kind === 'page' && <FileText size={13} className="text-sky-500" />}
                  {item.kind === 'task' && <CheckSquare size={13} className="text-emerald-500" />}
                  {item.kind === 'habit' && <Flame size={13} className="text-amber-500" />}
                  {item.kind === 'goal' && <Target size={13} className="text-purple-500" />}
                </span>
                <span className="truncate flex-1 font-medium">{item.title}</span>
                <span className="text-[10px] text-fg-subtle font-mono uppercase shrink-0">
                  {item.subtitle}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <DictationHud
        state={dictation.state}
        audioLevel={dictation.audioLevel}
        modelProgress={dictation.modelProgress}
        onStop={dictation.stop}
      />
    </div>
  );
}

const btn = (active: boolean) => `h-8 min-w-8 px-2 rounded-md text-sm grid place-items-center ${active ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:text-fg hover:bg-hover'}`;

function Toolbar({ editor, dictation }: { editor: Editor; dictation: ReturnType<typeof useDictation> }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const openLinkDialog = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    setLinkUrl(previous ?? 'https://');
    setLinkOpen(true);
  };

  const applyLink = () => {
    if (!linkUrl.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl.trim() }).run();
    }
    setLinkOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
    setLinkOpen(false);
  };

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1 p-2 border-b border-line relative">
      <button type="button" title="Bold (Ctrl/⌘ B)" aria-label="Bold" aria-pressed={editor.isActive('bold')} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive('bold'))}><Bold size={14} /></button>
      <button type="button" title="Italic (Ctrl/⌘ I)" aria-label="Italic" aria-pressed={editor.isActive('italic')} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive('italic'))}><Italic size={14} /></button>
      <button type="button" title="Strikethrough" aria-label="Strikethrough" aria-pressed={editor.isActive('strike')} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive('strike'))}><Strikethrough size={14} /></button>
      <span className="w-px bg-surface-2 mx-1 h-5" aria-hidden="true" />
      <button type="button" title="Heading" aria-label="Heading" aria-pressed={editor.isActive('heading', { level: 2 })} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`${btn(editor.isActive('heading', { level: 2 }))} font-semibold`}>H</button>
      <button type="button" title="Bulleted list" aria-label="Bulleted list" aria-pressed={editor.isActive('bulletList')} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive('bulletList'))}><List size={14} /></button>
      <button type="button" title="Numbered list" aria-label="Numbered list" aria-pressed={editor.isActive('orderedList')} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive('orderedList'))}><ListOrdered size={14} /></button>
      <button type="button" title="Checklist" aria-label="Checklist" aria-pressed={editor.isActive('taskList')} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleTaskList().run()} className={btn(editor.isActive('taskList'))}><ListChecks size={14} /></button>
      <button type="button" title="Quote" aria-label="Quote" aria-pressed={editor.isActive('blockquote')} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive('blockquote'))}><Quote size={14} /></button>
      <span className="w-px bg-surface-2 mx-1 h-5" aria-hidden="true" />
      <button type="button" title="Link" aria-label="Link" aria-pressed={editor.isActive('link')} onMouseDown={e => e.preventDefault()} onClick={openLinkDialog} className={btn(editor.isActive('link'))}><Link2 size={14} /></button>

      {linkOpen && (
        <div className="pop-in absolute z-30 top-12 left-2 flex items-center gap-1.5 p-1.5 rounded-xl border border-line bg-surface shadow-pop keycap">
          <input
            type="url"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
              if (e.key === 'Escape') { e.preventDefault(); setLinkOpen(false); }
            }}
            placeholder="https://example.com"
            autoFocus
            className="h-8 px-2.5 text-xs rounded-lg bg-surface-2 border border-line outline-none focus:border-accent w-56 font-mono text-fg"
          />
          <button type="button" onClick={applyLink} className="h-8 px-3 rounded-lg bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover keycap">Apply</button>
          {editor.isActive('link') && (
            <button type="button" onClick={removeLink} className="h-8 px-2 rounded-lg text-rose-500 hover:bg-rose-500/10 text-xs">Unlink</button>
          )}
          <button type="button" onClick={() => setLinkOpen(false)} aria-label="Close" className="size-8 grid place-items-center rounded-lg text-fg-muted hover:text-fg hover:bg-hover"><X size={14} /></button>
        </div>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <MicButton
          size="sm"
          state={dictation.state}
          onClick={dictation.toggle}
          title="Dictate into editor offline (Voice commands: 'scratch that' to undo, 'new line')"
        />
      </div>
    </div>
  );
}
