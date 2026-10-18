# FocusSpace Agent Guidelines & Invariants

These guidelines are loaded automatically by Antigravity on every interaction in this workspace.

---

## 🛡️ Git & Version Control Invariants
- **Automated Commits Enabled**: When finishing implementations, refactors, or milestones, stage all files and execute `git commit` on your own with a conventional commit message.
- **NEVER execute `git push`**: Remote pushing to GitHub is reserved exclusively for the user via GitHub Desktop or terminal.
- **Automatic Milestone Wrap-up**: At the conclusion of every implementation, refactor, or sprint:
  1. Verify zero regressions: execute `npm test` and `npm run build`.
  2. Execute `git commit` with a clean, conventional commit title and structured description.
  3. Keep [`STATUS.md`](file:///D:/focusspace-phase75/FocusSpace/STATUS.md) and [`TODO.md`](file:///D:/focusspace-phase75/FocusSpace/TODO.md) up to date without needing explicit reminders.

---

## 🏛️ Architectural Invariants
- **100% Local-First**: Zero mandatory backend. All state stored in Dexie/IndexedDB with full offline support.
- **Privacy & Offline First**: Audio synthesis, scheduling heuristics, and transcription run entirely in-browser/client-side.
- **Design Language**: Swiss architectural neo-brutalism, 3D tactile keycaps with mechanical press physics, high WCAG AAA contrast.
