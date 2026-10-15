# FocusSpace Agent Guidelines & Invariants

These guidelines are loaded automatically by Antigravity on every interaction in this workspace.

---

## 🛡️ Git & Version Control Invariants
- **NEVER execute `git commit` or `git push`**: All staging, committing, and pushing is reserved exclusively for the user via GitHub Desktop.
- **Automatic Milestone Wrap-up**: At the conclusion of every implementation, refactor, or sprint, automatically:
  1. Verify zero regressions: execute `npm test` and `npm run build`.
  2. Provide a **Conventional Commit Title** (e.g., `feat(...)` or `fix(...)`).
  3. Provide a structured **Commit Summary** formatted for GitHub Desktop's description box.
  4. Keep [`STATUS.md`](file:///D:/focusspace-phase75/FocusSpace/STATUS.md) and [`TODO.md`](file:///D:/focusspace-phase75/FocusSpace/TODO.md) up to date without needing explicit reminders.

---

## 🏛️ Architectural Invariants
- **100% Local-First**: Zero mandatory backend. All state stored in Dexie/IndexedDB with full offline support.
- **Privacy & Offline First**: Audio synthesis, scheduling heuristics, and transcription run entirely in-browser/client-side.
- **Design Language**: Swiss architectural neo-brutalism, 3D tactile keycaps with mechanical press physics, high WCAG AAA contrast.
