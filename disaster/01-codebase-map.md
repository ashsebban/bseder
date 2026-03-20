# Codebase Map

This file explains what is currently in the repo, what each area is for, and which parts are worth preserving if we restart from scratch.

## Top-level split

There are effectively two apps in this repository:

1. The legacy browser app
2. The new Next.js app in `apps/web-next`

They share the same preserved business logic in `src/domain/**`, `src/core/**`, `src/persistence/**`, and `src/shared/**`.

## Legacy browser app

The legacy app still exists for planner and goals fallback behavior.

### Entry points
- `index.html`: legacy planner page
- `goals.html`: legacy goals page
- `app.js`: legacy browser bootstrap helper

### Legacy planner path
- `src/ui/planner/planner-page.js`: planner page bootstrap
- `src/ui/planner/legacy-planner-app.js`: current legacy planner implementation
- `src/ui/planner/planner-voice-controller.js`: legacy voice flow

### Legacy goals path
- `src/ui/goals/goals-page.js`: goals page bootstrap
- `src/app/runtime.js`: now a tiny shim
- `src/app/goals-runtime.js`: large remaining goals runtime/orchestration file
- `src/ui/goals/goals-controller.js`: goals UI event wiring
- `src/ui/goals/goal-form-controller.js`: legacy goal setup/edit form logic
- `src/ui/goals/weekly-prompt-controller.js`: weekly prompt flow
- `src/ui/goals/goals-renderers.js`: legacy goal rendering helpers

## Next.js app

The new app lives in `apps/web-next`.

### Route files
- `apps/web-next/app/page.tsx`: landing page
- `apps/web-next/app/planner/page.tsx`: React planner route
- `apps/web-next/app/goals/page.tsx`: React goals route
- `apps/web-next/app/layout.tsx`: wraps the app in `AppStateProvider`
- `apps/web-next/app/globals.css`: all current route styling

### Shared React state boundary
- `apps/web-next/src/components/providers/app-state-provider.tsx`

What it does:
- hydrates the preserved legacy state into React
- exposes `applyLegacyChange` for cloned-state mutations
- persists updated state back through legacy storage

This provider is the current bridge between preserved business logic and the new React surfaces.

## Preserved business logic

These modules are the most important reusable part of the current codebase.

### Core state and commands
- `src/core/store.js`: legacy store
- `src/core/commands.js`: mutations for tasks, goals, progress, deletes, recurring conversion, etc.
- `src/core/selectors.js`: planner/goals selection helpers

### Domain logic
- `src/domain/tasks/task-engine.js`: display text, editable text, exemption logic, completion counts
- `src/domain/tasks/task-day-state.js`: read/write day task buckets
- `src/domain/goals/active-day-rules.js`: daily goal eligibility and exclusion rules
- `src/domain/goals/daily-goal-sync.js`: auto-create daily goal tasks
- `src/domain/goals/goal-engine.js`: goal progress, periods, schedule summaries, stats
- `src/domain/goals/goal-types.js`: normalization and schedule/holiday helpers
- `src/domain/goals/rollups.js`: phantom/rollup goal generation
- `src/domain/calendar/jewish-calendar.js`: holidays, special weeks
- `src/domain/calendar/jerusalem-calendar-meta.js`: candle-lighting, Shabbos-end, parsha metadata
- `src/domain/demo/demo-planner-data.js`: demo seeding

### Persistence and shared helpers
- `src/persistence/storage.js`: canonical load/save/normalize logic
- `src/shared/date.js`: date math and formatting
- `src/shared/text.js`: sanitization helpers
- `src/config/constants.js`: storage key, demo definitions, holiday category definitions, etc.

## Current Next planner structure

### Main files
- `apps/web-next/src/features/planner/use-planner-page.ts`
- `apps/web-next/src/components/planner/planner-slice.tsx`
- `apps/web-next/src/components/planner/planner-calendar.tsx`
- `apps/web-next/src/components/planner/planner-task-list.tsx`
- `apps/web-next/src/components/planner/planner-goal-options.tsx`
- `apps/web-next/src/components/planner/planner-modal.tsx`

### Supporting adapters
- `apps/web-next/src/lib/legacy/planner-state-machine.js`
- `apps/web-next/src/lib/legacy/planner-view-model.ts`
- `apps/web-next/src/lib/legacy/planner-calendar-view-model.js`
- `apps/web-next/src/lib/legacy/planner-goal-logic.js`
- `apps/web-next/src/lib/legacy/planner-page-helpers.js`

## Current Next goals structure

### Main files
- `apps/web-next/src/features/goals/use-goals-page.ts`
- `apps/web-next/src/components/goals/goals-overview.tsx`
- `apps/web-next/src/components/goals/goal-setup-form.tsx`

### Supporting adapters
- `apps/web-next/src/lib/legacy/goals-state-machine.js`
- `apps/web-next/src/lib/legacy/goals-overview-model.ts`
- `apps/web-next/src/lib/legacy/goal-form-utils.ts`

## Testing and validation

Current repo-level tests live in `test/**`.

Relevant tests include:
- planner state machine tests
- planner calendar view-model tests
- goal state machine tests
- calendar and goal engine tests
- storage normalization tests

The Next app currently also builds locally with:
- `npm --prefix apps/web-next run build`
- `./apps/web-next/node_modules/.bin/tsc -p apps/web-next/tsconfig.json --noEmit`

## If we restart from scratch

Preserve first:
- `src/core/**`
- `src/domain/**`
- `src/persistence/storage.js`
- `src/shared/**`
- `src/config/constants.js`

Treat as replaceable UI/runtime layers:
- most of `src/app/goals-runtime.js`
- `src/ui/goals/**`
- `src/ui/planner/legacy-planner-app.js`
- most of the current React presentation in `apps/web-next/src/components/**`

The safest interpretation is:
- business logic is valuable
- current UI layers are transitional
