# FocusSpace Roadmap & Status

This document tracks progress towards the 1.0 release based on the project timeline, recent implementations, and the persistent roadmap backlog.

## Core Principles

- **Local-first**: Dexie + IndexedDB, no backend, 100% data ownership
- **Simple by default**: Avoid workspace clutter, distraction-free execution
- **Use before expanding**: Let daily usage drive features
- **Progressive complexity**: Useful daily driver first, sync/AI later

---

## Phase Status

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| 1-5 | Foundation (Tasks, Calendar, Settings) | ✅ **Completed** | Solid base established. |
| 6 | Core Product (Analytics, UI Polish, ICS) | ✅ **Completed** | Analytics, goals progress, ICS export active. |
| 7 | Daily-driver Hardening | ✅ **Completed** | Recurring tasks, filters, habit picker, drag-and-drop reorder. |
| 7.5 | Pages Foundation (Rich text, Journal) | ✅ **Completed** | TipTap rich-text editor, live interactive references, auto daily summaries. |
| 8 | Production, PWA & Power Tools | ✅ **Completed** | Service worker offline caching, smart schedule preferences, global shortcuts cheatsheet. |
| 9 | Command Hub & Daily Briefing | ✅ **Completed** | Native & web app launcher, AppDock, morning/midday/evening briefing, rollover & reflection export. |
| 10 | Polish, Bug Fixes, Native & Voice | ✅ **Completed** | Sprint 1, 2, 3 & Phase 10H complete: WCAG contrast suite, Floating HUD, Universal App Dock, Dedicated Journal, Category Pages, Flowy Onboarding, Voice Everywhere, Centered Dock, and Lag Elimination. |
| Phase A | Web Build Stabilization (Tauri Readiness) | ✅ **Completed** | Phase A1 (Backup Fidelity), A2 (Voice Fixes & WASM Deduplication), A3 (Housekeeping). 100/100 tests passing. Gate A verified. |
| Phase B–D | Tauri v2 Windows Native Desktop & Fast-Track Guide | ✅ **Completed** | Native Windows `.exe` and MSI/NSIS installers built with Voice enabled, atomic vault mirroring, system tray, native floating HUD, conflict-free hotkeys (`Ctrl+Alt+Space`, `Ctrl+Alt+H`, `Ctrl+Alt+D`). All 104 Vitest tests + 3 Rust unit tests passed. |

---

## Recent Work Completed

1. ✅ **Omnipresent Voice Typing Everywhere, Enlarged Centered Dock & Fluid Performance Polish**:
   - **Voice Typing Everywhere**:
     - **Universal Voice Dictation**: Added global hotkey `Ctrl + Shift + V` / `Alt + V` and dedicated AppDock microphone trigger that binds directly to `document.activeElement` or the last-focused input across the entire DOM.
     - **Inline Mic Buttons across all editing contexts**: Added explicit `MicButton` inputs to `TodayQuickCapture`, `TaskEditor` (dual-target Title and Notes), `PageView` (Title and Description), `RichTextEditor` (TipTap notes), `QuickAddModal` (natural language title), `FloatingHUD` (in-session scratchpad and subtasks), `Review` (Wins, Challenges, Improvements, and Top 3 Priorities), and `CommandPalette` (voice search).
     - **Feedback HUD (`DictationHud.tsx`)**: Real-time status, speech level equalizer waveform, disfluency cleaner ('scratch that', 'new line', 'new paragraph'), model loading progress bar, and error state indicator.
   - **Dock Polish & Web vs Native App Launcher**:
     - **Enlarged and Centered Geometry**: Dock icons enlarged to `size-12 sm:size-14` (48px–56px) with 26px vector brand icons; container centered with `fixed bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-2rem)] overflow-x-auto scrollbar-none`.
     - **App vs Web App Selector**: Added segmented `[ 🌐 Web App ]` vs `[ 💻 Native App ]` toggle in the Add App modal.
     - **URL Auto-Sanitization**: Added `normalizeWebUrl` prepending `https://` if omitted (e.g. `youtube.com` -> `https://youtube.com`), and `window.open` external tab dispatch, fixing the YouTube redirection glitch.
   - **Interface Stutter Root-Cause Elimination**:
     - Eliminated 3 distinct lag bottlenecks: (1) wrapped unconditional Dexie live queries in `App.tsx` so they only execute when `welcomeOpen` is true; (2) added narrow `useTimerTaskId()` hook in `timer.ts` to stop the 250ms Pomodoro timer interval from re-rendering `AppDock` 4 times/sec; (3) cached bounding rect and throttled mousemove on the dock using `requestAnimationFrame`.

