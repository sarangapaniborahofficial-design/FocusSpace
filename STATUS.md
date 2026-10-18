# FocusSpace — System Status & Architectural Ground Truth

**Release:** v2.4.0  
**Runtime:** Electron 44.8.0 (Node 22 / Chromium 134) + React 19.3.0 + Dexie v4.4.6  
**State:** Clean Slate Baseline Established (All legacy roadmaps, abandoned mobile feeders, and deprecated sprint backlogs purged)  
**Verification:** 139/139 Vitest Specs Passing · Argus 7-Tier Oracle Healthy (7/7 Tiers Passed)

---

## 🏛️ Executive Architectural Summary

FocusSpace is a sovereign, local-first deep work operating system and flow-state acceleration studio for Windows. It operates with a **strict zero-network perimeter** (`connect-src 'self'`), running all databases, heuristic schedulers, acoustic soundscape generators, and machine-learning speech recognition (Whisper WASM + Silero VAD) 100% on local hardware.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FOCUSSPACE RUNTIME MATRIX                       │
├────────────────────────────────────────────────────────────────────────┤
│  [✓] 100% Local-First Storage (Dexie v4 IndexedDB + Atomic Disk Vault) │
│  [✓] Zero Cloud Network Perimeter (Outbound requests blocked via CSP)  │
│  [✓] Offline Whisper WASM SIMD & Silero VAD v5 Voice Typing            │
│  [✓] Hardware Audio Synthesis (Zero audio files, 100% Web Audio API)   │
│  [✓] Native Windows 11 Shell (Mica Material, Native TitleBarOverlay)   │
│  [✓] Always-on-Top Frameless Floating HUD (440px tactile geometry)     │
│  [✓] Native Win32 Screen Time & Distraction Nudge Engine               │
│  [✓] Mathematical WCAG AAA Contrast (Ratios > 16:1 across all 4 themes)│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Core Subsystem Reality & Working Mechanics

### 1. Hardened Native Desktop Shell (`electron/main.cjs`, `electron/preload.cjs`)
* **Window Architecture**: Frameless, Windows 11 Mica material background with native DWM caption buttons (`titleBarOverlay: { color, symbolColor, height: 48 }`) dynamically synchronized with the active theme (`nocturne`, `onyx`, `solaris`, `bauhaus`).
* **Zero Outbound Traffic**: `session.defaultSession.webRequest.onBeforeRequest` cancels all non-`app://` outbound traffic. Combined with strict Content Security Policy (`default-src 'self' app:`), no data can leak to remote servers.
* **Single Instance & Crash Recovery**: `app.requestSingleInstanceLock()` prevents concurrent execution. `render-process-gone` listeners automatically reload damaged windows to prevent black-screen hangs.
* **Navigation Locks**: `setWindowOpenHandler` denies popup creations; internal navigation is locked strictly to `app://focusspace/`. External links and application shortcuts launch via sanitized child processes with `shell: false` (zero `cmd.exe` injection risk).
* **System Tray & Conflict-Free Hotkeys**: Native system tray with quick restore, HUD toggle, and quit actions. Global shortcuts:
  * `Ctrl + Alt + Space`: Quick Capture & Voice Dictation
  * `Ctrl + Alt + H`: Toggle Always-on-Top Floating HUD
  * `Ctrl + Alt + D`: Restore & Focus Main Window

### 2. Local-First Database & Atomic Disk Vault Mirroring (`src/db/db.ts`, `src/lib/backup.ts`)
* **IndexedDB Schema**: Dexie v4 managing 10 transactional tables:
  1. `tasks`: Hierarchical tasks, recurrence rules, priority rankings, drag-and-drop orders, and external launch links.
  2. `categories`: Workspace category buckets with custom hex color identities and default tags.
  3. `habits`: Daily consistency items with multi-week completion date arrays and target labels.
  4. `goals`: Metric targets (manual, tasks-completed, focus-hours, habit-streak) with deadlines.
  5. `focusLogs`: Granular focus, short-break, and long-break session intervals with wall-clock timestamps.
  6. `pages`: Knowledge dashboard pages (title, description, category assignment, legacy migration fields).
  7. `journalEntries`: Chronological rich-text daily reflections (`[pageId+date]` compound primary key).
  8. `pageLinks`: Live entity references linking tasks, habits, and goals to knowledge pages.
  9. `files`: Attachment metadata (id, pageId, name, type, size, createdAt).
  10. `fileBlobs`: Raw binary blobs kept separate so list views never load heavy bytes into memory.
