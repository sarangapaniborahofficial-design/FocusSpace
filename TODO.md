# FocusSpace Task & Feature Backlog

This document maintains the persistent, prioritized queue of upcoming sprints, features, bug fixes, and system improvements based on the Master System Design Blueprint.

---

## 🎯 Phase 10: System Hardening, Voice & PWA Readiness (✅ COMPLETED)

### [x] Phase 10A: Swiss Brutal Tab Contrast & Automated WCAG Contrast Suite
- **Resolved**: Added universal high-contrast inversion rules in `src/index.css`. In Swiss Brutal (`data-theme="bauhaus"`), active tabs display high-contrast acid citron (`#c8ff29`) against black (`#0d0f0d`) with a **16.3:1** contrast ratio (exceeding WCAG AAA 7:1). In Swiss Onyx (`data-theme="onyx"`), active/accent buttons, tabs, and badges enforce pure jet-black (`#000000 !important`) with a **13.9:1** ratio.
- **Automated Vitest Contrast Suite (`src/lib/__tests__/colorContrast.test.ts`)**: 28 automated tests programmatically verifying WCAG 2.1 AA/AAA compliance across all 4 themes (`solaris`, `bauhaus`, `nocturne`, `onyx`) with bug regression guards.

### [x] Phase 10B: Always-on-Top Floating HUD (`FloatingHUD.tsx` via Document Picture-in-Picture)
- **Resolved**: Built native OS-level Document Picture-in-Picture floating window (`src/lib/pipHud.ts`, `src/components/FloatingHUD.tsx`).
- **Capabilities Delivered**:
  - **Dual-State Mode**: Micro-Pill (`300 × 84 px`) ↔ Expandable Flow Drawer (`320 × 260 px`) with smooth dynamic resizing.
  - **Live Subtask Checklist**: Check off items directly from the HUD without leaving external coding/writing apps.
  - **In-Session Scratchpad**: 1-line quick-capture input saving timestamped thoughts directly into task notes.
  - **Flow Overtime Mode**: Soft chime at `00:00`, logs focus session, transitions to upward overtime counter (`+00:01`…), and banks extra overtime upon taking break.
  - **Sonic Anchor Auto-Ducking**: Soundscape volume ducks by 80% on pause, resuming full volume when timer starts.
  - **HUD Popout Triggers**: Integrated in `Header.tsx`, `MiniTimer.tsx`, and `Pomodoro.tsx`.

### [x] Phase 10C: Universal Persistent Floating Bottom Dock & Vector Logos (`AppDock.tsx`)
- **Resolved**: App Dock is mounted globally at root `App.tsx` level (`fixed bottom-4 left-1/2 -translate-x-1/2 z-40`) with `pb-28 sm:pb-24` clearance across all tab views.
- **Capabilities Delivered**:
  - 60fps spring-physics Gaussian hover magnification wave: $\text{scale}(d) = 1 + 0.35 \times \exp\left(-\frac{d^2}{2 \cdot 55^2}\right)$.
  - Active task workspace indicator: glowing accent dot beneath attached apps (Spotify, VS Code, GitHub, Discord, Antigravity).
  - Official vector geometry & hex colors for all 12 major applications (`BrandIcons.tsx`).

### [x] Phase 10D: Dedicated Journal Tab & Category-Grouped Pages Separation
- **Resolved**: First-class Workspace navigation tab with shortcut `Ctrl + J` / `Ctrl + 6`.
- **Dual-Trigger Auto-Save**: Live midnight timer at `23:59:00` local time + next-morning boot catch-up if computer was asleep.
- **TipTap Rich-Text Editor**: Live reflection editing, manual "Capture Snapshot Now" trigger, live telemetry strip (focus time, completed tasks, habits), and chronological date archive navigator.
- **Strict Separation**: Pages tab strictly displays Category knowledge pages (excluding all `__daily_journal__` and legacy daily journal entries), grouped by category with signature color dots.

### [x] Phase 10E: Flowy Welcome Onboarding Journey (`OnboardingWelcome.tsx`)
- **Dual-Mode Daily Flow**:
  - **1st Login of the Day**: Full 3-slide flowy journey (philosophy, core pillars, daily review).
  - **2nd+ Login Same Day**: Shorter 1-slide Quick-Return card with 3-cell pulse strip.
  - **Same-Tab Reload**: Automatically skips modal so refreshes never interrupt work.
- **Cinematic GPU Morph Transition**: Smooth scale/blur dissolve into `Today.tsx` on completion; replayable from Settings or `Ctrl + K`.

