/**
 * A small, safe Markdown subset for notes: headings, paragraphs, lists (nested, ordered, checklists),
 * quotes, fenced code, rules and inline code / bold / italic / strikethrough / links.
 * It produces plain data (no HTML strings), so rendering can never inject markup.
 */

export interface ListItem { depth: number; ordered: boolean; number: number; text: string; checked: boolean | null; /** 0-based source line */ line: number; }
export type Block =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'code'; text: string; lang: string }
  | { type: 'rule' }
  | { type: 'list'; items: ListItem[] };

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'br' }
  | { t: 'code'; v: string }
  | { t: 'strong' | 'em' | 'del'; c: Inline[] }
  | { t: 'link'; href: string; c: Inline[] };

const normalize = (src: string) => src.replace(/\r\n?/g, '\n');

const FENCE = /^\s*(```|~~~)\s*([\w+-]*)\s*$/;
const HEADING = /^(#{1,4})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;
const LIST = /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/;

const isBlank = (line: string) => /^\s*$/.test(line);
const startsBlock = (line: string) => FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || LIST.test(line);

export function parseMarkdown(src: string): Block[] {
  const lines = normalize(src).split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) { i += 1; continue; }

    const fence = FENCE.exec(line);
    if (fence) {
      const close = new RegExp(`^\\s*${fence[1]}\\s*$`);
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !close.test(lines[i])) { body.push(lines[i]); i += 1; }
      i += 1; // skip the closing fence (or run off the end of an unclosed one)
      blocks.push({ type: 'code', text: body.join('\n'), lang: fence[2] });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) { blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3 | 4, text: heading[2] }); i += 1; continue; }

    if (RULE.test(line)) { blocks.push({ type: 'rule' }); i += 1; continue; }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) { body.push(QUOTE.exec(lines[i])![1]); i += 1; }
      blocks.push({ type: 'quote', text: body.join('\n') });
      continue;
    }

    if (LIST.test(line)) {
      const items: ListItem[] = [];
      const counters: number[] = [];
      while (i < lines.length && LIST.test(lines[i]) && !RULE.test(lines[i])) {
        const [, indent, marker, rest] = LIST.exec(lines[i])!;
        const width = indent.replace(/\t/g, '    ').length;
        const depth = Math.min(3, Math.floor(width / 2));
        const ordered = /\d/.test(marker);
        counters.length = depth + 1; // entering a shallower level forgets deeper counters
        counters[depth] = ordered ? (counters[depth] ?? 0) + 1 : 0;
        const task = /^\[( |x|X)\](?:\s+(.*))?$/.exec(rest);
        items.push({ depth, ordered, number: counters[depth] ?? 0, text: task ? (task[2] ?? '') : rest, checked: task ? task[1] !== ' ' : null, line: i });
        i += 1;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    const body: string[] = [];
    while (i < lines.length && !isBlank(lines[i]) && (body.length === 0 || !startsBlock(lines[i]))) { body.push(lines[i]); i += 1; }
    blocks.push({ type: 'paragraph', text: body.join('\n') });
  }
  return blocks;
}

/* ---------- inline ---------- */

/** Only web and mail links are ever made clickable. */
export function safeHref(url: string) {
  if (!/^(https?:\/\/|mailto:)/i.test(url)) return null;
  try { new URL(url); return url; } catch { return null; }
}

const INLINE = /`([^`\n]+)`|\*\*((?:[^*\n]|\*(?!\*))+?)\*\*|~~([^~\n]+?)~~|\*([^*\s][^*\n]*?)\*|\[([^\]\n]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<]*[^\s<.,;:!?)\]'"])/g;

function textWithBreaks(text: string, out: Inline[]) {
  text.split('\n').forEach((part, index) => {
    if (index > 0) out.push({ t: 'br' });
    if (part) out.push({ t: 'text', v: part });
  });
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) textWithBreaks(text.slice(last, at), out);
    if (m[1] !== undefined) out.push({ t: 'code', v: m[1] });
    else if (m[2] !== undefined) out.push({ t: 'strong', c: parseInline(m[2]) });
    else if (m[3] !== undefined) out.push({ t: 'del', c: parseInline(m[3]) });
    else if (m[4] !== undefined) out.push({ t: 'em', c: parseInline(m[4]) });
    else if (m[5] !== undefined) {
      const href = safeHref(m[6]);
      if (href) out.push({ t: 'link', href, c: parseInline(m[5]) });
      else textWithBreaks(m[0], out); // unsafe scheme: show the raw text, not a link
    } else if (m[7] !== undefined) {
      const href = safeHref(m[7]);
      out.push(href ? { t: 'link', href, c: [{ t: 'text', v: m[7] }] } : { t: 'text', v: m[7] });
    }
    last = at + m[0].length;
  }
  if (last < text.length) textWithBreaks(text.slice(last), out);
  return out;
}

/* ---------- editing helpers ---------- */

const TASK_LINE = /^(\s*(?:[-*+]|\d{1,9}[.)])\s+)\[( |x|X)\]/;

