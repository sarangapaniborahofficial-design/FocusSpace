# FocusSpace — Master Roadmap & System Design Blueprint

Strategic architecture, milestone phases, and native transition gates for FocusSpace.

---

## 🧭 Core Principles

1. **Local-First Always**: Zero required backend. Dexie + IndexedDB provides 100% data ownership, instant response times, and full offline resilience.
2. **Minimalist & Distraction-Free**: Swiss architectural neo-brutalist aesthetics. Functionality reveals itself progressively without cognitive overload.
3. **Daily-Driver Hardened**: Features are designed, battle-tested, and refined through real daily execution before introducing complex extensions.
4. **Privacy-Respecting Utility**: Audio synthesis, scheduling optimization, and voice transcription operate 100% client-side without cloud leaks.
5. **PWA & Native Desktop Parity**: Deliver full local web capability while hardening native Windows execution via Electron 44 and Chromium.

---

## 🗺️ Milestone Phase Map

| Phase | Milestone Name | Status | Description |
|:-----:|----------------|:------:|-------------|
| **1–5** | Foundation & Core Engine | ✅ **Completed** | Local database schema, hierarchical tasks, calendar views, core settings. |
| **6** | Core Product Polish | ✅ **Completed** | Full analytics dashboard, goals progress tracking, RFC 5545 `.ics` export. |
| **7** | Daily-Driver Hardening | ✅ **Completed** | Recurring task rules, advanced filters, habit picker, drag-and-drop reordering. |
| **7.5**| Pages & Rich Text | ✅ **Completed** | TipTap rich-text editor, live interactive entity check-ins, auto-daily reflections. |
| **8** | Production PWA & Power Tools | ✅ **Completed** | Offline service worker, customizable smart scheduling, keyboard cheatsheet. |
| **9** | Command Hub & Daily Briefing | ✅ **Completed** | Unified app launcher (Spotify, YouTube, Discord, Antigravity, VS Code, GitHub), task workspace links, dynamic morning/midday/evening briefings, 1-click rollover and journal reflection. |
| **9.5**| Reliability Hardening & Cleanup | ✅ **Completed** | Removed legacy JSON backup/sync, fixed appointment immutability, overdue rescheduling, category goal remap, timezone fix, and shortcut typing guards. |
| **10** | Sprint 1: Contrast, HUD & Bottom Dock | ✅ **Completed** | Fixed Swiss Brutal tab contrast, automated WCAG contrast tests, Document PiP Always-on-Top HUD with Flow Overtime & scratchpad, bottom-anchored app dock with hover magnification. |
| **11** | Sprint 2: Knowledge Split & Onboarding | ✅ **Completed** | Dedicated Journal tab with 11:59 PM auto-save engine & catch-up, Category-grouped Pages tab, flowy 3-slide welcome onboarding journey with cinematic morph. |
| **12** | Sprint 3: Voice Studio & PWA Readiness | ✅ **Completed** | 100% offline voice typing studio with Silero VAD, Whisper WASM, Light disfluency engine, JSON Data Vault engine, local fonts, and pinned deps. |
| **13** | Sprint 4: Native Windows Hardening | ✅ **Completed** | Electron 44 desktop package (Tray, global hotkeys, atomic vault disk mirroring, 440px Always-on-top HUD, Zero-Network perimeter). |

---

## 🚀 Detailed Sprint Breakdown & Execution Schedule

### Sprint 1: Contrast Polish, Always-on-Top Floating HUD & Bottom Dock (Active Queue)
- **1.1: Swiss Brutal Tab Contrast Fix & WCAG Test Suite**:
  - Fix black-on-black button text bug on filter tabs ("Due today", "Done", "All", "Overdue") in Swiss Brutal (`data-theme="bauhaus"`).
  - Complete typography audit across all components to enforce pure `#000000` text in Swiss Onyx.
  - Automated Vitest suite (`src/lib/__tests__/colorContrast.test.ts`) computing W3C relative luminance and contrast ratios across all 4 themes, failing CI if any pairing drops below WCAG AA (4.5:1) / AAA (7:1).
