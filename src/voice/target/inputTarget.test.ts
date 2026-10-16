import { describe, it, expect, beforeEach } from 'vitest';
import { InputDictationTarget } from './inputTarget';

function createMockInputElement(initialValue = ''): any {
  let val = initialValue;
  let start = initialValue.length;
  let end = initialValue.length;

  return {
    get value() {
      return val;
    },
    set value(v: string) {
      val = v;
    },
    get selectionStart() {
      return start;
    },
    set selectionStart(s: number) {
      start = s;
    },
    get selectionEnd() {
      return end;
    },
    set selectionEnd(e: number) {
      end = e;
    },
    setSelectionRange(s: number, e: number) {
      start = s;
      end = e;
    },
    focus() {},
    dispatchEvent() {
      return true;
    },
  };
}

describe('InputDictationTarget and removeLastInsert safe range undo', () => {
  let input: any;
  let target: InputDictationTarget;

  beforeEach(() => {
    input = createMockInputElement('');
    target = new InputDictationTarget(input);
  });

  it('inserts final text with auto-spacing and sentence capitalization', () => {
    target.insertFinal('hello world');
    expect(input.value).toBe('Hello world');

    target.insertFinal('next sentence');
    expect(input.value).toBe('Hello world next sentence');
  });

  it('safely undoes last insert when range text is intact', () => {
    input.value = 'Initial ';
    input.setSelectionRange(8, 8);

    target.insertFinal('dictated text');
    expect(input.value).toBe('Initial dictated text');

    target.removeLastInsert();
    expect(input.value).toBe('Initial ');
  });

  it('does nothing if text at recorded range was modified before undo', () => {
    input.value = 'Start ';
    input.setSelectionRange(6, 6);

    target.insertFinal('dictated');
    expect(input.value).toBe('Start dictated');

    // Simulate user editing the inserted word to "modified"
    input.value = 'Start modified';

    // Should abort undo because the text at recorded range does not match
    target.removeLastInsert();
    expect(input.value).toBe('Start modified');
  });
});
