import type { DictationTarget, DictationTargetContext } from './DictationTarget';

export class InputDictationTarget implements DictationTarget {
  private element: HTMLInputElement | HTMLTextAreaElement;
  private lastInsertRange: { start: number; end: number; text: string } | null = null;
  private provisionalActive = false;

  constructor(element: HTMLInputElement | HTMLTextAreaElement) {
    this.element = element;
  }

  getContext(): DictationTargetContext {
    const val = this.element.value || '';
    const start = this.element.selectionStart ?? val.length;
    const end = this.element.selectionEnd ?? val.length;

    return {
      before: val.slice(0, start),
      after: val.slice(end),
    };
  }

  showProvisional(): void {
    this.provisionalActive = true;
  }

  clearProvisional(): void {
    this.provisionalActive = false;
  }

  insertFinal(text: string): void {
    if (!text) return;
    this.clearProvisional();

    const { before, after } = this.getContext();
    let toInsert = text;

    // 1. Spacing check: if 'before' does not end in whitespace and text doesn't start with whitespace/punctuation
    if (before.length > 0 && !/\s$/.test(before) && !/^[\s.,!?;:]/.test(toInsert)) {
      toInsert = ' ' + toInsert;
    }

    // 2. Sentence capitalization: if before is empty or ends with sentence terminator (. ! ? \n)
    if (before.length === 0 || /[.!?\n]\s*$/.test(before)) {
      toInsert = toInsert.replace(/^(\s*)([a-z])/, (_, ws, char) => ws + char.toUpperCase());
    }

    const start = this.element.selectionStart ?? before.length;
    const end = this.element.selectionEnd ?? before.length;

    const fullVal = this.element.value || '';
    const nextVal = fullVal.slice(0, start) + toInsert + fullVal.slice(end);

    // Apply update to DOM element
    this.element.value = nextVal;

    // Dispatch native input & change events for React state synchronizer
    this.element.dispatchEvent(new Event('input', { bubbles: true }));
    this.element.dispatchEvent(new Event('change', { bubbles: true }));

    // Position cursor at end of insert
    const newPos = start + toInsert.length;
    this.element.setSelectionRange(newPos, newPos);
    this.element.focus();

    // Record for "scratch that" voice command
    this.lastInsertRange = {
      start,
      end: newPos,
      text: toInsert,
    };
  }

  removeLastInsert(): void {
    if (!this.lastInsertRange) return;

    const { start, end } = this.lastInsertRange;
    const val = this.element.value || '';

    // Verify the segment still matches or falls within range
    const nextVal = val.slice(0, start) + val.slice(end);
    this.element.value = nextVal;

    this.element.dispatchEvent(new Event('input', { bubbles: true }));
    this.element.dispatchEvent(new Event('change', { bubbles: true }));

    this.element.setSelectionRange(start, start);
    this.element.focus();

    this.lastInsertRange = null;
  }
}

/**
 * Creates an InputDictationTarget for an input or textarea element.
 */
export function createInputTarget(el: HTMLInputElement | HTMLTextAreaElement): DictationTarget {
  return new InputDictationTarget(el);
}
