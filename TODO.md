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

## ⏳ Sprint 2: Workspace Knowledge Split & Flowy Onboarding (Next Queue)

### 2.1 Dedicated Journal Workspace Tab (`Journal.tsx`) & 11:59 PM Auto-Save Engine (`journalAutoSave.ts`)
- First-class Workspace navigation tab with dedicated keyboard shortcut.
- Dual-trigger auto-save: Live midnight timer at 23:59:00 + next-morning boot catch-up if computer was asleep.
- TipTap rich-text editor with live entity check-ins, manual reflection trigger, and chronological date archive.

### 2.2 Category-Grouped Pages Tab (`PagesList.tsx`)
- Strict isolation: Pages tab strictly displays Category knowledge pages (excluding `__daily_journal__` entries).
- Grouped by Category header with color indicators, sorted chronologically by modification/creation date.

### 2.3 Flowy 3-Slide Welcome Onboarding Journey (`Onboarding.tsx`)
- Slide 1: Welcome & Local Vault philosophy (with live theme selector).
- Slide 2: The 3 Core Execution Pillars (NLP Task Capture, Smart Day Scheduler, Workspace Launchpad).
- Slide 3: Habits, Rotary Pomodoro Dial & Daily Review.
- Cinematic GPU-accelerated morph transition into `Today.tsx`.
- Replayable on-demand via Settings or `Ctrl + K`.

---

## ⏳ Sprint 3: Native Windows Shell (Tauri v2) & Offline Voice Studio

### 3.1 Tauri v2 Native Windows Flagship Wrapper
- Sub-15MB installer, ~40MB RAM footprint.
- Native Windows system tray with timer badge and global hotkey `Ctrl+Shift+Space`.
- True frameless, transparent, draggable Always-on-Top HUD window (`WebviewWindow('hud')`).
- Direct local JSON/SQLite backup folder write (`C:\Users\<User>\FocusSpace\Backups\`).

### 3.2 100% Offline Voice Typing Studio (`voiceEngine.ts`, `disfluency.ts`, `VoiceDock.tsx`)
- Whisper WASM (Transformers.js) / Web Speech fallback running in Web Worker.
- Real-time 4-pass Disfluency Sanitizer: strips acoustic fillers ("um", "ah"), discourse hedges ("like", "you know"), collapses stutters ("the the"), and auto-capitalizes/punctuates.
- Floating Live Review Dock with 1-click routing to Task, Journal, or Page Note.

---

## ⏳ Sprint 4: Mobile Companion (Android Capture Feeder)

### 4.1 One-Way Android Feeder App & Windows Triage Tray
- Mobile quick-capture envelope (`FocusSpaceDropEnvelope`).
- Zero-cloud local transport: Local Wi-Fi Direct push (QR code scan, <50ms) or `.fsdrop` file drop.
- Windows Flagship Morning/Evening Briefing "Phone Drop Triage Tray" (Enter to Task, J to Journal, P to Page).

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
| Dedicated Journal Tab (11:59 PM Auto-Save) | 11 (Sprint 2) | ⏳ Queued | Auto daily snapshot at deadline + catch-up, TipTap editor |
| Pages Tab Category Grouping & Sorting | 11 (Sprint 2) | ⏳ Queued | Strict category pages only, hierarchical group & date sorting |
| Flowy 3-Slide Welcome Onboarding | 11 (Sprint 2) | ⏳ Queued | 3-slide journey, cinematic morph, replayable in Settings |
| Native Windows Tauri v2 Wrapper | 12 (Sprint 3) | ⏳ Queued | Tauri v2 desktop shell with tray & global hotkeys |
| 100% Offline Voice Typing Studio | 12 (Sprint 3) | ⏳ Queued | Client-side transcription, 4-pass disfluency sanitizer, review dock |
| One-Way Android Capture Feeder | 13 (Sprint 4) | ⏳ Queued | Phone → Laptop capture, local Wi-Fi push, triage tray |
