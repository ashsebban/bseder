# Refactor Status

This file explains what the refactor did, what changed ownership, and what state the codebase is in now.

## Big-picture refactor goal

The recent refactor tried to move the planner and goals product away from the legacy browser runtime and toward a React/Next implementation in `apps/web-next`.

The intended direction was:
- keep business logic
- replace legacy runtime/controller/render layers
- make React the primary surface

## What changed

## Runtime split
`src/app/runtime.js` was reduced to a tiny shim.

Planner ownership moved away from `runtime.js`.

The main legacy runtime buckets now are:
- `src/app/goals-runtime.js`
- `src/ui/planner/legacy-planner-app.js`

## Deleted legacy planner pieces
These files were removed during the planner rewrite:
- `src/ui/planner/planner-task-actions-controller.js`
- `src/ui/planner/planner-controller.js`
- `src/ui/planner/planner-renderers.js`

That means the old planner stack is no longer the same shape as before.

## React planner migration
The React planner route now owns a lot of behavior.

Main ownership claimed by the React planner:
- selected date
- visible month
- planner calendar rendering
- month navigation
- future-date guard
- add-task modal
- goal-plan modal
- task list rendering
- planner goal library rendering
- task mutations
- daily-goal sync trigger
- async Jerusalem calendar metadata fetch/merge
- voice modal wiring
- planner drag-to-plan support

Main files:
- `apps/web-next/src/features/planner/use-planner-page.ts`
- `apps/web-next/src/components/planner/**`

## React goals migration
The React goals route also became writable.

Main ownership claimed by the React goals route:
- cadence tabs
- demo / undemo
- new goal modal
- edit goal modal
- delete goal
- some goal progress actions

Main files:
- `apps/web-next/src/features/goals/use-goals-page.ts`
- `apps/web-next/src/components/goals/**`

## What stayed preserved
The refactor intentionally kept these as the source of truth for business behavior:
- `src/core/commands.js`
- `src/core/selectors.js`
- `src/domain/**`
- `src/persistence/storage.js`
- `src/shared/**`

That is the good part of the refactor and should likely survive a restart.

## What is currently fragile

This is the important part for a restart.

### The codebase is functionally split across three worlds
1. preserved domain logic
2. legacy browser UI/runtime
3. Next React UI

That makes the app harder to reason about than it should be.

### The React routes were pushed quickly
Recent passes were aggressive about making the Next app look and feel like the real product.

That means:
- some surfaces are much more real than before
- some UI logic is still fresh and not deeply stabilized
- there is tension between product polish and architecture cleanup

### Last known state at the time of this handoff
- planner route: built, testable, visually refactored, browser-audited in this session
- goals route: built and typechecked, but the last visual refactor introduced at least one real browser-level problem during audit and should be treated cautiously until re-debugged

## What was worth doing
These refactor outcomes were valuable:
- extracting preserved business logic from UI runtime concerns
- proving React can own planner state and writes
- moving calendar/date/task behavior into React
- introducing React-side state machines around preserved commands

## What may not be worth preserving as-is
These are the parts to be skeptical about if restarting:
- current React presentation layer details in `apps/web-next/src/components/**`
- transitional `apps/web-next/src/lib/legacy/**` adapters that only exist to bridge old code
- large legacy UI controllers and runtime glue

## Honest summary

The refactor succeeded most clearly at this:
- separating business logic from UI ownership
- proving a React planner/goals direction is viable

The refactor did not leave the repo in an ideal final architecture.

The current state is best understood as:
- a partially successful migration
- with valuable preserved logic
- and disposable UI/runtime scaffolding around it
