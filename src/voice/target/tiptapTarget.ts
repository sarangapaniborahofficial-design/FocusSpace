import type { Editor } from '@tiptap/react';
import type { DictationTarget, DictationTargetContext } from './DictationTarget';

export class TipTapDictationTarget implements DictationTarget {
  private editor: Editor;

  constructor(editor: Editor) {
    this.editor = editor;
  }

  getContext(): DictationTargetContext {
    try {
      const { from, to } = this.editor.state.selection;
      const doc = this.editor.state.doc;

      // Extract preceding text in current resolved block
      const $from = doc.resolve(from);
      const startOfBlock = $from.start();
      const before = doc.textBetween(startOfBlock, from, '\n');

      const $to = doc.resolve(to);
      const endOfBlock = $to.end();
      const after = doc.textBetween(to, endOfBlock, '\n');

      return { before, after };
    } catch {
      return { before: '', after: '' };
    }
  }

  showProvisional(): void {
    // TipTap cursor is kept active
  }

  clearProvisional(): void {
    // Clear provisional marker
  }

  insertFinal(text: string): void {
    if (!text || !this.editor) return;

    if (text === '\n' || text === '\n\n') {
      this.editor.chain().focus().splitBlock().run();
      return;
    }

    const { before } = this.getContext();
    let toInsert = text;

    // Spacing
    if (before.length > 0 && !/\s$/.test(before) && !/^[\s.,!?;:]/.test(toInsert)) {
      toInsert = ' ' + toInsert;
    }

    // Capitalization
    if (before.length === 0 || /[.!?\n]\s*$/.test(before)) {
      toInsert = toInsert.replace(/^(\s*)([a-z])/, (_, ws, char) => ws + char.toUpperCase());
    }

    this.editor.chain().focus().insertContent(toInsert).run();
  }

  removeLastInsert(): void {
    if (!this.editor) return;
    this.editor.chain().focus().undo().run();
  }
}

export function createTipTapTarget(editor: Editor): DictationTarget {
  return new TipTapDictationTarget(editor);
}