- **1.2: Always-on-Top Floating HUD (`FloatingHUD.tsx` via Document Picture-in-Picture)**:
  - Dual-state architecture: Collapsed micro-pill (`300 × 84 px`) ↔ Expandable flow drawer (`320 × 260 px`).
  - React Portal mounting inside `documentPictureInPicture` window, sharing live JS memory, timer state, and Dexie queries.
  - Subtask checklist with live completion check-off.
  - In-session scratchpad (`Type a quick thought and press Enter` &rarr; persists to task notes and journal).
  - **Flow Overtime Mode**: Plays soft chime at `00:00`, logs the 25m focus log, and transitions into overtime (`+00:01`, `+00:02`…) until "Bank Overtime & Break" is clicked.
  - Sonic Anchor audio auto-ducking (smooth volume ducking when paused).
- **1.3: Bottom-Anchored Homepage App Dock (`AppDock.tsx`)**:
  - Relocate dock to `fixed bottom-4 left-1/2 -translate-x-1/2 z-40` with `pb-28` canvas spacing.
  - 60fps spring-physics hover magnification wave using Gaussian distance scaling: $\text{scale}(d) = 1 + 0.35 \times \exp\left(-\frac{d^2}{2 \cdot 55^2}\right)$.
  - Active task workspace indicator (subscribing to `timer.taskId` and displaying glowing accent dot for attached apps).
  - Tailored presets for Spotify, YouTube, Discord, Antigravity, VS Code, and GitHub.

---

### Sprint 2: Workspace Knowledge Split & Flowy Onboarding
- **2.1: Dedicated Journal Workspace Tab (`Journal.tsx`) & 11:59 PM Auto-Save Engine (`journalAutoSave.ts`)**:
  - First-class Sidebar navigation tab under Workspace with dedicated keyboard shortcut.
  - Dual-trigger auto-save: Live midnight timer at 23:59:00 + next-morning boot catch-up if computer was asleep.
  - TipTap rich-text editor with live entity check-ins, manual reflection trigger, and chronological date archive.
- **2.2: Category-Grouped Pages Tab (`PagesList.tsx`)**:
  - Clean separation: Pages tab strictly displays Category knowledge pages (excluding `__daily_journal__` entries).
  - Grouped by Category header with color indicators, sorted chronologically by modification/creation date.
- **2.3: Flowy 3-Slide Welcome Onboarding Journey (`Onboarding.tsx`)**:
  - Slide 1: Welcome & Local Vault philosophy (with live theme selector).
  - Slide 2: The 3 Core Execution Pillars (NLP Task Capture, Smart Day Scheduler, Workspace Launchpad).
  - Slide 3: Habits, Rotary Pomodoro Dial & Daily Review.
  - Cinematic GPU-accelerated morph transition into `Today.tsx`.
  - Replayable on-demand via Settings or `Ctrl + K`.

---

### Sprint 3: Native Windows Desktop Hardening & Offline Voice Studio
- **3.1: Electron 44 Hardened Desktop Flagship**:
  - Sandboxed Electron 44 runtime with Chromium context isolation and strict navigation locks.
  - Native Windows system tray with context controls, instant restore, and global hotkeys.
  - True frameless, transparent Always-on-Top HUD window (440px curved geometry, 6 bespoke artboards).
  - Atomic Data Vault disk mirroring (`%APPDATA%/FocusSpace/Backups/`) with rolling retention.
- **3.2: 100% Offline Voice Typing Studio (`useDictation.ts`, `disfluency.ts`, `asr.worker.ts`)**:
  - Quantized Whisper tiny.en ONNX model + Silero VAD v5 running offline in Web Worker.
  - Real-time 4-pass Disfluency Sanitizer: strips acoustic fillers ("um", "ah"), discourse hedges ("like", "you know"), collapses stutters ("the the"), and auto-capitalizes/punctuates.
  - Floating Live Review Dock with 1-click routing to Task, Journal, or Page Note.

---

### Sprint 4: Mobile Companion (Android Capture Feeder)
- **4.1: One-Way Android Feeder App & Windows Triage Tray**:
  - Mobile quick-capture envelope (`FocusSpaceDropEnvelope`).
  - Zero-cloud local transport: Local Wi-Fi Direct push (QR code scan, <50ms) or `.fsdrop` file drop.
  - Windows Flagship Morning/Evening Briefing "Phone Drop Triage Tray" (Enter to Task, J to Journal, P to Page).
