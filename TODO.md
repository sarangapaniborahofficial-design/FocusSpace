# FocusSpace Task & Feature Backlog

This document maintains the persistent, prioritized queue of upcoming sprints, features, bug fixes, and system improvements based on the Master System Design Blueprint.

---

## 🎯 Sprint 1: Contrast Polish, Always-on-Top Floating HUD & Bottom Dock (✅ COMPLETED)

### 1.1 Swiss Brutal Tab Contrast Bug & Automated WCAG Contrast Suite (✅ DONE)
- **Resolved**: Added universal high-contrast inversion rules in `src/index.css`. In Swiss Brutal (`data-theme="bauhaus"`), active tabs display high-contrast acid citron (`#c8ff29`) against black (`#0d0f0d`) with a **16.3:1** contrast ratio (exceeding WCAG AAA 7:1). In Swiss Onyx (`data-theme="onyx"`), active/accent buttons, tabs, and badges enforce pure jet-black (`#000000 !important`) with a **13.9:1** ratio.
- **Automated Vitest Contrast Suite (`src/lib/__tests__/colorContrast.test.ts`)**: 28 automated tests programmatically verifying WCAG 2.1 AA/AAA compliance across all 4 themes (`solaris`, `bauhaus`, `nocturne`, `onyx`) with bug regression guards.

### 1.2 Always-on-Top Floating HUD (`FloatingHUD.tsx` via Document Picture-in-Picture) (✅ DONE)
- **Resolved**: Built native OS-level Document Picture-in-Picture floating window (`src/lib/pipHud.ts`, `src/components/FloatingHUD.tsx`).
- **Capabilities Delivered**:
  - **Dual-State Mode**: Micro-Pill (`300 × 84 px`) ↔ Expandable Flow Drawer (`320 × 260 px`) with smooth dynamic resizing.
  - **Live Subtask Checklist**: Check off items directly from the HUD without leaving external coding/writing apps.
  - **In-Session Scratchpad**: 1-line quick-capture input saving timestamped thoughts directly into task notes.
  - **Flow Overtime Mode**: Soft chime at `00:00`, logs focus session, transitions to upward overtime counter (`+00:01`…), and banks extra overtime upon taking break.
  - **Sonic Anchor Auto-Ducking**: Soundscape volume ducks by 80% on pause, resuming full volume when timer starts.
  - **HUD Popout Triggers**: Integrated in `Header.tsx`, `MiniTimer.tsx`, and `Pomodoro.tsx`.

### 1.3 Bottom-Anchored Homepage App Dock (`AppDock.tsx`) (✅ DONE)
- **Resolved**: Transformed into floating bottom dock tray anchored at `fixed bottom-4 left-1/2 -translate-x-1/2 z-40` with `pb-28` canvas padding on Today page.
- **Capabilities Delivered**:
  - 60fps spring-physics Gaussian hover magnification wave: $\text{scale}(d) = 1 + 0.35 \times \exp\left(-\frac{d^2}{2 \cdot 55^2}\right)$.
  - Active task workspace indicator: glowing accent dot beneath attached apps (Spotify, VS Code, GitHub, Discord, Antigravity).
  - Quick-manage drawer for pinning and removing tools.

---

## 🎯 Sprint 2: Workspace Knowledge Split & Flowy Onboarding (✅ COMPLETED)

### 2.1 Dedicated Journal Workspace Tab (`Journal.tsx`) & 11:59 PM Auto-Save Engine (`journalAutoSave.ts`) (✅ DONE)
- **Resolved**: First-class Workspace navigation tab with shortcut `Ctrl + J` / `Ctrl + 6`.
- **Dual-Trigger Auto-Save**: Live midnight timer at `23:59:00` local time + next-morning boot catch-up if computer was asleep.
- **TipTap Rich-Text Editor**: Live reflection editing, manual "Capture Snapshot Now" trigger, live telemetry strip (focus time, completed tasks, habits), and chronological date archive navigator.
- **Storage Invariant**: Uses reserved constant `DAILY_JOURNAL_PAGE_ID = '__daily_journal__'` in `db.journalEntries`.

### 2.2 Category-Grouped Pages Tab (`PagesList.tsx`) (✅ DONE)
- **Strict Isolation**: Pages tab strictly displays Category knowledge pages (excluding all `__daily_journal__` and legacy daily journal entries).
- **Category Grouping**: Top-level view groups pages into Category sections with signature color dots, title headers, count pills, and chronological sorting by modification date, plus General Knowledge section for uncategorized pages.

