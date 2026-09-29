# FocusSpace Roadmap & Status

This document tracks our progress towards the 1.0 release based on the v2 project timeline and codebase analysis.

## Core Principles

- **Local-first**: Dexie + IndexedDB, no backend
- **Simple by default**: Avoid workspace clutter
- **Use before expanding**: Let daily usage drive features
- **Progressive complexity**: Useful daily driver first, sync/AI later

## Phase Status

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| 1-5 | Foundation (Tasks, Calendar, Settings) | ✅ **Completed** | Solid base established. |
| 6 | Core Product (Analytics, UI Polish, ICS) | ✅ **Completed** | ICS export is now in codebase. |
| 7 | Daily-driver Hardening | ✅ **Completed** | Recurring tasks, filters, habit management added. |
| 7.5 | Pages Foundation (Rich text, Journal) | 🟡 **In Progress** | Code exists (TipTap implemented). Needs manual testing. |
| 8 | Production, PWA & Pages Integration | ⏳ **Up Next** | Live references on Pages, PWA setup, Deployment. |
| 9 | Real-world Use | ⏸️ **Pending** | 2-4 weeks of daily driver usage before 1.0. |

## Immediate Action Items (The Gate)

Before we start Phase 8, we must clear the current gate:

1. ✅ **`npm run build` passes with no type errors.** *(Fixed by Antigravity)*
   - *Fixed a `setContent` TipTap option typing issue.*
   - *Fixed a Dexie mapped type circular reference issue on `journal.ts`.*
2. 🔄 **Existing data survives the database upgrade.**
   - Needs a manual verification in the browser since the migration converts existing Markdown to TipTap rich-text.
3. 🔄 **Phase 6 + task editor + pages build first daily-use check.**
   - We need to confirm the TipTap editor works smoothly in a real browser, as it was written blindly against the v2 API by Claude.

## Phase 8 Preview (What's Next)

Once the gate is cleared, we will tackle:
- **Live References:** Ensure tasks/habits linked on Pages stay updated.
- **Production Build:** Vite bundle size checks, config tuning.
- **PWA:** Manifest, icons, offline caching via `vite-plugin-pwa`.
- **Deployment:** Connect to a host/domain.
