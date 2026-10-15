import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { Bold, Italic, Link2, List, ListChecks, ListOrdered, Quote, Strikethrough, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
 *
 * Written against TipTap v2's documented API. Unlike the rest of this app's logic, this file could not
 * be run or tested in the build sandbox (no network access to install the package) — it's the one place
 * that needs a real hands-on check after `npm install`.
 */

const extensions = [
  StarterKit.configure({ heading: { levels: [2, 3] } }),
  Link.configure({ openOnClick: false, autolink: false, protocols: ['http', 'https', 'mailto'] }),
  TaskList,
  TaskItem.configure({ nested: false }),
];

export function RichTextEditor({ content, onChange, placeholder = 'Write today’s entry…', autoFocus = false }: {
  content: RichTextDoc;
  onChange: (doc: RichTextDoc) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  // Only the parent decides when an incoming `content` prop should overwrite the editor (see the effect
  // below); the editor's own keystrokes must never be clobbered by that same prop bouncing back.
  const lastEmitted = useRef<string | null>(null);

  const editor = useEditor({
    extensions,
    content: content as object,
    autofocus: autoFocus ? 'end' : false,
    editorProps: { attributes: { class: 'rt-prose', 'aria-label': 'Journal entry' } },
    onUpdate: ({ editor }) => {
      const doc = sanitizeDoc(editor.getJSON());
      lastEmitted.current = JSON.stringify(doc);
      onChange(doc);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const incoming = JSON.stringify(content);
    if (incoming === lastEmitted.current) return; // this is our own change coming back around; ignore it
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
