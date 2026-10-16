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
| 9.5| Reliability Hardening & Cleanup | ✅ **Completed** | Removed legacy JSON backup/sync, fixed appointment immutability, overdue rescheduling, category deletion goal remap, timezone fix, and shortcut typing guards. |
| 10 | Polish, Bug Fixes, Native & Voice | 🔄 **In Progress (Sprint 3 & PWA Blockers Complete)** | Sprint 1, Sprint 2 & Sprint 3 complete: WCAG contrast suite, Floating HUD, Universal App Dock, Dedicated Journal tab, Category-grouped Pages, Flowy Onboarding, Offline Voice Typing Studio, and 4/4 Tauri v2 Readiness Blockers resolved. |

---

## Recent Work Completed

1. ✅ **PWA Blockers & Tauri v2 Readiness Remediation**:
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
     - Gate 0 Benchmarks: Documented CPU inference latencies (Whisper Tiny ~180-250ms vs Base ~450-600ms) in `src/voice/README.md`.
   - **Blocker 3: Local Bundled Typography**:
     - Removed external Google Fonts CDN links from `index.html`.
     - Bundled `@fontsource` packages locally (`space-grotesk`, `instrument-serif`, `jetbrains-mono`, `geist-sans`) via `src/index.css`, bundling all `.woff`/`.woff2` fonts offline in `dist/assets/`.
     - Cleaned up obsolete `runtimeCaching` rule in `vite.config.ts`.
   - **Blocker 4: Pinned Dependencies**:
     - Pinned all 18 dependencies previously using `"latest"` to exact semantic versions in `package.json`.

2. ✅ **Sprint 3 — Universal Floating Dock & Offline Voice Typing Studio**:
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

2. ✅ **Sprint 1 — Contrast Polish, Always-on-Top Floating HUD & Bottom Dock**:
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

2. ✅ **Reliability Hardening & Codebase Audit Remediation**:
   - **JSON Backup Subsystem Deprecation**: Completely eliminated legacy JSON backup & folder sync (`backup.ts`, `backupExport.ts`, `backupReminder.ts`, `folderSync.ts`, and Settings UI) in preparation for the upcoming native desktop storage/backup engine.
   - **Fixed Appointment Immutability**: Fixed `applySmartScheduleTimeBlocks` to strictly preserve scheduled appointment times (`fixed-anchor`), and automatically reschedule overdue tasks' `dueDate` to today when accepted into today's time-block schedule.
   - **Category Deletion Goals Remapping**: `removeCategory` now transactionally remaps `db.goals` alongside tasks and pages to prevent orphaned category references.
   - **Timezone Fix in Overdue Notifications**: Replaced UTC date slicing with local `isoToday()` in `App.tsx`.
   - **Global Shortcuts Typing Guard**: `Ctrl+N` and `Ctrl+1-5` are now guarded against active text inputs, textareas, selects, and TipTap rich-text contenteditable elements.
   - **Task Order & Launch Links Preservation**: `normalizeTask` now preserves manual drag-and-drop `order` and `launchLinks`.
   - **Test Suite Expanded**: Added unit tests for fixed appointment immutability and task order preservation (18/18 tests passing).

2. ✅ **Sprint 6 — Command Hub & App Launchpad**:
   - Zero-dependency unified launcher (`src/lib/launcher.ts`) supporting native URI protocols (`spotify://`, `discord://`, `antigravity://open`, `vscode://`, `cursor://`, `obsidian://`) and web workspaces (`youtube.com`, `github.com`, localhost).
   - Tailored `AppDock` component with one-click app launching for Spotify, YouTube, Discord, Antigravity, VS Code, and GitHub.
   - Task-level Workspace Links & 1-Click "Focus & Launch" in `TaskCard.tsx` and `TaskEditor.tsx`.
   - Command Palette (`Ctrl + K`) indexing of launch links under "Apps & Workspaces".

3. ✅ **Sprint 7 — Dynamic Time-Aware Daily Briefing**:
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

## 📌 Priority Future Backlog (Next Queue)

