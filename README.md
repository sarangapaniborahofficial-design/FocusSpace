# FocusSpace

A modern, local-first productivity hub and focus workspace built with **React, Vite, Tailwind CSS, Dexie (IndexedDB), and FullCalendar**. 

FocusSpace runs 100% inside your browser. All data stays strictly on your local device—no remote servers, no tracking, zero telemetry, and full offline capability.

---

## ✨ Features & Architecture

### 🍱 Bento Grid UI & Design System
- **Floating Bento Window:** Floating workspace layout with refined pastel accents and flush sidebar navigation.
- **Dual High-Contrast Themes:**
  - **Light Theme:** Clean, crisp daylight palette.
  - **Dark Theme (Pure Black / OLED):** Ultra-high contrast true-black theme engineered for night sessions and zero glare.
- **Fluid Micro-Interactions:** Subtle hover states, smooth CSS transitions, and keyboard focus outlines.

---

### 🚀 Phase 4: Advanced Power Features

#### 1. 🔔 Native Browser Notifications
- **Pomodoro Session Alerts:** Native browser notifications trigger whenever a focus block or break concludes, even when working in another tab or with the browser minimized.
- **Daily Overdue Reminders:** Non-intrusive daily notification reminding you if tasks have slipped past their deadlines.
- **Permission & Test Controls:** Configurable in *Settings → Native Notifications* with one-click test alert dispatch.

#### 2. 🤏 Drag-and-Drop Task Reordering
- **Custom Sort Order:** Grab any task card in the Tasks list view or Today queue to manually reposition it.
- **"Sort: Custom Drag Order":** New sorting option that locks in your bespoke sequence.
- **Atomic Dexie Persistence:** Order indices are saved transactionally to IndexedDB, surviving reloads.

#### 3. 🏆 Weekly & Monthly Review Dashboard
- **Flexible Timeframes:** Toggle between **This Week**, **Last Week**, **This Month**, and **Last Month**.
- **Hero Performance Metrics:** Completed task count, total focus time, session averages, and habit consistency scores.
- **Accomplishments Showcase:** Categorized feed of finished tasks with priority badges and category color tags.
- **Category & Habit Breakdown:** Visual progress distributions of where your energy and time went.
- **Guided Reflection Canvas:** Auto-saved prompts per period:
  - 🌟 *Wins & Breakthroughs*
  - 🧗 *Friction & Bottlenecks*
  - 💡 *Adjustments & Lessons*
  - 🎯 *Top 3 Upcoming Priorities*
- **One-Click Export:** Instant copy of your review into a beautifully formatted Markdown report.

#### 4. 📱 Mobile Touch Gestures
- **Swipe-to-Complete:** Swiping right reveals an emerald action layer to mark a task as done (or reopen it) with full undo support.
- **Swipe-to-Delete:** Swiping left reveals a rose action layer to delete the task with an instant undo toast.
- **Scroll Disambiguation:** Direction vector tracker prevents accidental triggers during normal vertical scrolling.

#### 5. ⚡ AI Smart Scheduling & Plan Optimizer
- **Local Cognitive-Load Pacing:** Algorithmic schedule builder based on chronobiology and focus momentum:
  - Slots a ≤15m *Quick Win* first to beat procrastination and establish flow state.
  - Places intensive *Deep Work* during peak focus hours.
  - Schedules standard and administrative tasks in the afternoon.
- **Fixed Anchor Respect:** Fixed-time appointments act as immovable pins; the optimizer slots tasks into gaps and adds decompression buffers after meetings.
- **Capacity & Overload Guard:** Detects when tasks exceed reasonable working hours and suggests low-priority items to push to tomorrow.
- **One-Click Time-Blocking:** Option to stamp start times onto all tasks, instantly populating your day in FullCalendar.

---

### ⏱️ Core Productivity Suite

- **Pomodoro Timer Engine:**
  - Wall-clock deadline driven (`endsAt`), impervious to background tab throttling or laptop sleep.
  - Docked mini-timer when navigating away from the dashboard.
  - Auto-logs focus time and flushes partial sessions on reset or task switch.
- **Task Management (List & Kanban):**
  - Subtask checklists with live progress indicators.
  - Recurring tasks with anchor-day clamping (daily, weekdays, weekly, monthly).
  - Bulk select mode for multi-complete, priority batching, and bulk deletion.
- **FullCalendar Integration:**
  - Month, week, and day views with drag-and-drop scheduling.
- **Habits & Streak Tracking:**
  - Interactive daily check-ins, multi-day streak calculation, and custom habit colors.
- **Rich-Text Pages & Chronological Journal:**
  - Powered by TipTap: formatted notes, live task/habit references, and daily journal entries.
- **Command Palette (`Ctrl+K` / `⌘K`):**
  - Instant spotlight search across tasks, pages, commands, and views.
- **Backup & Restore:**
  - Full JSON database export/import with embedded file support and standard `.ics` calendar export.

---

## 🛠️ Tech Stack

- **Framework:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4
- **Database:** Dexie.js (IndexedDB wrapper)
- **Calendar:** FullCalendar
- **Rich Text:** TipTap (ProseMirror)
- **Icons:** Lucide React
- **PWA:** Vite PWA + Workbox Service Worker

---

## 💻 Local Development

Clone the repository and install dependencies:

```bash
npm install
npm run dev
```

To create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## 🔒 Privacy & Data Ownership

FocusSpace stores everything locally in your browser's IndexedDB. Your data never touches any remote servers or third-party cloud services. You can export complete backups at any time via **Settings → Export JSON**.