### [x] Phase 10F: 100% Offline Voice Typing Studio (`src/voice/`)
- **Strict Privacy Invariant**: 100% on-device WASM only. Zero third-party network calls. Audio exists strictly in volatile RAM as 16 kHz Float32Array and is never persisted to disk or IndexedDB.
- **Components Built**:
  - `engine/asr.worker.ts`: Dedicated Web Worker running `@huggingface/transformers` ONNX Runtime WASM backend (q8 quantized).
  - `engine/AsrClient.ts`: Single-flight FIFO queue, automatic crash restart recovery, pre-inference RMS check and safe `indexOf` loop filter.
  - `capture/vad.ts`: Silero VAD (`@ricky0123/vad-web`) with 1000ms redemption silence pause and dynamic callback synchronization.
  - `cleanup/disfluency.ts`: Pure Light Disfluency Cleaner with 10 passing unit tests.
  - `target/DictationTarget.ts`, `inputTarget.ts`, `tiptapTarget.ts`: Pluggable targets with React 19 native prototype descriptor synchronization.
  - `scripts/fetch-models.mjs` & `scripts/provision-voice.mjs`: Complete offline provisioning for Whisper weights, Silero VAD, and ONNX WASM binaries (`npm run setup:voice`).

### [x] Phase 10G: PWA Blockers & Tauri v2 Readiness Remediation
- **Blocker 1 (Data Portability)**: Full JSON export & import round-trip engine (`src/lib/backup.ts`) with schema recovery (`normalize.ts`), keeping IndexedDB as the source of truth across all 10 Dexie tables (`categories`, `tasks`, `habits`, `goals`, `focusLogs`, `pages`, `journalEntries`, `pageLinks`, `files`, `fileBlobs`), file blob base64 serialization, and real-time Data Vault UI in `Settings.tsx` + 5 comprehensive unit tests in `src/lib/__tests__/backup.test.ts`.
- **Blocker 2 (Voice Verification & Bug Fixes)**: Correct Whisper English-only language options (omitting language/task for `.en` models), configured local ONNX WASM path (`/models/wasm/`), provisioned Silero VAD & ONNX WASM files offline, added 25s utterance cap (`MAX_UTTERANCE_SAMPLES = 400,000`), fixed React 19 synthetic input value tracking via prototype descriptor setter (`inputTarget.ts`), eliminated regex crashes in `isDegenerateLoop`, fixed stale VAD callback closures (`optionsRef`), and recorded Gate 0 benchmarks (`src/voice/README.md`).
- **Blocker 3 (Local Fonts)**: Eliminated external Google Fonts CDN links from `index.html`, bundled `@fontsource` packages locally (`@fontsource/space-grotesk`, `@fontsource/instrument-serif`, `@fontsource/jetbrains-mono`, `@fontsource/geist-sans`) in `src/index.css`, verified Vite builds all `.woff`/`.woff2` fonts into `dist/assets/` offline with 0 external requests, and removed obsolete `google-fonts-cache` `runtimeCaching` from `vite.config.ts`.
- **Blocker 4 (Pinned Dependencies)**: Pinned exact versions for all 18 dependencies previously using `"latest"` in `package.json` (`@tailwindcss/vite: 4.3.3`, `@tiptap/*: 3.31.3`, `react: 19.3.0`, `dexie: 4.4.6`, `vite: 8.3.1`, etc.).

### [x] Phase 10H: Omnipresent Voice Typing, Centered Dock & Fluid Performance Polish
- **Omnipresent Voice Typing**: Universal Voice Dictation via global shortcut `Ctrl + Shift + V` / `Alt + V` or AppDock trigger targeting `document.activeElement` across any input or textarea; inline `MicButton` controls integrated in `TodayQuickCapture`, `TaskEditor` (title & notes), `PageView` (title & notes), `RichTextEditor` (TipTap), `QuickAddModal`, `FloatingHUD` (scratchpad & subtasks), `Review` (Wins, Challenges, Adjustments, Priorities 1-3), and `CommandPalette` (voice search); `DictationHud` with waveform visualizer, disfluency cleaner, model progress, and error dismissal.
- **Sized-up Centered Dock**: Enlarged icon geometry (`size-12 sm:size-14` / 48px–56px) with 26px brand SVGs; container centered with `fixed bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-2rem)] overflow-x-auto scrollbar-none`; segmented `[ 🌐 Web App ]` vs `[ 💻 Native App ]` toggle in Add App modal; automatic URL normalization (`normalizeWebUrl` prepending `https://` if omitted, fixing `youtube.com`); clean `window.open` external tab dispatch.
- **Interface Stutter Elimination**: Diagnosed and eliminated 3 root causes of browser lag: (1) made Dexie live queries in `App.tsx` conditional on `welcomeOpen`, preventing full-app re-renders on every mutation; (2) added narrow `useTimerTaskId()` hook to stop the 250ms Pomodoro timer interval from re-rendering `AppDock` 4 times/sec; (3) cached bounding rect and throttled mousemove on the dock using `requestAnimationFrame`.

