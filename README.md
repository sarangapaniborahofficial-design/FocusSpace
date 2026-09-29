# FocusSpace

Local-first productivity hub built with React + Vite, Tailwind CSS, Dexie/IndexedDB, Lucide, and FullCalendar.
Everything lives in your browser; nothing is sent anywhere.

## Current build

- Phase 1: dashboard shell, navigation, themes, quick add/search foundation
- Phase 2: Dexie-backed tasks, categories, list/kanban, subtasks
- Phase 3: Today/Focus, habits, task-linked Pomodoro and focus logs
- Phase 4: FullCalendar month/week/day views and drag/resize time blocking
- Phase 5: category manager, JSON backup/import, settings, global keyboard actions
- Phase 6: analytics and polish (below)
- After Phase 6: task editor (below)
- Phase 7: daily-driver hardening (done, below)
- Phase 7.5 (in progress): Pages foundation — rich-text journal, live references (below)

### Phase 6 — analytics

The **Analytics** tab (sidebar) shows, for 7 days / 30 days / 12 weeks and for all categories or one:

- tasks completed (stacked by category), focus time, on-time completion, best habit streak, each compared with the previous period
- weekly goals with editable targets (tasks, focus hours, habit check-ins), stored in `localStorage` and included in backups
- focus time per day/week, focus time and completions by category
- estimated vs actual time for tasks you focused on
- per-habit streaks, 30-day rate and a 14-day strip

Tasks now record `completedAt` when they move to Done, so completions land on the day they were finished, not the day
they were last edited. Tasks finished before this change fall back to their last-edit date.

### Phase 6 — polish and fixes

- **Timer** lives outside React: it keeps running across views, has a docked mini timer, counts from a wall-clock deadline
  (no drift in background tabs), shows the countdown in the tab title, moves to the next break automatically
  (long break after 4 focus sessions), can play a chime, and warns before a reload throws away a running session.
  Focus time is logged once per session, including partial sessions when you reset, skip or switch task.
- **Command palette** (Ctrl/⌘ K) now searches tasks and runs navigation/actions with the keyboard.
- **Tasks**: due dates and overdue state on cards, status control and drag-and-drop between board columns, "hide completed",
  undo after delete, empty states and loading skeletons.
- **Responsive**: sidebar becomes a drawer on phones, calendar opens on the day view on narrow screens, toolbars wrap.
- **Themes**: charts/rings follow the theme; calendar and status colours fixed for the light theme; the header theme
  switch is now remembered.
- **Accessibility**: labelled controls, dialog semantics, visible keyboard focus, reduced-motion support, screen-reader
  tables for charts.
- **Edge cases fixed**: "today" used the UTC date (wrong before 05:30 in India), deleting the category you're viewing,
  quick-add remembering a stale category, calendar drops overwriting a task's estimate, first-run seeding under React
  StrictMode, and backup import now repairs or skips malformed records instead of crashing later.

### Task editor

Click a task title or its pencil (or use "Edit details" in the calendar dialog, or search for it with Ctrl/⌘ K) to open the
editor drawer: title, status, category, priority, due date/time, estimate, project tag, subtasks (add, rename, tick, remove)
and notes. Ctrl/⌘ Enter saves, Escape asks before discarding unsaved edits, and delete can be undone.

### Pages

See "Phase 7.5 — Pages foundation" below for the current design (this replaced an earlier single-Markdown-note
version of Pages built during Phase 6/7).

### Phase 7 — daily-driver hardening (done)

- **Today** now answers "what should I do today?" directly: a single "Do this next" suggestion (picks something
  scheduled for right now, otherwise the most important overdue/due-today task), then Overdue, Due today, Done today
  and a "Coming up" (next 3 days) section.
- **Recurring tasks**: set a repeat (daily, weekdays, every week, every 2 weeks, every month) in the task editor.
  Completing a recurring task creates the next occurrence automatically, correctly across short months and if it was
  finished late or early. Undoing the completion removes an untouched next occurrence again.
