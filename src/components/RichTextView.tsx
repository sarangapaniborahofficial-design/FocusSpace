import { Fragment, type ReactNode } from 'react';
import { toggleTaskAtPath } from '../lib/richtext';
import type { RichMark, RichTextDoc, RichTextNode } from '../types';

const HEADING_CLASS: Record<number, string> = { 1: 'text-2xl font-semibold tracking-tight mt-6 mb-2', 2: 'text-xl font-semibold tracking-tight mt-6 mb-2', 3: 'text-base font-semibold mt-5 mb-1.5' };

function renderMarks(text: string, marks: RichMark[] | undefined, key: number): ReactNode {
  if (!marks?.length) return <Fragment key={key}>{text}</Fragment>;
  return marks.reduce<ReactNode>((child, mark, i) => {
    switch (mark.type) {
      case 'bold': return <strong key={i} className="font-semibold text-zinc-900 dark:text-zinc-100">{child}</strong>;
      case 'italic': return <em key={i}>{child}</em>;
      case 'strike': return <del key={i} className="text-zinc-400 dark:text-zinc-500">{child}</del>;
      case 'code': return <code key={i} className="md-code-inline">{child}</code>;
      case 'link': return <a key={i} href={mark.attrs?.href} target="_blank" rel="noopener noreferrer" className="text-sky-600 dark:text-sky-400 underline underline-offset-2 hover:text-sky-200 break-words">{child}</a>;
      default: return child;
    }
  }, <Fragment key={key}>{text}</Fragment>);
}

function renderInline(nodes: RichTextNode[] | undefined): ReactNode {
  if (!nodes) return null;
  return nodes.map((n, i) => (n.type === 'hardBreak' ? <br key={i} /> : renderMarks(n.text ?? '', n.marks, i)));
}

function renderNode(node: RichTextNode, i: number, onToggleTask?: (path: [number, number]) => void): ReactNode {
  switch (node.type) {
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 2));
      const Tag = (`h${level + 1}` as 'h2' | 'h3' | 'h4'); // the page's own title fills the role of h1
      return <Tag key={i} className={HEADING_CLASS[level]}>{renderInline(node.content)}</Tag>;
    }
    case 'paragraph':
      return node.content?.length ? <p key={i} className="my-2 leading-relaxed break-words">{renderInline(node.content)}</p> : <p key={i} className="my-2 h-[1lh]" aria-hidden="true" />;
    case 'blockquote':
      return <blockquote key={i} className="my-3 border-l-2 border-zinc-200/60 dark:border-zinc-800/60 pl-4 text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 leading-relaxed">{node.content?.map((c, j) => renderNode(c, j))}</blockquote>;
    case 'horizontalRule':
      return <hr key={i} className="my-5 border-zinc-200/60 dark:border-zinc-800/60/60 dark:border-zinc-800/60" />;
    case 'codeBlock':
      return <pre key={i} className="md-code-block my-3"><code>{node.content?.map(c => c.text).join('') ?? ''}</code></pre>;
    case 'bulletList':
    case 'orderedList':
      return (
        <div key={i} className="my-2 space-y-1" role="list">
          {node.content?.map((item, j) => (
            <div key={j} className="flex items-start gap-2 leading-relaxed">
              <span className="shrink-0 w-4 text-right text-zinc-400 dark:text-zinc-500 select-none">{node.type === 'orderedList' ? `${j + 1}.` : '•'}</span>
              <span className="min-w-0 break-words">{item.content?.map((c, k) => renderNode(c, k))}</span>
            </div>
          ))}
        </div>
      );
    case 'taskList':
      return (
        <div key={i} className="my-2 space-y-1" role="list">
          {node.content?.map((item, j) => {
            const checked = item.attrs?.checked === true;
            return (
              <div key={j} role="listitem" className="flex items-start gap-2 leading-relaxed">
                <button
                  type="button" onClick={() => onToggleTask?.([i, j])} disabled={!onToggleTask}
                  aria-label={checked ? 'Mark as not done' : 'Mark as done'} aria-pressed={checked}
                  className={`mt-[5px] size-4 shrink-0 rounded border grid place-items-center text-[10px] leading-none ${checked ? 'bg-zinc-600 border-zinc-600 text-white' : 'border-zinc-300 hover:border-zinc-500'}`}
                >{checked ? '✓' : ''}</button>
                <span className={`min-w-0 break-words ${checked ? 'line-through text-zinc-400 dark:text-zinc-500' : ''}`}>{item.content?.map((c, k) => renderNode(c, k))}</span>
              </div>
            );
          })}
        </div>
      );
    default:
      return null;
  }
}

/** Read-only renderer for a rich-text (PzincMirror/TipTap JSON) document. Never uses raw HTML. */
export { toggleTaskAtPath };

export function RichTextView({ doc, onToggleTask }: { doc: RichTextDoc; onToggleTask?: (path: [number, number]) => void }) {
  return <div className="text-[15px] text-zinc-600 dark:text-zinc-300 dark:text-zinc-500">{doc.content.map((node, i) => renderNode(node, i, onToggleTask))}</div>;
}

