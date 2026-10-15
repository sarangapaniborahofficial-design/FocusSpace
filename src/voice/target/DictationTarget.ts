/**
 * FocusSpace Voice Studio — Target Interface
 *
 * Pluggable contract for any UI field receiving speech dictation.
 * Decouples speech engine from specific DOM element types (Input, Textarea, TipTap).
 */

export interface DictationTargetContext {
  before: string;
  after: string;
}

export interface DictationTarget {
  /** Returns the text before and after the current cursor position */
  getContext(): DictationTargetContext;

  /** Displays a provisional placeholder/indicator at current cursor while transcribing */
  showProvisional(): void;

  /** Clears the provisional placeholder */
  clearProvisional(): void;

  /** Inserts finalized text, applying proper contextual spacing and capitalization */
  insertFinal(text: string): void;

  /** Reverts the last speech insert (used by "scratch that" voice command) */
  removeLastInsert(): void;
}