* **Atomic Vault Disk Mirroring**:
  * In Electron, writes JSON backups atomically (`.tmp` write followed by atomic rename) to `%APPDATA%/FocusSpace/Backups/` with strict regex validation (`^focusspace-\d{4}-\d{2}-\d{2}(-\d{6})?\.json$`).
  * 14-day rolling retention pruning with a guaranteed 3-snapshot safety floor.
  * Automated 11:59 PM nightly trigger and next-day boot catch-up.
  * In-memory pre-restore snapshot export before table truncation to guarantee zero data loss on restore errors.

### 3. Always-on-Top Floating HUD (`src/components/FloatingHUD.tsx`, `src/lib/hudBridge.ts`)
* **Dual Runtime Rendering**:
  * **Native Electron**: Dedicated 440px frameless, transparent, always-on-top window (`app://focusspace/index.html?window=hud`) pinned with `screen-saver` level z-index. Communicates bi-directionally with the main window using `BroadcastChannel('focusspace-hud-bus')`.
  * **Web Fallback**: Document Picture-in-Picture portal (`src/lib/pipHud.ts`).
* **Interactive Capabilities**:
  * Collapsed Micro-Pill (440×88 px) ↔ Expanded Flow Drawer (440×440 px) with dynamic Windows High-DPI resizing.
  * 6 bespoke tactile artboards mapped to system themes.
  * Live Todo Checklist with one-click completion.
  * Active Task Subtasks with live Dexie state synchronization.
  * In-Session Scratchpad for rapid thought capture timestamped to active task notes.
  * Ambient Sound Selector & Volume slider directly in the HUD.
  * Real-time Distraction Alerts (detects entertainment/distraction apps from the Win32 tracker and shows acoustic gentle nudges).

### 4. Native Screen Time & Digital Wellbeing (`src/lib/screenTimer.ts`, `electron/main.cjs`)
* **Win32 Active Application Polling**: Inlined PowerShell process polling every 2s via UTF-16LE Base64 execution, identifying the active process name and window title with zero external binary dependencies.
* **Intelligent Categorization**: Automatically categorizes usage into Coding & Development, Productivity & Planning, Web & Research, Communication, Media & Audio, and Distractions.
* **Ergonomic Safety**: Configurable daily screen time limits (default 4h) with 80% proactive warnings, 100% threshold alerts, and continuous session break reminders (20-20-20 rule).
* **Acoustic Nudges**: Procedural Web Audio two-tone gentle alert (440Hz -> 554.37Hz) rate-limited to avoid distraction when off-task.

### 5. 100% Offline Voice Typing Studio (`src/voice/`)
* **Speech Pipeline**:
  * **VAD**: Silero VAD v5 (`@ricky0123/vad-web`) running locally, identifying speech boundaries with 1000ms redemption pause.
  * **ASR**: HuggingFace Transformers.js running quantized Whisper `tiny.en` ONNX weights inside a dedicated Web Worker (`asr.worker.ts`).
  * **Acoustic Audio Splitter**: `splitter.ts` slices utterances >25s at the quietest 200ms RMS window in the last 3s of each segment, completely preventing attention overflow.
  * **Disfluency Sanitizer**: `cleanLight` strips speech hesitations ("um", "uh"), collapses repeated stutters ("the the"), and interprets voice commands ("scratch that", "new line", "new paragraph").
