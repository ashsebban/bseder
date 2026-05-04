import test from "node:test";
import assert from "node:assert/strict";

import { buildWeeklyGoalsSummary } from "../src/features/goals/lib/weekly-summary";
import type { DayZmanim } from "../src/features/calendar/lib/zmanim";
import type { Goal } from "../src/features/goals/types/goal";
import type { DayAssignment } from "../src/features/planner/lib/day-assignment-store";

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: overrides.id ?? "goal-1",
    title: overrides.title ?? "Goal",
    cadence: overrides.cadence ?? "daily",
    status: overrides.status ?? "ongoing",
    type: overrides.type ?? "binary",
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<DayAssignment>): DayAssignment {
  return {
    id: overrides.id ?? "assignment-1",
    goalId: overrides.goalId ?? "goal-1",
    date: overrides.date ?? "2026-04-07",
    completed: overrides.completed ?? false,
    ...overrides,
  };
}

const fakeZmanim: DayZmanim = {
  tzid: "America/Los_Angeles",
  periods: [
    { name: "Night", startHour: 0, endHour: 5, boundaryTime: null, color: "#000" },
    { name: "Alot HaShachar", startHour: 5, endHour: 12, boundaryTime: new Date(2026, 3, 8, 5), color: "#000" },
    { name: "Chatzot", startHour: 12, endHour: 18, boundaryTime: new Date(2026, 3, 8, 12), color: "#000" },
    { name: "Shkiyah", startHour: 18, endHour: 20, boundaryTime: new Date(2026, 3, 8, 18), color: "#000" },
    { name: "Tzais HaKochavim", startHour: 20, endHour: 24, boundaryTime: new Date(2026, 3, 8, 20), color: "#000" },
  ],
};

test("weekly summary counts completed, missed, and remaining daily goal occurrences", () => {
  const summary = buildWeeklyGoalsSummary({
    goals: [
      makeGoal({
        completedDates: ["2026-04-05", "2026-04-07"],
      }),
    ],
    assignments: [],
    today: new Date(2026, 3, 8),
    weekStartsOn: 0,
    excludedByGoal: new Map(),
  });

  assert.equal(summary.total, 7);
  assert.equal(summary.completed, 2);
  assert.equal(summary.missed, 1);
  assert.equal(summary.remaining, 4);
  assert.equal(summary.dueToday, 1);
});

test("weekly summary treats today's expired time windows as missed", () => {
  const summary = buildWeeklyGoalsSummary({
    goals: [
      makeGoal({
        startDate: "2026-04-08",
        startsAt: "Alot HaShachar",
        expiresAt: "Chatzot",
      }),
    ],
    assignments: [],
    today: new Date(2026, 3, 8),
    now: new Date(2026, 3, 8, 13),
    todayZmanim: fakeZmanim,
    weekStartsOn: 0,
    excludedByGoal: new Map(),
  });

  assert.equal(summary.total, 4);
  assert.equal(summary.completed, 0);
  assert.equal(summary.missed, 1);
  assert.equal(summary.remaining, 3);
  assert.equal(summary.dueToday, 0);
});

test("weekly summary respects moved assignments replacing preferred auto occurrences", () => {
  const summary = buildWeeklyGoalsSummary({
    goals: [
      makeGoal({
        cadence: "weekly",
        type: "quantified",
        target: 10,
        activeDays: ["Thu"],
      }),
    ],
    assignments: [
      makeAssignment({
        date: "2026-04-07",
        completed: true,
        targetAmount: 10,
        replacedAutoDate: "2026-04-09",
      }),
    ],
    today: new Date(2026, 3, 8),
    weekStartsOn: 0,
    excludedByGoal: new Map(),
  });

  assert.equal(summary.total, 1);
  assert.equal(summary.completed, 1);
  assert.equal(summary.missed, 0);
  assert.equal(summary.remaining, 0);
});
