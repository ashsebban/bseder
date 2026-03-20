# Rebuild Brief

This file is the practical guide for restarting from scratch while keeping the valuable logic.

## Recommended restart goal

Rebuild the app around:
- a single primary React app
- a small state boundary around persisted legacy data, or a new cleaner persistence layer
- preserved business logic modules from `src/domain/**`, `src/core/**`, `src/persistence/storage.js`, and `src/shared/**`

## What to keep

These modules are the best candidates to keep almost verbatim:
- `src/core/commands.js`
- `src/core/selectors.js`
- `src/domain/tasks/task-engine.js`
- `src/domain/tasks/task-day-state.js`
- `src/domain/goals/active-day-rules.js`
- `src/domain/goals/daily-goal-sync.js`
- `src/domain/goals/goal-engine.js`
- `src/domain/goals/goal-types.js`
- `src/domain/goals/rollups.js`
- `src/domain/calendar/jewish-calendar.js`
- `src/domain/calendar/jerusalem-calendar-meta.js`
- `src/domain/demo/demo-planner-data.js`
- `src/persistence/storage.js`
- `src/shared/date.js`
- `src/shared/text.js`
- `src/config/constants.js`

## What to treat as reference only

These parts are better used as source material than as a foundation:
- `src/app/goals-runtime.js`
- `src/ui/goals/**`
- `src/ui/planner/legacy-planner-app.js`
- most of `apps/web-next/src/components/**`
- most of `apps/web-next/src/lib/legacy/**`

## Suggested new architecture

## Layer 1: pure logic
Keep domain and command logic pure and framework-independent.

## Layer 2: application state
Create a single app store for:
- persisted state snapshot
- planner UI state
- goals UI state
- modal state
- save status
- async calendar metadata loading state

## Layer 3: view-model adapters
Use a small set of adapters for:
- planner day view
- planner month calendar view
- goals library view
- goal setup form defaults and summary text

Avoid scattering UI-specific derivation through component trees.

## Layer 4: React surfaces
Build product routes directly around those adapters:
- `/planner`
- `/goals`
- reusable modal/form components

## Suggested implementation order

1. Recreate the canonical data model boundary
2. Rebuild planner calendar + checklist route
3. Rebuild goals library route
4. Rebuild goal setup form as a shared component
5. Reconnect demo mode, voice, and advanced flows after the core routes are stable

## Product behaviors that must survive the rebuild

Do not lose these behaviors:
- daily-goal auto sync
- task completion -> goal progress logging
- task exemption rules
- planned goal task creation
- recurring conversion from manual task
- future-date guard
- Jerusalem candle-lighting / Shabbos-end metadata
- holiday/parsha calendar context
- demo mode
- weekly/monthly/yearly rollup goals
- holiday/weekday daily-goal exclusion logic

## UI / UX qualities the rebuild should aim for

Based on the current direction and screenshots discussed during the refactor, the new product should feel:
- bright, calm, and deliberate
- rounded and spacious
- heavy-typography forward
- planner-first, not spreadsheet-like
- compact but clear in actions
- explicit about progress and time signals

## Suggested non-goals for the first clean rebuild

Avoid doing these too early:
- rebuilding the entire legacy fallback stack
- preserving old controller-oriented UI architecture
- copying transitional React bridge files as-is
- over-optimizing advanced flows before planner/goals core flows are solid

## Final recommendation

If restarting now, the best strategy is:
- preserve logic
- discard most UI/runtime scaffolding
- rebuild the React product surfaces cleanly around the preserved logic contracts

That gives the best chance of ending up with:
- a smaller codebase
- a clearer ownership model
- and less migration baggage
