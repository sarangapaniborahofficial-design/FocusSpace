import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { Bold, Italic, Link2, List, ListChecks, ListOrdered, Quote, Strikethrough } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { sanitizeDoc } from '../lib/richtext';
import type { RichTextDoc } from '../types';

/**
 * True rich-text editing (TipTap/PzincMirror), scoped to what Pages needs: headings (2-3), paragraphs,
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
    editorProps: { attributes: { class: 'rt-pzinc', 'aria-label': 'Journal entry' } },
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

  if (!editor) return null;

  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 focus-within:border-zinc-300">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  );
}

const btn = (active: boolean) => `h-8 min-w-8 px-2 rounded-md text-sm grid place-items-center ${active ? 'bg-zinc-200 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-100'}`;

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL (http, https or mailto)', previous ?? 'https://');
    if (url === null) return;
    if (!url.trim()) { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-1 p-2 border-b border-zinc-100">
      <button type="button" title="Bold (Ctrl/⌘ B)" aria-label="Bold" aria-pressed={editor.isActive('bold')} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive('bold'))}><Bold size={14} /></button>
      <button type="button" title="Italic (Ctrl/⌘ I)" aria-label="Italic" aria-pressed={editor.isActive('italic')} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive('italic'))}><Italic size={14} /></button>
      <button type="button" title="Strikethrough" aria-label="Strikethrough" aria-pressed={editor.isActive('strike')} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive('strike'))}><Strikethrough size={14} /></button>
      <span className="w-px bg-zinc-100 mx-1" aria-hidden="true" />
      <button type="button" title="Heading" aria-label="Heading" aria-pressed={editor.isActive('heading', { level: 2 })} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`${btn(editor.isActive('heading', { level: 2 }))} font-semibold`}>H</button>
      <button type="button" title="Bulleted list" aria-label="Bulleted list" aria-pressed={editor.isActive('bulletList')} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive('bulletList'))}><List size={14} /></button>
      <button type="button" title="Numbered list" aria-label="Numbered list" aria-pressed={editor.isActive('orderedList')} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive('orderedList'))}><ListOrdered size={14} /></button>
      <button type="button" title="Checklist" aria-label="Checklist" aria-pressed={editor.isActive('taskList')} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleTaskList().run()} className={btn(editor.isActive('taskList'))}><ListChecks size={14} /></button>
      <button type="button" title="Quote" aria-label="Quote" aria-pressed={editor.isActive('blockquote')} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive('blockquote'))}><Quote size={14} /></button>
      <span className="w-px bg-zinc-100 mx-1" aria-hidden="true" />
      <button type="button" title="Link" aria-label="Link" aria-pressed={editor.isActive('link')} onMouseDown={e => e.preventDefault()} onClick={setLink} className={btn(editor.isActive('link'))}><Link2 size={14} /></button>
    </div>
  );
}