### 2.3 Flowy Welcome Onboarding Journey (`OnboardingWelcome.tsx`) (✅ DONE)
- **Dual-Mode Daily Flow**:
  - **1st Login of the Day**: Full 3-slide flowy journey:
    - Slide 1: Welcome & Local Vault philosophy (with live interactive 4-theme picker & spatial layout selector).
    - Slide 2: The 3 Core Execution Pillars (live NLP quick-capture input, smart scheduling, app launchpad).
    - Slide 3: Habits check-in, offline focus soundscape pre-selector & 11:59 PM daily review loop.
  - **2nd+ Login Same Day**: Shorter 1-slide Quick-Return card with 3-cell pulse strip and 1-click `▶ Focus Now` trigger on the next task up.
  - **Same-Tab Reload**: Automatically skips modal so refreshes never interrupt work.
- **Cinematic GPU Morph Transition**: Smooth scale/blur dissolve into `Today.tsx` on completion.
- **Replayable on-demand**: Replayable from Settings or `Ctrl + K` Command Palette.

---

## 🎯 Sprint 3: Universal Floating Dock & Offline Voice Typing Studio (✅ COMPLETED)

### 3.1 Universal Persistent Floating Dock & Official Vector Logos (✅ DONE)
- **Resolved**: App Dock is now mounted globally at root `App.tsx` level (`fixed bottom-4 left-1/2 -translate-x-1/2 z-40`) with `pb-28 sm:pb-24` clearance across all tab views.
- **Official Vector Logos (`BrandIcons.tsx`)**: Replaced generic Lucide icons with authentic brand geometry and hex palettes for VS Code, Cursor, Spotify, YouTube, Discord, Antigravity, GitHub, Obsidian, Figma, Slack, Notion, and Terminal.
- **Physics**: 60fps spring-physics Gaussian hover magnification wave ($\text{scale}(d) = 1 + 0.35 \times \exp(-d^2 / (2 \cdot 55^2))$) and active task workspace glowing indicator.

### 3.2 100% Offline Voice Typing Studio (`src/voice/`) (✅ DONE)
- **Strict Privacy Invariant**: 100% on-device WASM only. Zero third-party network calls. Audio exists strictly in volatile RAM as 16 kHz Float32Array and is never persisted to disk or IndexedDB.
- **Components Built**:
  - `engine/asr.worker.ts`: Dedicated Web Worker running `@huggingface/transformers` ONNX Runtime WASM backend (q8 quantized).
  - `engine/AsrClient.ts`: Single-flight FIFO queue, automatic crash restart recovery, pre-inference RMS check and post-inference hallucination filter.
  - `capture/vad.ts`: Silero VAD (`@ricky0123/vad-web`) with 1000ms redemption silence pause, 400ms min speech, and 300ms pre-speech padding.
  - `cleanup/disfluency.ts`: Pure Light Disfluency Cleaner stripping whitelist fillers (`um`, `uh`), collapsing whitelist duplicate stutters, and executing voice commands (`"scratch that"`, `"new line"`, `"new paragraph"`).
  - `cleanup/disfluency.test.ts`: 10 comprehensive unit tests integrated into CI.
  - `target/DictationTarget.ts`, `inputTarget.ts`, `tiptapTarget.ts`: Pluggable targets for task inputs, quick add, and rich-text TipTap journal notes.
  - `ui/MicButton.tsx` & `DictationHud.tsx`: Sleek keycap microphone button and real-time audio waveform equalizer HUD.
  - `Settings.tsx`: Voice Studio telemetry, architecture overview, and 1-click engine warmup test.
  - `scripts/fetch-models.mjs`: Dev-time provisioning script for offline ONNX weights.

### 3.3 Native Windows Shell (Tauri v2) (⏳ DEFERRED PER DIRECTIVE)
- **Status**: Deferred past Sprint 3 per explicit user directive ("no need to get the windows wrapper this sprint. defer it and note it down"). Moved to Sprint 4 / Backlog.

### 3.4 PWA Blockers & Tauri v2 Readiness Remediation (✅ COMPLETED)
- **Blocker 1 (Data Portability)**: Full JSON export & import round-trip engine (`src/lib/backup.ts`) with schema recovery (`normalize.ts`), keeping IndexedDB as the source of truth across all 10 Dexie tables (`categories`, `tasks`, `habits`, `goals`, `focusLogs`, `pages`, `journalEntries`, `pageLinks`, `files`, `fileBlobs`), file blob base64 serialization, and real-time Data Vault UI in `Settings.tsx` + 5 comprehensive unit tests in `src/lib/__tests__/backup.test.ts`.
- **Blocker 2 (Voice Verification & Bug Fixes)**: Correct Whisper English-only language options (omitting language/task for `.en` models), configured local ONNX WASM path (`/models/wasm/`), provisioned Silero VAD & ONNX WASM files offline (`scripts/provision-voice.mjs`), added 25s utterance cap (`MAX_UTTERANCE_SAMPLES = 400,000`), fixed React 19 synthetic input value tracking via prototype descriptor setter (`inputTarget.ts`), eliminated regex crashes in `isDegenerateLoop`, fixed stale VAD callback closures (`optionsRef`), and recorded Gate 0 benchmarks (`src/voice/README.md`).
- **Blocker 3 (Local Fonts)**: Eliminated external Google Fonts CDN links from `index.html`, bundled `@fontsource` packages locally (`@fontsource/space-grotesk`, `@fontsource/instrument-serif`, `@fontsource/jetbrains-mono`, `@fontsource/geist-sans`) in `src/index.css`, verified Vite builds all `.woff`/`.woff2` fonts into `dist/assets/` offline with 0 external requests, and removed obsolete `google-fonts-cache` `runtimeCaching` from `vite.config.ts`.
- **Blocker 4 (Pinned Dependencies)**: Pinned exact versions for all 18 dependencies previously using `"latest"` in `package.json` (`@tailwindcss/vite: 4.3.3`, `@tiptap/*: 3.31.3`, `react: 19.3.0`, `dexie: 4.4.6`, `vite: 8.3.1`, etc.).