2. ✅ **PWA Blockers & Tauri v2 Readiness Remediation**:
   - **Blocker 1: Data Vault Backup & Restore Engine (`src/lib/backup.ts`)**:
     - Complete JSON round-trip export & import with schema recovery (`normalize.ts`), preserving IndexedDB as the source of truth across all 10 Dexie tables (`categories`, `tasks`, `habits`, `goals`, `focusLogs`, `pages`, `journalEntries`, `pageLinks`, `files`, `fileBlobs`).
     - File blobs serialized losslessly via Base64. Added `DataVaultCard` to `Settings.tsx` with live database row telemetry and restore confirmation modal.
     - 5 new automated unit & integration tests (`src/lib/__tests__/backup.test.ts`).
   - **Blocker 2: Voice Verification & Bug Fixes (`src/voice/`)**:
     - English-only Whisper fix: Omitted `language` and `task` kwargs for `.en` models to eliminate Transformers.js unhandled rejections.
     - Local WASM path: Configured `env.backends.onnx.wasm.wasmPaths = '/models/wasm/'` so ONNX Runtime loads WASM locally instead of from CDN.
     - Provisioning scripts: Created `scripts/provision-voice.mjs` (integrated into `postinstall` and `npm run prepare-voice`) to copy Silero VAD models and ONNX WASM binaries offline.
     - 25s Utterance Cap: Added `MAX_UTTERANCE_SAMPLES = 400,000` to prevent Whisper 30s attention overflow.
     - React 19 Synthetic Input Setter: Rewrote `inputTarget.ts` using `HTMLInputElement.prototype` descriptor setter so React's internal `_valueTracker` synchronizes without reverting.
     - Hallucination Filter Hardening: Replaced dynamic `RegExp` in `isDegenerateLoop` with safe `indexOf` searching, preventing syntax error crashes on special characters.
     - VAD Callback Synchronization: Stored dynamic callbacks in `optionsRef` in `useDictation.ts` and added `setOptions` to `VadController` to fix stale closure transcript drops.
     - Gate 0 Benchmarks: Documented target metrics in `src/voice/README.md` (UNVERIFIED pending owner recording 15 test clips).
   - **Blocker 3: Local Bundled Typography**:
     - Removed external Google Fonts CDN links from `index.html`.
     - Bundled `@fontsource` packages locally (`space-grotesk`, `instrument-serif`, `jetbrains-mono`, `geist-sans`) via `src/index.css`, bundling all `.woff`/`.woff2` fonts offline in `dist/assets/`.
     - Cleaned up obsolete `runtimeCaching` rule in `vite.config.ts`.
   - **Blocker 4: Pinned Dependencies**:
     - Pinned all 18 dependencies previously using `"latest"` to exact semantic versions in `package.json`.