* **Universal Binding**:
  * Global hotkey `Alt + V` or inline microphone buttons bind directly to the active element.
  * React 19 synthetic input compatibility via `HTMLInputElement.prototype` descriptor setter.
  * TipTap editor target (`tiptapTarget.ts`) for seamless rich-text wiki dictation.

### 6. Procedural Ambient Soundscape Engine (`src/lib/ambientSound.ts`, `src/lib/soundscape.ts`)
* **Zero Audio Files**: 100% synthesized in real time via the Web Audio API with zero disk consumption and zero bandwidth usage.
* **Soundscape Profiles**:
  * `rain`: Cascading rainfall with soft droplet transients.
  * `ocean`: Brown noise with rolling tidal wave swells.
  * `lofi`: Warm analog room tone with soft vinyl crackle.
  * `binaural`: 10Hz alpha waves designed for focus and flow.
  * `whitenoise`: Full-frequency spectral sound mask.
* **Intelligent Cross-Window Synchronization**: Uses `focusspace-ambient-bus` BroadcastChannel so that playing audio in either the HUD or main window never doubles playback, and auto-ducks volume by 80% when Pomodoro pauses.

### 7. Productivity & Workspace Modules
* **Pomodoro Engine (`src/lib/timer.ts`)**: Wall-clock deadline architecture (`endsAt`) immune to background throttling or OS sleep. Includes Flow Overtime mode (soft chime at 00:00, upward overtime counter, overtime banking).
* **Today Workspace (`src/components/Today.tsx`)**: Daily command center displaying overdue tasks, today's schedule, drag-and-drop reordering, habit check-ins, active goals, and the resizable Pomodoro sidebar.
* **Daily Journal (`src/components/Journal.tsx`, `src/lib/journalAutoSave.ts`)**: Dedicated reflection workspace with 11:59 PM auto-save, next-morning boot catch-up, TipTap editor, daily summary generator, and historical date navigator.
* **Knowledge Pages (`src/components/PagesList.tsx`, `src/components/PageView.tsx`)**: Personal wiki grouped by category, supporting TipTap rich text, wiki-links (`[[Page Name]]`), live backlinks, entity references, and file attachments.
* **Smart Day Scheduler (`src/lib/smartScheduler.ts`)**: Local offline cognitive-load optimizer packing quick wins into available time windows and respecting fixed appointment anchors.
* **Calendar (`src/components/Calendar.tsx`)**: FullCalendar day, week, and month grids with drag-and-drop time-blocking and RFC 5545 `.ics` export/import.
* **Analytics & Review (`src/components/Analytics.tsx`, `src/components/Review.tsx`)**: Focus distribution graphs, completion ratios, habit streaks, weekly retrospective reflections, and Markdown export.
* **Architectural Themes (`src/index.css`)**: 4 high-contrast themes (Solaris, Bauhaus, Nocturne, Onyx) mathematically validated for WCAG AAA compliance (>16:1 contrast ratio).

---

## 🔬 System Health & Verification Scorecard

| Verification Gate | Command | Result | Details |
|---|---|:---:|---|
| **Static Typing** | `tsc -b` | ✅ PASS | 0 errors |
| **Unit & Integration Tests** | `npm test` | ✅ PASS | 139 passed across 18 test suites (~800ms) |
| **Argus 7-Tier Verification Oracle** | `npm run argus` | ✅ PASS | All 7/7 tiers passed (Types, Unit, DB, Voice, Electron, UI/WCAG, Package) |
| **Production Build** | `npm run build` | ✅ PASS | Clean Vite & Tailwind v4 compilation |
| **Offline Voice Assets** | `npm run check:voice` | ✅ PASS | 17/17 runtime assets verified (58.85 MB) |
| **Git Working Tree** | `git status` | ✅ CLEAN | Working tree clean on `main` |

---

## 🧹 Clean Slate Status

* **Legacy Backlogs**: All abandoned mobile companion ideas, stale sprint mappings, and deprecated JSON backup notes have been removed.
* **Current State**: Stable, verified, standalone desktop application baseline at v2.4.0.
* **Next Step**: Awaiting the user's fresh roadmaps and directives.