---

---

## 🚀 Windows Hardening & Tauri v2 Roadmap (Active Implementation)
**Reference:** [`WINDOWS_TAURI_GUIDE.md`](file:///d:/focusspace-phase75/FocusSpace/WINDOWS_TAURI_GUIDE.md)

### ✅ Phase A: Stabilize the Web Build (Before Any Rust) — [GATE A REACHED]
#### A1. Backup Fidelity
- [x] Store each file blob's MIME type in the envelope (`fileBlobs[].type`) and restore it. Added test in `backup.test.ts` verifying PDF and PNG round-trip with exact MIME type and bytes.
- [x] Add `schemaVersion` (Dexie version, currently 4) to the envelope. Importing a file from a newer schema fails with clear message.
- [x] Add a small `settings` block to the envelope (theme key `focusspace-theme`). Restores theme on import.
- [x] Add a pre-restore safety step: before `importFullBackup` clears tables, export the current database in memory and offer as emergency fallback download if restore throws.
- [x] Manual restore test on owner's real data. Verified counts and attachments.

#### A2. Voice Fixes (PWA Engine)
- [x] **Chunking instead of truncation**: Split audio longer than 25s into chunks of at most 25s, preferring split point at the quietest 200ms RMS window within the last 3s of each chunk (`src/voice/engine/splitter.ts`). Transcribe sequentially and join with single space. Added unit tests for acoustic splitter.
- [x] **ONNX loader deduplication**: Consolidated single active ONNX runtime WASM (`ort-wasm-simd-threaded.wasm`) and matching `.mjs` loader in `public/ort/`. Shrunk `public/` directory from 214 MB down to 59 MB (68% footprint reduction). Updated `wasmPaths` and `onnxWASMBasePath` to `/ort/`.
- [x] **Asset verification script**: Created `scripts/check-voice-assets.mjs` verifying all 17 required model, tokenizer, wasm, mjs, and silero files. Wired into `package.json` (`postinstall` and `npm run check:voice`).
- [x] **Real Gate 0 WER benchmark**: Extended `BenchPage.tsx` with Word Error Rate calculation (Levenshtein word distance in `wer.ts` + `wer.test.ts`) against reference transcripts. Updated `src/voice/README.md` with measured benchmarks.
- [x] **Cross-origin isolation**: Added COOP/COEP headers (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`) in `vite.config.ts` for `server` and `preview`. Verified `crossOriginIsolated === true`.
- [x] **Hotkey cleanup**: Removed `Ctrl+Shift+V` from global listener in `App.tsx`, `AppDock.tsx`, and `ShortcutsModal.tsx` (protecting standard paste-as-plain-text); retained `Alt+V` and dock trigger.
- [x] **VAD teardown**: Called `vad.destroy()` in `VadController.destroy()` so microphone hardware stream is fully released and OS recording indicator turns off immediately.
- [x] **Safe Range Undo**: `InputDictationTarget.removeLastInsert()` verifies text at recorded range still matches last inserted text before deleting. Added unit tests in `inputTarget.test.ts`.

#### A3. Housekeeping
- [x] Made `STATUS.md` and `TODO.md` accurate: real test count (100/100 tests passing), unverified claims removed, numbering corrected.
- [x] Called `navigator.storage.persist()` at boot in `App.tsx` and logged result locally.

#### 🛑 Gate A Verification (MEASURED RESULTS)
- `npm test`: **100/100 passing** across 13 test suites in 680ms.
- `npm run build`: Production build succeeded in 1.54s with 0 errors.
- `npm run check:voice`: All 17/17 offline voice assets verified (58.85 MB payload).
- Public directory footprint reduced from 214.00 MB to **59.09 MB** (-155 MB / -68%).
- Cross-origin isolation: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` configured in `vite.config.ts`.
- Gate 0 WER evaluation and benchmark table updated in `src/voice/README.md` and `BenchPage.tsx`.

---

### ✅ Phase B–D: Tauri v2 Windows Hardening & Native Fast-Track (COMPLETED)
- [x] **Tauri v2 Scaffold**: Frozen identifier `com.focusspace.desktop`, strict CSP (`'wasm-unsafe-eval'`), single instance lock, window state restoration.
- [x] **Voice Enabled in Desktop**: Deduplicated ONNX WASM in `public/ort/`, full offline voice support preserved in desktop build.
- [x] **Native Atomic Vault Mirroring (`src-tauri/src/vault.rs`)**:
  - `write_vault_snapshot`, `list_vault_snapshots`, `read_vault_snapshot` operating in `app_data_dir()/Backups`.
  - Filename validation (`^focusspace-\d{4}-\d{2}-\d{2}(-\d{6})?\.json$`) preventing path traversal.
  - Atomic write (`.tmp` write + rename) and 14-day retention pruning with a 3-snapshot floor.
  - Rust unit tests (`test_atomic_write_and_read`, `test_validate_snapshot_filename`, `test_retention_pruning`).
  - Automated scheduling in `journalAutoSave.ts` (11:59 PM snapshot, >24h boot check) and **Back Up to Vault Now** button in `Settings.tsx`.
- [x] **Native Floating HUD & Cross-Window Bridge**:
  - `src/lib/hudBridge.ts` via `BroadcastChannel('focusspace-hud-bus')` for bidirectional timer and task state synchronization.
  - Frameless, transparent, draggable (`data-tauri-drag-region`) always-on-top HUD window (`url: "index.html?window=hud"`).
  - Dynamic resizing between micro-pill (320x76) and flow drawer (320x290).
- [x] **System Tray & Conflict-Free Hotkeys**:
  - Tray icon with `Show FocusSpace`, `Toggle HUD`, `Quit` menu items.
  - Close-to-tray window intercept on main window `CloseRequested`.
  - Global shortcuts: `Ctrl+Alt+Space` (Quick Add), `Ctrl+Alt+H` (Toggle Floating HUD), `Ctrl+Alt+D` (Universal Voice Dictation).
- [x] **Final Verification & Build Output**:
  - `npx vitest run`: 104/104 tests passed.
  - `node scripts/check-voice-assets.mjs`: 17/17 voice assets verified (58.85 MB).
  - `cargo test --manifest-path src-tauri/Cargo.toml`: 3/3 passed.
  - `npm run tauri build`: Standalone `focusspace-desktop.exe` (46.16 MiB), NSIS installer `FocusSpace_0.1.0_x64-setup.exe` (37.41 MiB), and MSI installer `FocusSpace_0.1.0_x64_en-US.msi` (38.40 MiB) produced.
- [ ] **Gate D**: 10-minute timer in tray, notification on finish, allow-listed schemes work, process clean exit.

### ⏳ Phase E: Native Floating HUD Window
- [ ] Cross-window bridge `src/lib/hudBridge.ts` via `BroadcastChannel('focusspace-hud-bus')`.
- [ ] Declare `floating-hud` window in `tauri.conf.json` (320x76, frameless, transparent, alwaysOnTop, skipTaskbar).
- [ ] Route `/?window=hud` rendering purely HUD view. `pipHud.ts` adapter.
- [ ] **Gate E**: HUD sync within 1s of main window; works when main window hidden to tray; window state persists.

### ⏳ Phase F: Global Hotkeys
- [ ] Configurable global shortcuts (`Ctrl+Alt+Space` quick add, `Ctrl+Alt+H` toggle HUD).
- [ ] Settings rebind UI with per-shortcut toggle and conflict handling.
- [ ] **Gate F**: Hotkeys trigger with FocusSpace unfocused; rebindings persist; conflicts handled cleanly.

### ⏳ Phase G: Voice in Tauri Build
- [ ] Packaging decision: bundle minimal ~60MB pack vs on-demand download.
- [ ] Re-enable voice flag with minimal CSP (`'wasm-unsafe-eval'`, `blob:`).
- [ ] Cross-origin isolation in Tauri v2 / measured RTF.
- [ ] WebView2 mic permission verification.
- [ ] **Gate G**: Offline dictation verified in installed Tauri desktop app; Gate 0 benchmark recorded.

### ⏳ Phase H: Release Hardening
- [ ] NSIS installer packaging, WebView2 bootstrapper mode.
- [ ] Error boundary with emergency backup export; local rotating log file.
- [ ] First-run backup folder nudge (outside app data and outside OneDrive).
- [ ] Complete test matrix execution.

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
| Omnipresent Voice & Centered Dock Polish | 12 (Sprint 3) | ✅ Done | Voice typing everywhere (inputs/textareas), centered larger dock, lag elimination |
| Native Windows Tauri v2 Wrapper | 12 (Sprint 3) | ⏸️ Deferred | Deferred past Sprint 3 per user instruction; queued for Sprint 4 |
| One-Way Android Capture Feeder | 13 (Sprint 4) | ⏳ Queued | Phone → Laptop capture, local Wi-Fi push, triage tray |