3. ✅ **Sprint 3 — Universal Floating Dock & Offline Voice Typing Studio**:
   - Universal persistent bottom dock across all workspace tabs with official vector SVG branding.
   - 100% offline Voice Typing Studio with Silero VAD, Web Worker Whisper WASM, and disfluency cleanup.
   - **Dedicated Journal Workspace Tab (`Journal.tsx`) & 11:59 PM Auto-Save Engine (`journalAutoSave.ts`)**:
     - Dedicated first-class route `'journal'` in `App.tsx` and `Sidebar.tsx` with dedicated shortcut `Ctrl + J` / `Ctrl + 6`.
     - Dual-trigger auto-save: Live midnight timer at `23:59:00` local time + next-morning boot catch-up if computer was asleep.
     - TipTap rich-text editor for reflections & notes, manual "Capture Snapshot Now" trigger, live telemetry strip (focus time, completed tasks, habits), and chronological date archive navigator.
     - Storage Invariant: Uses reserved constant `DAILY_JOURNAL_PAGE_ID = '__daily_journal__'` in `db.journalEntries`.
   - **Category-Grouped Pages Tab (`PagesList.tsx`)**:
     - Strict isolation: Pages tab strictly displays Category knowledge pages (excluding all `__daily_journal__` and legacy daily journal entries).
     - Category Grouping: Top-level view groups pages into Category sections with signature color dots, title headers, count pills, and chronological sorting by modification date, plus General Knowledge section for uncategorized pages.
   - **Flowy Welcome Onboarding Journey (`OnboardingWelcome.tsx`)**:
     - Dual-mode daily flow: Full 3-slide journey on 1st login of the day, compact 1-slide Quick-Return card on subsequent logins the same day, auto-skipping on same-tab refreshes.
     - Interactive live 4-theme picker & spatial layout selector, live NLP quick-capture input directly in Slide 2, interactive morning habits check-in, and offline Web Audio soundscape selector.
     - Cinematic GPU-accelerated morph transition into `Today.tsx` on completion; replayable on-demand from Settings or `Ctrl + K`.
   - **Comprehensive Automated Test Coverage**: Added 12 new unit tests across 2 new test suites (`journalAutoSave.test.ts` & `pagesGrouping.test.ts`), bringing the full test suite to **66 passing unit tests**.

4. ✅ **Sprint 1 — Contrast Polish, Always-on-Top Floating HUD & Bottom Dock**:
   - **Swiss Brutal & Swiss Onyx Contrast Overhaul**: Enforced universal inversion rules in `src/index.css`. In Swiss Brutal, tab buttons render acid citron (`#c8ff29`) on black (`#0d0f0d`) with a **16.3:1** contrast ratio. In Swiss Onyx, active/accent items enforce pure pitch-black (`#000000 !important`) font with a **13.9:1** ratio.
   - **Automated WCAG 2.1 Contrast Suite (`colorContrast.test.ts`)**: 28 automated tests in Vitest calculating W3C relative luminance and contrast ratios, enforcing AA (4.5:1) / AAA (7:1) across all 4 themes (`solaris`, `bauhaus`, `nocturne`, `onyx`).
   - **Always-on-Top Floating HUD (`FloatingHUD.tsx` via Document Picture-in-Picture)**:
     - React portal into native OS-level floating PiP window (`pipHud.ts`).
     - Dual-State: Micro-Pill (`300 × 84 px`) ↔ Expandable Flow Drawer (`320 × 260 px`) with dynamic window resizing.
     - Live subtask checklist with direct Dexie updates from the HUD.
     - In-Session Scratchpad for rapid thought capture timestamped to task notes.
     - Flow Overtime mode: soft chime at 00:00, upward overtime counter (`+00:01`…), and overtime banking.
     - Sonic Anchor auto-ducking: procedural soundscapes duck by 80% on pause.
     - Popout triggers integrated in `MiniTimer.tsx`, `Pomodoro.tsx`, and `Header.tsx`.
   - **Bottom-Anchored Homepage App Dock (`AppDock.tsx`)**:
     - Anchored at `fixed bottom-4 left-1/2 -translate-x-1/2 z-40` with `pb-28` canvas spacing.
     - 60fps spring-physics Gaussian hover magnification wave ($\text{scale}(d) = 1 + 0.35 \times \exp(-d^2 / (2 \cdot 55^2))$).
     - Active task workspace indicator: glowing accent dot beneath apps matching current task.
     - Quick-launcher for Spotify, YouTube, Discord, Antigravity, VS Code, and GitHub with popover manager.

