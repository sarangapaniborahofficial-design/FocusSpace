import { Fragment, type ReactNode } from 'react';
import { parseInline, parseMarkdown, type Block, type Inline } from '../lib/markdown';

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((n, i) => {
    switch (n.t) {
      case 'text': return <Fragment key={i}>{n.v}</Fragment>;
      case 'br': return <br key={i} />;
      case 'code': return <code key={i} className="md-code-inline">{n.v}</code>;
      case 'strong': return <strong key={i} className="font-semibold text-fg">{renderInline(n.c)}</strong>;
      case 'em': return <em key={i}>{renderInline(n.c)}</em>;
      case 'del': return <del key={i} className="text-fg-muted">{renderInline(n.c)}</del>;
      case 'link': return <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" className="text-sky-600 underline underline-offset-2 hover:text-sky-500 break-words">{renderInline(n.c)}</a>;
    }
  });
}

const inline = (text: string) => renderInline(parseInline(text));
const HEADING_CLASS = ['', 'text-2xl font-semibold tracking-tight mt-6 mb-2', 'text-xl font-semibold tracking-tight mt-6 mb-2', 'text-base font-semibold mt-5 mb-1.5', 'text-sm font-semibold uppercase tracking-wide text-fg-muted mt-5 mb-1.5'];

function renderBlock(block: Block, i: number, onToggleTask?: (line: number) => void) {
  switch (block.type) {
    case 'heading': {
      const Tag = (`h${Math.min(4, block.level + 1)}` as 'h2' | 'h3' | 'h4'); // page title is the h1
      return <Tag key={i} className={HEADING_CLASS[block.level]}>{inline(block.text)}</Tag>;
    }
    case 'paragraph': return <p key={i} className="my-2 leading-relaxed break-words">{inline(block.text)}</p>;
    case 'quote': return <blockquote key={i} className="my-3 border-l-2 border-line pl-4 text-fg-muted leading-relaxed">{inline(block.text)}</blockquote>;
    case 'rule': return <hr key={i} className="my-5 border-line" />;
    case 'code': return <pre key={i} className="md-code-block my-3"><code>{block.text}</code></pre>;
    case 'list':
      return (
        <div key={i} className="my-2 space-y-1" role="list">
          {block.items.map(item => (
            <div key={item.line} role="listitem" className="flex items-start gap-2 leading-relaxed" style={{ paddingLeft: `${item.depth * 1.25}rem` }}>
              {item.checked !== null ? (
                <button
                  type="button"
                  onClick={() => onToggleTask?.(item.line)}
                  disabled={!onToggleTask}
                  aria-label={item.checked ? 'Mark as not done' : 'Mark as done'}
                  aria-pressed={item.checked}
                  className={`mt-[5px] size-4 shrink-0 rounded border grid place-items-center text-[10px] leading-none ${item.checked ? 'bg-accent border-accent text-accent-fg' : 'border-line-strong hover:border-fg-muted'}`}
                >{item.checked ? '✓' : ''}</button>
              ) : (
                <span className="shrink-0 w-4 text-right text-fg-muted select-none">{item.ordered ? `${item.number}.` : '•'}</span>
              )}
              <span className={`min-w-0 break-words ${item.checked ? 'line-through text-fg-muted' : ''}`}>{inline(item.text)}</span>
            </div>
          ))}
        </div>
      );
  }
}

/** Renders the Markdown subset from lib/markdown as React elements (never as raw HTML). */
export function Markdown({ source, onToggleTask }: { source: string; onToggleTask?: (line: number) => void }) {
  return <div className="text-[15px] text-fg-soft">{parseMarkdown(source).map((block, i) => renderBlock(block, i, onToggleTask))}</div>;
}
