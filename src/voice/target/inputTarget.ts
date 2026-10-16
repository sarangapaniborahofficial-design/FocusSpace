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

    // Apply update to DOM element using native prototype setter to notify React state trackers
    setNativeValue(this.element, nextVal);

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

    const { start, end, text } = this.lastInsertRange;
    const val = this.element.value || '';

    // Safety check: only delete if the text at the recorded range exactly matches what was inserted
    if (val.slice(start, end) !== text) {
      this.lastInsertRange = null;
      return;
    }

    const nextVal = val.slice(0, start) + val.slice(end);
    setNativeValue(this.element, nextVal);

    this.element.setSelectionRange(start, start);
    this.element.focus();

    this.lastInsertRange = null;
  }
}

/**
 * React 16+ overrides input.value setter with internal value tracking.
 * Invoking the native HTMLInputElement/HTMLTextAreaElement prototype setter
 * ensures React detects the modification and dispatches synthetic onChange events.
 */
function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = typeof window !== 'undefined'
    ? (element instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype)
    : Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  const setter = descriptor?.set;
  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Creates an InputDictationTarget for an input or textarea element.
 */
export function createInputTarget(el: HTMLInputElement | HTMLTextAreaElement): DictationTarget {
  return new InputDictationTarget(el);
}
