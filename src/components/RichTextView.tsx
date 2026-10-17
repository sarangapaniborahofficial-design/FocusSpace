import { Fragment, type ReactNode } from 'react';
import { toggleTaskAtPath } from '../lib/richtext';
import type { RichMark, RichTextDoc, RichTextNode } from '../types';

const HEADING_CLASS: Record<number, string> = { 1: 'text-2xl font-semibold tracking-tight mt-6 mb-2', 2: 'text-xl font-semibold tracking-tight mt-6 mb-2', 3: 'text-base font-semibold mt-5 mb-1.5' };

function renderMarks(text: string, marks: RichMark[] | undefined, key: number): ReactNode {
  if (!marks?.length) return <Fragment key={key}>{text}</Fragment>;
  return marks.reduce<ReactNode>((child, mark, i) => {
    switch (mark.type) {
      case 'bold': return <strong key={i} className="font-semibold text-fg">{child}</strong>;
      case 'italic': return <em key={i}>{child}</em>;
      case 'strike': return <del key={i} className="text-fg-muted">{child}</del>;
      case 'link': {
        const href = mark.attrs?.href || '';
        if (href.startsWith('#page:')) {
          const targetPageId = href.replace('#page:', '');
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('focusspace:navigate-page', { detail: { pageId: targetPageId } }));
              }}
              className="inline-flex items-center gap-1 font-medium text-accent hover:underline decoration-accent underline-offset-2 px-1.5 py-0.5 rounded bg-accent/10 hover:bg-accent/20 transition-colors cursor-pointer"
              title="Open linked knowledge page"
            >
              <span className="text-[11px] opacity-70">📄</span>
              {child}
            </button>
          );
        }
        if (href.startsWith('#task:')) {
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 font-medium text-fg-soft px-1.5 py-0.5 rounded bg-surface-2 border border-line text-xs"
            >
              <span className="text-[10px] opacity-70">☑</span>
              {child}
            </span>
          );
        }
        if (href.startsWith('#habit:')) {
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 font-medium text-amber-500 px-1.5 py-0.5 rounded bg-amber-500/10 text-xs"
            >
              <span className="text-[10px]">🔥</span>
              {child}
            </span>
          );
        }
        return <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-sky-600 underline underline-offset-2 hover:text-sky-200 break-words">{child}</a>;
      }
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
      return <blockquote key={i} className="my-3 border-l-2 border-line pl-4 text-fg-muted leading-relaxed">{node.content?.map((c, j) => renderNode(c, j))}</blockquote>;
    case 'horizontalRule':
      return <hr key={i} className="my-5 border-line" />;
    case 'codeBlock':
      return <pre key={i} className="md-code-block my-3"><code>{node.content?.map(c => c.text).join('') ?? ''}</code></pre>;
    case 'bulletList':
    case 'orderedList':
      return (
        <div key={i} className="my-2 space-y-1" role="list">
          {node.content?.map((item, j) => (
            <div key={j} className="flex items-start gap-2 leading-relaxed">
              <span className="shrink-0 w-4 text-right text-fg-muted select-none">{node.type === 'orderedList' ? `${j + 1}.` : '•'}</span>
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
                  className={`mt-[5px] size-4 shrink-0 rounded border grid place-items-center text-[10px] leading-none ${checked ? 'bg-accent border-accent text-accent-fg' : 'border-line-strong hover:border-fg-muted'}`}
                >{checked ? '✓' : ''}</button>
                <span className={`min-w-0 break-words ${checked ? 'line-through text-fg-muted' : ''}`}>{item.content?.map((c, k) => renderNode(c, k))}</span>
              </div>
            );
          })}
        </div>
      );
    default:
      return null;
  }
}

/** Read-only renderer for a rich-text (ProseMirror/TipTap JSON) document. Never uses raw HTML. */
export { toggleTaskAtPath };

export function RichTextView({ doc, onToggleTask }: { doc: RichTextDoc; onToggleTask?: (path: [number, number]) => void }) {
  return <div className="text-[15px] text-fg-soft">{doc.content.map((node, i) => renderNode(node, i, onToggleTask))}</div>;
}

