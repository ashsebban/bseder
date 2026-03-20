# Product Logic

This file explains how the planner and goals system is supposed to work at the product level.

## Core product idea

The app has two connected surfaces:

1. Planner: what should happen on a specific date
2. Goals library: recurring and one-time goals that can feed the planner

The intended flow is:
- define goals in the goals library
- auto-add daily goals when relevant
- intentionally pull weekly/monthly/yearly/one-time goals into a day
- complete tasks on the planner
- record progress back against goals

## State model

The persisted state is centered around a few things:

### Days
`state.days[dateKey]`
- stores tasks for a specific date
- planner UI reads from here

### Recurring goals
`state.recurringGoals`
- direct goals created by the user
- may be daily, weekly, monthly, yearly, or static one-time
- may also produce derived/rollup views

### Progress logs
`state.progressLogs`
- normalized record of completed goal progress
- task completion can create or remove logs
- goal progress updates can also create/remove logs directly

### Calendar metadata
`state.calendarMetaByDate`
- Jerusalem candle-lighting
- Shabbos end
- parsha
- fetched asynchronously and merged into state

## Planner logic

## Selected date
The planner always operates on a selected date.

Important behaviors:
- today/tomorrow/yesterday labeling
- future-date guard for dates beyond tomorrow
- visible month separate from selected day

## Daily goals
Daily direct goals are special.

Expected behavior:
- eligible daily goals are auto-added to the selected date checklist
- excluded dates should not get an auto-task

Daily goal exclusions can depend on:
- excluded weekdays
- Shabbos exclusion
- holiday category exclusions
- task-level exemption

Main logic lives in:
- `src/domain/goals/active-day-rules.js`
- `src/domain/goals/daily-goal-sync.js`

## Manual tasks
Users can add manual tasks directly to a date.

Main command:
- `addManualTask`

## Planned goal tasks
Users can pull a non-daily goal into a specific day.

Expected behavior:
- goal library offers a suggested amount
- planner creates a linked task occurrence for that date
- completion can write progress back to the source goal

Main command:
- `addPlannedGoalTask`

## Task completion
When a task is completed:
- the task becomes completed in the planner
- if goal-linked and not exempt, progress logs are created
- if uncompleted, related progress logs are removed or reduced

Main command:
- `toggleTaskCompletion`

## Task exemption
A goal-linked task can be exempted.

Expected behavior:
- exempt task should not count toward goal progress
- exempting a completed linked task should clear related progress

Main command:
- `toggleTaskExemption`

## Rename behavior
There are two rename concepts in the legacy app:
- rename this occurrence only
- rename goal everywhere

The newer React surfaces currently focus more on occurrence-level rename.

## Make recurring
A manual task can be converted into a recurring goal.

Expected behavior:
- create a new direct daily goal
- preserve progress when applicable

Main command:
- `makeTaskRecurring`

## Voice flow
Voice input should:
- capture speech
- split tasks on phrases like `next item`
- dedupe repeated segments
- add multiple tasks in one flow

Main logic:
- `src/ui/planner/planner-voice-controller.js`

## Calendar logic
The planner calendar is supposed to show:
- selected day
- today
- other-month days
- holiday labels
- parsha when relevant
- candle-lighting / Shabbos-end when relevant
- completion counts for each day
- clear done-state for fully completed days

Main logic:
- `src/domain/calendar/jewish-calendar.js`
- `src/domain/calendar/jerusalem-calendar-meta.js`
- planner calendar view model in the Next app

## Goals logic

## Goal cadences
Supported cadences:
- daily
- weekly
- monthly
- yearly
- static one-time

## Measurement types
Supported measurement types:
- binary: done once
- target: numeric amount
- percentage

## Direct vs derived goals
Direct goals:
- user-owned goals
- editable
- used as the source of planner imports

Derived or rollup goals:
- generated from lower-cadence goals
- not normally edited directly
- useful for seeing weekly/monthly/yearly rollups

## Schedule and duration
Goals can be:
- ongoing
- bounded to a period
- bounded by date
- for daily direct goals, bounded by active-day challenge length

## Rollover policy
For numeric goals:
- `carry`: unfinished amount rolls into the next period conceptually
- `reset`: each new period starts fresh

## Holiday and weekday rules
Daily direct goals may exclude:
- specific weekdays
- Shabbos
- holiday categories like Yom Tov or Chol HaMoed

Holiday exception categories and demo definitions live in:
- `src/config/constants.js`

## Goal progress
Goal progress can come from:
- linked task completion
- direct goal progress update

Key command:
- `setGoalProgress`

The `goal-engine` is responsible for:
- period range calculation
- remaining amount
- target amount for the current period
- progress summaries
- rollover-aware stats

## Rollups / phantom goals
The app can generate higher-cadence rollups from lower-cadence goals.

Examples:
- daily -> weekly
- daily -> monthly
- weekly -> monthly
- monthly -> yearly

Main logic:
- `src/domain/goals/rollups.js`

## Demo data
The product has a meaningful demo mode.

It seeds:
- representative goals across cadences
- realistic planner tasks for the visible month
- progress logs and completion patterns
- calendar metadata preservation

Main logic:
- `src/domain/demo/demo-planner-data.js`

## Product intent summary

The intended product behavior is:
- goals define long-term structure
- planner defines what happens on a specific day
- daily routines appear automatically
- larger goals are imported intentionally
- completion writes back to goal progress cleanly
- calendar context helps planning, especially around Jewish dates and Jerusalem times