5. ✅ **Reliability Hardening & Codebase Audit Remediation**:
   - **JSON Backup Subsystem Deprecation**: Completely eliminated legacy JSON backup & folder sync (`backup.ts`, `backupExport.ts`, `backupReminder.ts`, `folderSync.ts`, and Settings UI) in preparation for the upcoming native desktop storage/backup engine.
   - **Fixed Appointment Immutability**: Fixed `applySmartScheduleTimeBlocks` to strictly preserve scheduled appointment times (`fixed-anchor`), and automatically reschedule overdue tasks' `dueDate` to today when accepted into today's time-block schedule.
   - **Category Deletion Goals Remapping**: `removeCategory` now transactionally remaps `db.goals` alongside tasks and pages to prevent orphaned category references.
   - **Timezone Fix in Overdue Notifications**: Replaced UTC date slicing with local `isoToday()` in `App.tsx`.
   - **Global Shortcuts Typing Guard**: `Ctrl+N` and `Ctrl+1-5` are now guarded against active text inputs, textareas, selects, and TipTap rich-text contenteditable elements.
   - **Task Order & Launch Links Preservation**: `normalizeTask` now preserves manual drag-and-drop `order` and `launchLinks`.
   - **Test Suite Expanded**: Added unit tests for fixed appointment immutability and task order preservation (18/18 tests passing).

6. ✅ **Sprint 6 — Command Hub & App Launchpad**:
   - Zero-dependency unified launcher (`src/lib/launcher.ts`) supporting native URI protocols (`spotify://`, `discord://`, `antigravity://open`, `vscode://`, `cursor://`, `obsidian://`) and web workspaces (`youtube.com`, `github.com`, localhost).
   - Tailored `AppDock` component with one-click app launching for Spotify, YouTube, Discord, Antigravity, VS Code, and GitHub.
   - Task-level Workspace Links & 1-Click "Focus & Launch" in `TaskCard.tsx` and `TaskEditor.tsx`.
   - Command Palette (`Ctrl + K`) indexing of launch links under "Apps & Workspaces".

7. ✅ **Sprint 7 — Dynamic Time-Aware Daily Briefing**:
   - Adaptive `DailyBriefing.tsx` reacting to current time:
     - **Morning (05:00–12:00)**: Focus agenda, planned hours, 1-click Smart Schedule optimizer.
     - **Midday (12:00–18:00)**: Momentum tracking, completed vs remaining ratio.
     - **Evening (18:00+)**: Daily wrap-up, 1-click **Roll Over Unfinished Tasks** to tomorrow, and 1-click **Log Daily Summary to Journal** (writes rich text into `db.journalEntries`).
     - Manual override pills (`Auto` | `Morning` | `Midday` | `Evening`).

---

## Architectural Decisions: Deferred Initiatives

The following initiatives were evaluated and deliberately deferred to preserve FocusSpace's core tenets:

1. ⏸️ **Remote Cloud Sync / Multi-Device CRDTs**:
   - *Deferred Reason*: Introducing cloud relays or CRDT synchronization introduces latency, external backend dependencies, and cloud privacy liabilities. Local-first IndexedDB remains 100% private and instant.
2. ⏸️ **External Cloud LLM Scheduling / Auto-Categorization**:
   - *Deferred Reason*: Cloud API calls violate the offline-first mandate, introduce latency, and require API keys. The deterministic heuristic scheduler (`smartScheduler.ts`) solves 95% of scheduling needs sub-millisecond without network access.
3. ⏸️ **Native File-System Auto-Sync via Chromium FS Access API**:
   - *Deferred Reason*: Browser-based File System Access API has erratic permission prompts and lacks cross-browser parity. Replaced in favor of native Tauri v2 desktop storage.