---

## ⏳ Sprint 4: Mobile Companion & Windows Native Shell

### 4.1 One-Way Android Feeder App & Windows Triage Tray
- Mobile quick-capture envelope (`FocusSpaceDropEnvelope`).
- Zero-cloud local transport: Local Wi-Fi Direct push (QR code scan, <50ms) or `.fsdrop` file drop.
- Windows Flagship Morning/Evening Briefing "Phone Drop Triage Tray" (Enter to Task, J to Journal, P to Page).

### 4.2 Tauri v2 Native Windows Flagship Wrapper (Deferred from Sprint 3)
- Sub-15MB installer, ~40MB RAM footprint.
- Native Windows system tray with timer badge and global hotkey `Ctrl+Shift+Space`.
- True frameless, transparent, draggable Always-on-Top HUD window (`WebviewWindow('hud')`).
- Direct local JSON/SQLite backup folder write (`C:\Users\<User>\FocusSpace\Backups\`).

---

## 📋 Comprehensive Status Overview

| Item | Phase | Status | Notes |
|------|-------|--------|-------|
| Task Management & Categories | 1–5 | ✅ Done | Hierarchical tasks, recurring rules, drag-and-drop |
| Smart Day Scheduler | 6 | ✅ Done | Workday boundaries, buffer times, greedy packing |
| Soundscape Generator | 6 | ✅ Done | Web Audio API synth (White, Pink, Brown, Binaural) |
| Command Hub & App Launchpad | 9 | ✅ Done | Native URI & web launching, task links, dock component |
| Dynamic Time-Aware Daily Briefing | 9 | ✅ Done | Morning/Midday/Evening contexts, rollover, reflection export |
| Reliability Hardening & Cleanup | 9.5 | ✅ Done | Removed JSON backup/sync, fixed anchor immutability, overdue rescheduling, category goal remap, timezone fix, shortcut typing guard |
| Swiss Brutal Tab Contrast & WCAG Suite | 10 (Sprint 1) | ✅ Done | Inversion safety in index.css + 28 automated WCAG tests in CI |
| Always-on-Top Floating HUD (PiP) | 10 (Sprint 1) | ✅ Done | Document PiP floating window, scratchpad, subtasks, Flow Overtime |
| Bottom-Anchored Homepage App Dock | 10 (Sprint 1) | ✅ Done | Centered floating bottom dock, 60fps Gaussian magnification wave |
| Dedicated Journal Tab (11:59 PM Auto-Save) | 11 (Sprint 2) | ✅ Done | Auto daily snapshot at deadline + catch-up, TipTap editor |
| Pages Tab Category Grouping & Sorting | 11 (Sprint 2) | ✅ Done | Strict category pages only, hierarchical group & date sorting |
| Flowy 3-Slide Welcome Onboarding | 11 (Sprint 2) | ✅ Done | Dual-mode daily flow, live NLP & theme picker, GPU morph |
| Universal Floating App Dock & Vector Logos | 12 (Sprint 3) | ✅ Done | Persistent bottom dock across all views + official vector SVGs |
| 100% Offline Voice Typing Studio | 12 (Sprint 3) | ✅ Done | On-device WASM Whisper, Silero VAD, Light disfluency engine, HUD |
| PWA Blockers & Tauri v2 Readiness | 12 (Sprint 3) | ✅ Done | JSON Backup Vault, Local Bundled Fonts, 18 Pinned Deps, Voice Engine Hardening |
| Native Windows Tauri v2 Wrapper | 12 (Sprint 3) | ⏸️ Deferred | Deferred past Sprint 3 per user instruction; queued for Sprint 4 |
| One-Way Android Capture Feeder | 13 (Sprint 4) | ⏳ Queued | Phone → Laptop capture, local Wi-Fi push, triage tray |
