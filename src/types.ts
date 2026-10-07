export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type Status = 'To Do' | 'In Progress' | 'Submitted/Done';
export type Theme = 'dark' | 'light' | 'oled';

export type RecurrenceFreq = 'daily' | 'weekdays' | 'weekly' | 'monthly';
/** Completing a recurring task creates the next occurrence. `interval` = every N days/weeks/months. */
export interface Recurrence { freq: RecurrenceFreq; interval: number; /** monthly: keep this day of the month (short months use their last day) */ anchorDay?: number; }

export interface Subtask { id: string; title: string; completed: boolean; }
export interface Category { id: string; name: string; color: string; icon?: string; }
export interface Task {
  id: string; title: string; categoryId: string; projectTag: string; priority: Priority; status: Status;
  estimatedDuration: number; dueDate: string; dueTime: string; subtasks: Subtask[]; notes: string; colorCode: string;
  createdAt: string; updatedAt: string;
  /** Set when the task moves to Submitted/Done, cleared when it moves back. Older tasks fall back to `updatedAt`. */
  completedAt?: string;
  recurrence?: Recurrence;
  /** Id of the next occurrence created when this recurring task was completed. */
  spawnedNextId?: string;
}
export interface Goal { id: string; categoryId?: string; title: string; metricLabel: string; currentValue: number; targetValue: number; deadline?: string; createdAt: string; updatedAt: string; }
export interface Habit { id: string; name: string; color: string; active: boolean; completions: string[]; targetLabel?: string; }
export interface FocusLog { id: string; taskId?: string; startedAt: string; endedAt: string; durationMinutes: number; mode: 'focus' | 'shortBreak' | 'longBreak'; }

/**
 * A permanent place for a topic: a dashboard (title, description, linked tasks/habits) with a
 * chronological journal underneath. Category is optional — pages are a top-level section that can
 * optionally be tagged to a category's Pages tab.
 */
export interface Page {
  id: string;
  categoryId?: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Set only on pages migrated from the old single-Markdown-note format (schema v2). Holds the
   * original text so nothing is lost; cleared once the person confirms the converted journal entry
   * looks right, via `legacyConfirmedAt`.
   */
  legacyMarkdown?: string;
  legacyConfirmedAt?: string;
}

/** One journal entry per page per day. Newest entries are shown first; past entries stay editable. */
export interface JournalEntry {
  id: string;
  pageId: string;
  /** YYYY-MM-DD, unique per page. */
  date: string;
  /** PzincMirror/TipTap document JSON. */
  content: RichTextDoc;
  /** Plain-text mirror of `content`, kept in step, used for search and card snippets. */
  plainText: string;
  createdAt: string;
  updatedAt: string;
}

export type PageLinkKind = 'task' | 'habit' | 'goal';
/** A reference from a page to a task/habit/goal. Never a copy — the page always reads the live record. */
export interface PageLink { id: string; pageId: string; kind: PageLinkKind; targetId: string; createdAt: string; }

/* ---------- rich text (PzincMirror/TipTap-compatible JSON) ---------- */

export type MarkType = 'bold' | 'italic' | 'strike' | 'code' | 'link';
export interface RichMark { type: MarkType; attrs?: { href?: string }; }
export interface RichTextNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  text?: string;
  marks?: RichMark[];
}
export interface RichTextDoc { type: 'doc'; content: RichTextNode[]; }

/** Metadata for a file attached to a page. The bytes live in `fileBlobs` so lists never load them. */
export interface PageFile { id: string; pageId: string; name: string; type: string; size: number; createdAt: string; }
export interface FileBlob { id: string; blob: Blob; }