These major initiatives and bug fixes are tracked in [`TODO.md`](file:///D:/focusspace-phase75/FocusSpace/TODO.md) and scheduled for upcoming development sprints:

1. 🔴 **P0 Bug: Swiss Brutal Black-on-Black Tab Contrast Glitch**:
   - Fix invisible text bug on queue filter tabs ("Due today", "Done", "All", "Overdue") in Swiss Brutal where both button background and font turn pitch-black (`#0d0f0d`).
2. 🔴 **P0 Safeguard: Automated Color Contrast & WCAG Test Suite**:
   - Automated Vitest test suite (`colorContrast.test.ts`) programmatically verifying WCAG AA/AAA contrast ratios for all foreground/background pairings across all 4 themes, failing CI if any invisible text combination is introduced.
3. 🎯 **Swiss Onyx Pure Black Typography Consistency**:
   - Comprehensive audit of Swiss Onyx theme typography to eliminate remaining low-contrast gray/muted fonts (`text-gray-400`, `text-neutral-500`).
   - Enforce pure jet black (`#000000`) across all body labels, card descriptions, badges, and modal headers.
4. 🎯 **Dedicated "Journal" Tab Under Workspace & Deadline Auto-Save**:
   - New first-class **Journal** tab in workspace navigation.
   - Automated end-of-day reflection snapshot at a set deadline (e.g., **11:59 PM**) generating daily summary into `db.journalEntries`.
   - Manual snapshot button + TipTap editing + chronological journal archive browser.
5. 🎯 **Pages Tab Separation & Hierarchical Category Sorting**:
   - Complete separation: Pages tab exclusively displays Category pages; zero daily journal page pollution.
   - Beautiful visual categorization with category color indicators and chronological sorting by date modified/created.
6. 🎯 **App Docker on the Bottom of Homepage**:
   - Dedicated, persistent dock anchored at the bottom of the Today/Home dashboard (macOS/iPadOS-style floating dock).
   - Smooth hover magnification, active workspace indicator, and quick launch for Spotify, YouTube, Discord, Antigravity, VS Code, and GitHub.
7. 🎯 **Native Windows Support (Tauri v2 Desktop Shell)**:
   - Package FocusSpace as an ultra-fast, lightweight Windows desktop application using Tauri v2 & Rust.
   - Native Windows system tray with timer status badge, global Windows hotkeys (`Ctrl+Shift+Space`), and direct local JSON/SQLite backup without browser storage eviction.
8. 🎯 **Flowy Welcome Onboarding & Slide Flow**:
   - Cinematic multi-step onboarding journey before entering the dashboard:
     - **Slide 1: Welcome** (philosophy & local-first foundation).
     - **Slide 2: What to Do** (tasks, scheduling, and workspace launchpad).
     - **Slide 3: Review** (reflection, habit tracking, and time metrics).
     - Smooth animated transition into the **Main Dashboard**.
9. 🎯 **100% Offline Voice Typing Studio**:
   - Client-side in-browser voice transcription engine (Whisper WASM / Web Speech fallback).
   - Real-time **Disfluency Sanitizer** automatically stripping fillers ("um", "ah", "so", hesitation pauses).
   - Floating **Live Review Dock** for reviewing captured text before inserting into tasks, journal reflections, or notes.

---

## Verification & Health Check

- **Tests**: 81/81 Vitest unit tests passing across 10 test suites (`src/lib/__tests__/*`, `src/voice/cleanup/*`)
- **Type Checking & Production Build**: `tsc -b && vite build` passing with 0 errors
- **PWA Service Worker**: Workbox precaching 47 offline assets (fonts, icons, chunks, styles) with 0 external Google Fonts requests
- **Layout & Responsiveness Hardening**: Decoupled overlays/portals from main flex flow, full-bleed Cockpit mode, responsive Header controls, dynamic metrics grid, and multi-tier breakpoint scaling for Today workspace
- **Git Invariant**: Commit and push reserved exclusively for user via GitHub Desktop