---

## 📌 Priority Roadmap: Windows Hardening & Tauri v2

This roadmap is tracked in [`TODO.md`](file:///d:/focusspace-phase75/FocusSpace/TODO.md) and governed by [`WINDOWS_TAURI_GUIDE.md`](file:///d:/focusspace-phase75/FocusSpace/WINDOWS_TAURI_GUIDE.md):

1. ✅ **Phase A: Web Build Stabilization (Tauri Readiness) — [GATE A REACHED]**:
   - **A1. Backup Fidelity**: Preserve file blob MIME type, add Dexie `schemaVersion: 4` check, add `settings` theme block, pre-restore safety snapshot in memory, and manual restore test.
   - **A2. Voice Fixes**: Replaced 25s truncation with acoustic quiet-window chunking (`splitter.ts`), deduplicated ONNX WASM & MJS loaders into `public/ort/` (shrunk public by 155 MB), created `check-voice-assets.mjs`, real Gate 0 WER benchmark in `BenchPage.tsx` and `src/voice/README.md`, cross-origin isolation (COOP/COEP in `vite.config.ts`), removed `Ctrl+Shift+V` hotkey (kept `Alt+V`), `micVad.destroy()` hardware release, safe range undo in `inputTarget.ts`.
   - **A3. Housekeeping**: Accurate test count (100/100 tests), boot-time `navigator.storage.persist()`.
   - **Gate A Results**: 100/100 tests passing in 680ms; `tsc -b && vite build` clean in 1.54s; `check-voice-assets` verified 17/17 assets (58.85 MB); public directory shrunk to 59.09 MB; Gate 0 WER benchmarks marked UNVERIFIED pending owner's test clips; awaiting owner approval to advance.

2. ⏳ **Phases B–H: Desktop Hardening**:
   - **Phase B**: Empty Tauri v2 shell (`com.focusspace.desktop`, `build:tauri` mode, voice off, single instance).
   - **Phase C**: Data safety (atomic local vault writes, 11:59 PM auto-snapshot, restore safety).
   - **Phase D**: Native adapters (opener allow-list, native notifications, tray & close-to-tray).
   - **Phase E**: Native floating HUD window (cross-window bus, frameless transparent window).
   - **Phase F**: Configurable global hotkeys (`Ctrl+Alt+Space`, `Ctrl+Alt+H`).
   - **Phase G**: Voice in Tauri build (minimal bundle packaging, COOP/COEP, mic permissions).
   - **Phase H**: Release hardening (NSIS installer, crash boundary, uninstall data safety).

---

## Verification & Health Check

- **Tests**: **103/103 Vitest unit tests passing** across 14 test suites (`src/lib/__tests__/*`, `src/voice/cleanup/*`, `src/voice/engine/*`, `src/voice/target/*`, `src/voice/bench/*`)
- **Type Checking & Production Build**: `tsc -b && vite build` passing with 0 errors in 1.25s
- **Tauri Build Mode**: `npm run build:tauri` passing with 0 errors in 1.28s, with `dist/models`, `dist/vad`, `dist/ort` cleanly stripped and PWA service worker disabled
- **Voice Assets Integrity**: `npm run check:voice` passing with 17/17 verified offline assets (58.85 MB)
- **Public Directory Footprint**: Reduced from 214.00 MB to **59.09 MB** (13.63 MB WASM/MJS, 2.23 MB VAD, 43.00 MB Whisper model)
- **Tauri Security Baseline**: Strict CSP configured in `tauri.conf.json`, `tauri-plugin-single-instance`, `tauri-plugin-window-state` initialized, frozen identifier `com.focusspace.desktop`
- **Cross-Origin Isolated**: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` configured in `vite.config.ts`
- **Git Invariant**: Commit and push reserved exclusively for user via GitHub Desktop