- **Task duplication**: the copy icon on a task card duplicates it as a fresh "To Do" with unticked subtasks.
- **Filters, sorting and bulk actions** in the task list: filter by status/priority/due date/tag, sort by date,
  priority, title or last edited, and a "Select" mode for marking several tasks done, setting their priority, or
  deleting them together (with undo).
- **Habit management** (Settings → Habits): add, rename, archive/restore and delete habits — no longer limited to the
  three seeded ones.
- **ICS calendar export** (Settings → Calendar export): downloads a standards-compliant `.ics` file of scheduled
  tasks (those with a due date and time) for Google Calendar, Apple Calendar or Outlook. Optionally include completed
  tasks.
- **Backup reminder**: a dismissible banner in Settings once there's real data and it's been a while (or never) since
  your last export.

Note: the database schema is still version 2 — recurring tasks and duplication add fields but reuse the existing
`tasks` table, so no migration is needed. Older backups import cleanly (recurrence is simply absent).

### Phase 7.5 — Pages foundation

Pages moved from a single Markdown note per category to what the roadmap calls a "dashboard + journal":
a permanent place for a topic, with **true rich-text writing** (via TipTap), **live references** to your
tasks and habits, and a **chronological journal** underneath.

- **Pages are top-level now.** There's a "Pages" item in the sidebar (all pages, across categories), and a
  category's "Pages" tab is just a filtered view of the same list. A page's category is optional.
- **Title and description** sit at the top of a page, autosaved as you type.
- **Related** section: link a page to any task or habit. These are live references, not copies — a linked
  task shows its real, current status, and a linked habit shows its real streak. Unlinking removes the
  reference only, never the task or habit itself. If a linked task or habit is deleted, the stale reference
  is cleaned up automatically.
- **Journal**: "Write today's entry" starts (or continues) one entry per page per day, written in a real
  rich-text editor — headings, paragraphs, bulleted/numbered/checklist lists, bold/italic/strikethrough,
  links. Past entries are read-only by default (click the pencil to reopen one), and checklist items in a
  read-only entry can still be ticked directly. An entry left completely empty is dropped rather than kept
  as a blank row.
- **Files** stay exactly as before: attach, preview, download.
- **Existing pages were migrated, not discarded.** Each category note from the old format became a page
  whose Markdown text is now its first journal entry (dated to when it was last edited). The original
  Markdown is kept as `legacyMarkdown` and shown in a small banner ("this page was converted…") until you
  confirm the conversion looks right; a "View original text" link is always there if you want to check.
  This is a **database schema v3 upgrade** — it runs once, automatically, the first time you open the app
  after updating, and existing data is transformed in place rather than deleted.
- **Backups**: JSON export/import now include journal entries and page links (backup format v3). Restoring
  an older (v1/v2) backup still works — it just won't have pages/journal data to restore, which the import
  confirmation tells you plainly.

**Known limitation, please read:** the rich-text editor is built on TipTap (`@tiptap/react` + friends,
newly added to `package.json`). Unlike everything else in this app, it could not be installed or run in the
sandbox this was built in — there's no network access there to fetch the package — so it has **not been
hands-on tested**. Everything around it (the schema, migration, journal saving, link management, the
read-only renderer, the Markdown-to-rich-text converter for migrated pages) has full automated test
coverage and has been run in a real headless browser; the editor itself is written carefully against
TipTap's documented v2 API, but needs your own first-run check: open a page, write something with a few
different formats (heading, list, checklist, bold, a link), reload, and confirm it looks right and survives
a page reload.

## Run

```bash
npm install
npm run dev
```

`npm run build` type-checks first; `@types/react` and `@types/react-dom` are now listed as dev dependencies for that.

## Known backlog

- Reordering subtasks; linking a task directly from the task editor (currently only from the page side); images inline in journal entries
- Timer state is not restored after a page reload
- Responsive check on a real phone has not been done