/** Flips the checkbox on a source line. Returns the new text (unchanged if that line has no checkbox). */
export function toggleTaskLine(src: string, line: number) {
  const lines = normalize(src).split('\n');
  const m = lines[line] !== undefined ? TASK_LINE.exec(lines[line]) : null;
  if (!m) return src;
  lines[line] = lines[line].replace(TASK_LINE, `${m[1]}[${m[2] === ' ' ? 'x' : ' '}]`);
  return lines.join('\n');
}

export type FormatKind = 'bold' | 'italic' | 'strike' | 'code' | 'link' | 'h2' | 'ul' | 'ol' | 'task' | 'quote';
export interface EditResult { value: string; start: number; end: number; }

const WRAP: Partial<Record<FormatKind, string>> = { bold: '**', italic: '*', strike: '~~', code: '`' };

export function applyFormat(value: string, start: number, end: number, kind: FormatKind): EditResult {
  const marker = WRAP[kind];
  if (marker) {
    const selected = value.slice(start, end);
    const before = value.slice(0, start);
    const after = value.slice(end);
    if (before.endsWith(marker) && after.startsWith(marker) && (kind !== 'italic' || (!before.endsWith('**') && !after.startsWith('**')))) {
      return { value: before.slice(0, -marker.length) + selected + after.slice(marker.length), start: start - marker.length, end: end - marker.length };
    }
    return { value: before + marker + selected + marker + after, start: start + marker.length, end: end + marker.length };
  }

  if (kind === 'link') {
    const selected = value.slice(start, end);
    const label = selected || 'text';
    const inserted = `[${label}](url)`;
    const urlStart = start + label.length + 3;
    return { value: value.slice(0, start) + inserted + value.slice(end), start: selected ? urlStart : start + 1, end: selected ? urlStart + 3 : start + 1 + label.length };
  }

  // Line prefixes act on whole lines touched by the selection.
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const nl = value.indexOf('\n', end);
  const lineEnd = nl === -1 ? value.length : nl;
  const lines = value.slice(lineStart, lineEnd).split('\n');
  const strip: Record<string, RegExp> = {
    h2: /^#{1,4}\s+/, quote: /^>\s?/, ol: /^\d{1,9}[.)]\s+/, ul: /^[-*+]\s+(?:\[[ xX]\]\s+)?/, task: /^[-*+]\s+(?:\[[ xX]\]\s+)?/,
  };
  const has: Record<string, RegExp> = {
    h2: /^##\s+/, quote: /^>\s?/, ol: /^\d{1,9}[.)]\s+/, ul: /^[-*+]\s+(?!\[[ xX]\])/, task: /^[-*+]\s+\[[ xX]\]\s+/,
  };
  const allHave = lines.every(l => has[kind].test(l));
  const next = lines.map((l, idx) => {
    const bare = l.replace(strip[kind], '');
    if (allHave) return bare;
    const prefix = kind === 'h2' ? '## ' : kind === 'quote' ? '> ' : kind === 'ol' ? `${idx + 1}. ` : kind === 'ul' ? '- ' : '- [ ] ';
    return prefix + bare;
  });
  const replaced = next.join('\n');
  return { value: value.slice(0, lineStart) + replaced + value.slice(lineEnd), start: lineStart, end: lineStart + replaced.length };
}

/**
 * Pressing Enter at the end of a list line continues the list (and an empty item ends it).
 * Returns null when the cursor isn't at the end of a list line, so the caller can keep the default.
 */
export function continueList(value: string, pos: number): EditResult | null {
  const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
  const nl = value.indexOf('\n', pos);
  const lineEnd = nl === -1 ? value.length : nl;
  if (pos !== lineEnd) return null;
  const m = /^(\s*)([-*+]|(\d{1,9})([.)]))\s+(\[[ xX]\]\s+)?(.*)$/.exec(value.slice(lineStart, lineEnd));
  if (!m) return null;
  const [, indent, marker, num, delim, checkbox, content] = m;
  if (!content.trim()) {
    return { value: value.slice(0, lineStart) + value.slice(lineEnd), start: lineStart, end: lineStart };
  }
  const nextMarker = num ? `${Number(num) + 1}${delim}` : marker;
  const insert = `\n${indent}${nextMarker} ${checkbox ? '[ ] ' : ''}`;
  const at = pos + insert.length;
  return { value: value.slice(0, pos) + insert + value.slice(pos), start: at, end: at };
}

/** One-line plain-text preview of Markdown for cards and search results. */
export function plainSnippet(src: string, max = 140) {
  const text = normalize(src)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*#{1,4}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(?:[-*+]|\d{1,9}[.)])\s+(?:\[[ xX]\]\s+)?/gm, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|~~|`|\*)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * The smallest replacement that turns `oldText` into `newText`: replace `oldText.slice(from, to)` with `insert`.
 * Lets the editor apply toolbar/list edits through the browser's native text insertion, which keeps Ctrl+Z working.
 */
export function diffRange(oldText: string, newText: string) {
  let from = 0;
  const max = Math.min(oldText.length, newText.length);
  while (from < max && oldText[from] === newText[from]) from += 1;
  let tail = 0;
  while (tail < oldText.length - from && tail < newText.length - from && oldText[oldText.length - 1 - tail] === newText[newText.length - 1 - tail]) tail += 1;
  return { from, to: oldText.length - tail, insert: newText.slice(from, newText.length - tail) };
}
