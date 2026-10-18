# FocusSpace — System Roadmap & Future Directives

**Current Baseline:** FocusSpace v2.4.0 (Windows Native Electron Flagship)  
**State:** Clean Slate Baseline Established  

---

## 🧭 Core Architectural Tenets

1. **Local-First Always**: Zero required backend. Dexie v4 + IndexedDB paired with atomic disk vault snapshots (`%APPDATA%/FocusSpace/Backups/`) guarantees 100% data ownership, instant sub-millisecond response, and full offline resilience.
2. **Zero-Network Sovereignty**: No telemetry, no cloud auth, no trackers, no external CDNs. Network guards block all unauthorized outbound traffic.
3. **Hardware-Native Execution**: Client-side machine learning (Whisper WASM SIMD, Silero VAD v5) and procedural Web Audio synthesis operate entirely on local device hardware.
4. **Distraction-Free Flow State**: Swiss architectural neo-brutalism, WCAG AAA high contrast (>16:1), tactile 440px Always-on-Top Floating HUD, and wall-clock Pomodoro pacing.
5. **Windows 11 Native Integration**: Native Mica material, Windows DWM `titleBarOverlay` caption integration with dynamic theme synchrony, Win32 active app time tracking, and system tray.

---

## 🧱 Established System Baseline (v2.4.0)

The following foundations are fully built, production-compiled, and verified by Argus:

* **Foundation & State Machine**: Dexie v4 transactional schema (10 tables), Task hierarchy, subtasks, recurrence, and drag-and-drop ordering.
* **Workspace Environments**:
  * **Today Dashboard**: Overdue prioritization, daily schedule, active habits check-in, active goals, and resizable layout columns.
  * **Daily Journal**: Dedicated reflection tab with automated 11:59 PM snapshot engine, next-day catch-up, TipTap rich text, and daily summaries.
  * **Knowledge Pages**: Hierarchical wiki organized by category, TipTap rich text, wiki-links (`[[Page Name]]`), live backlinks, entity links, and attachments.
  * **Calendar**: FullCalendar day, week, and month time-blocking views with RFC 5545 `.ics` export/import.
  * **Analytics & Review**: Focus duration tracking, habit streaks, weekly retrospective reflections, and Markdown export.
* **Flow State Hardware Engines**:
  * **Pomodoro Engine**: Wall-clock deadline state machine with Flow Overtime tracking.
  * **Ambient Audio Synthesizer**: 100% Web Audio API procedural soundscapes (Rain, Ocean, Lo-Fi, Binaural Alpha Waves, White Noise) with cross-window bus and auto-ducking.
  * **Offline Voice Typing Studio**: On-device Whisper WASM SIMD, Silero VAD v5, acoustic silence-window splitter (`splitter.ts`), disfluency cleaner, and universal `Alt+V` hotkey.
* **Windows Native Hardening**:
  * **Always-on-Top Floating HUD**: Frameless 440px window with 6 tactile artboards, todo list, subtasks, scratchpad, ambient audio, and distraction alerts via `BroadcastChannel('focusspace-hud-bus')`.
  * **Screen Time & Wellbeing**: Inlined Win32 active window/process tracker, distraction detection with acoustic nudges, daily limits, and break reminders.
  * **Atomic Vault Mirroring**: Atomic `.tmp` writes to `%APPDATA%/FocusSpace/Backups/`, 14-day retention pruning, and pre-restore safety fallback.

---

## 🎯 New Roadmap Queue

*(Clean slate initialized. Awaiting user-defined milestones, feature requests, and strategic priorities.)*

| Target Milestone | Focus Area | Status | Directives |
|---|---|:---:|---|
| *Pending User Directives* | — | ⏳ Ready | Submit new roadmaps and feature requirements to begin next phase. |
