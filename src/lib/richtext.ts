import { parseInline, parseMarkdown, safeHref, type Inline } from './markdown';
import type { MarkType, RichMark, RichTextDoc, RichTextNode } from '../types';

/**
 * PzincMirror/TipTap-compatible document JSON: builders, a Markdown -> rich-text converter (used once,
 * to migrate legacy notes), a plain-text mirror for search, and a whitelist sanitizer. All pure data —
 * nothing here renders anything, so it needed no TipTap dependency to write or test.
 */

export const emptyDoc = (): RichTextDoc => ({ type: 'doc', content: [{ type: 'paragraph' }] });

const NODE_TYPES = new Set(['doc', 'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'taskList', 'taskItem', 'blockquote', 'codeBlock', 'horizontalRule', 'text', 'hardBreak']);
const MARK_TYPES: MarkType[] = ['bold', 'italic', 'strike', 'code', 'link'];

/* ---------- Markdown -> rich text (one-time migration path) ---------- */

function inlineToNodes(inline: Inline[], marks: RichMark[] = []): RichTextNode[] {
  const out: RichTextNode[] = [];
  for (const node of inline) {
    switch (node.t) {
      case 'text':
        if (node.v) out.push(marks.length ? { type: 'text', text: node.v, marks } : { type: 'text', text: node.v });
        break;
      case 'br':
        out.push({ type: 'hardBreak' });
        break;
      case 'code':
        out.push({ type: 'text', text: node.v, marks: [...marks, { type: 'code' }] });
        break;
      case 'strong':
        out.push(...inlineToNodes(node.c, [...marks, { type: 'bold' }]));
        break;
      case 'em':
        out.push(...inlineToNodes(node.c, [...marks, { type: 'italic' }]));
        break;
      case 'del':
        out.push(...inlineToNodes(node.c, [...marks, { type: 'strike' }]));
        break;
      case 'link':
        out.push(...inlineToNodes(node.c, [...marks, { type: 'link', attrs: { href: node.href } }]));
        break;
    }
  }
  return out;
}

const text = (s: string): RichTextNode[] => inlineToNodes(parseInline(s));
const paragraph = (s: string): RichTextNode => (s ? { type: 'paragraph', content: text(s) } : { type: 'paragraph' });

/** Converts the small Markdown subset used by the old page editor into a rich-text document. */
export function markdownToRichText(markdown: string): RichTextDoc {
  const blocks = parseMarkdown(markdown);
  const content: RichTextNode[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        content.push({ type: 'heading', attrs: { level: Math.min(3, block.level + 1) }, content: text(block.text) });
        break;
      case 'paragraph':
        content.push(paragraph(block.text));
        break;
      case 'quote':
        content.push({ type: 'blockquote', content: block.text.split('\n').map(paragraph) });
        break;
      case 'code':
        content.push(block.text ? { type: 'codeBlock', attrs: { language: block.lang || null }, content: [{ type: 'text', text: block.text }] } : { type: 'codeBlock', attrs: { language: block.lang || null } });
        break;
      case 'rule':
        content.push({ type: 'horizontalRule' });
        break;
      case 'list': {
        const hasTasks = block.items.some(i => i.checked !== null);
        const listType = hasTasks ? 'taskList' : block.items[0]?.ordered ? 'orderedList' : 'bulletList';
        const itemType = hasTasks ? 'taskItem' : 'listItem';
        // Depth is flattened (the Markdown source loses no information here, but true nesting is rare
        // enough in migrated notes that a flat list is a reasonable, always-correct fallback).
        content.push({ type: listType, content: block.items.map(item => ({ type: itemType, ...(item.checked !== null ? { attrs: { checked: item.checked } } : {}), content: [paragraph(item.text)] })) });
        break;
      }
    }
  }
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

/* ---------- rich text -> plain text (search / snippets) ---------- */

function collectText(node: RichTextNode, out: string[]) {
  if (node.type === 'text' && node.text) out.push(node.text);
  if (node.type === 'hardBreak') out.push('\n');
  node.content?.forEach(child => collectText(child, out));
  if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'codeBlock') out.push('\n\n');
  else if (node.type === 'listItem' || node.type === 'taskItem') out.push('\n');
}

export function richTextToPlainText(doc: RichTextDoc): string {
  const out: string[] = [];
  doc.content.forEach(node => collectText(node, out));
  return out.join('').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
}

export function isEmptyDoc(doc: RichTextDoc | null | undefined): boolean {
  if (!doc || !doc.content.length) return true;
  return richTextToPlainText(doc).length === 0;
}

/** One-line preview for a page/journal card. */
export function richTextSnippet(doc: RichTextDoc, max = 140): string {
  const plain = richTextToPlainText(doc).replace(/\s+/g, ' ').trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

/* ---------- sanitizing (backup import, or anything from outside this app) ---------- */

function sanitizeMarks(marks: unknown): RichMark[] | undefined {
  if (!Array.isArray(marks)) return undefined;
  const clean = marks
    .filter((m): m is { type: string; attrs?: { href?: unknown } } => !!m && typeof m === 'object' && MARK_TYPES.includes((m as { type: string }).type as MarkType))
    .flatMap((m): RichMark[] => {
      if (m.type === 'link') {
        const href = typeof m.attrs?.href === 'string' ? safeHref(m.attrs.href) : null;
        return href ? [{ type: 'link', attrs: { href } }] : []; // unsafe link: drop the mark, keep the plain text
      }
      return [{ type: m.type as MarkType }];
    });
  return clean.length ? clean : undefined;
}

function sanitizeNode(raw: unknown): RichTextNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const node = raw as Record<string, unknown>;
  const type = typeof node.type === 'string' && NODE_TYPES.has(node.type) ? node.type : 'paragraph';
  if (type === 'text') {
    const value = typeof node.text === 'string' ? node.text : '';
    if (!value) return null;
    const marks = sanitizeMarks(node.marks);
    return marks ? { type: 'text', text: value, marks } : { type: 'text', text: value };
  }
  const content = Array.isArray(node.content) ? node.content.map(sanitizeNode).filter((n): n is RichTextNode => n !== null) : undefined;
  const attrs = type === 'heading'
    ? { level: [1, 2, 3].includes(Number((node.attrs as { level?: number } | undefined)?.level)) ? Number((node.attrs as { level: number }).level) : 2 }
    : type === 'taskItem'
      ? { checked: (node.attrs as { checked?: unknown } | undefined)?.checked === true }
      : type === 'codeBlock'
        ? { language: typeof (node.attrs as { language?: unknown } | undefined)?.language === 'string' ? (node.attrs as { language: string }).language : null }
        : undefined;
  return { type, ...(attrs ? { attrs } : {}), ...(content?.length ? { content } : {}) };
}

/** Whitelists node/mark types and link protocols. Anything unrecognised is dropped, not passed through. */
export function sanitizeDoc(raw: unknown): RichTextDoc {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { content?: unknown }).content)) return emptyDoc();
  const content = (raw as { content: unknown[] }).content.map(sanitizeNode).filter((n): n is RichTextNode => n !== null);
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}


/** Flips a taskItem's checked state at [topLevelNodeIndex, itemIndex] (as reported by the read-only renderer). */
export function toggleTaskAtPath(doc: RichTextDoc, [nodeIndex, itemIndex]: [number, number]): RichTextDoc {
  const node = doc.content[nodeIndex];
  const item = node?.type === 'taskList' ? node.content?.[itemIndex] : undefined;
  if (!item) return doc;
  const next = structuredClone(doc);
  const nextItem = next.content[nodeIndex].content![itemIndex];
  nextItem.attrs = { ...nextItem.attrs, checked: !(nextItem.attrs?.checked === true) };
  return next;
}
