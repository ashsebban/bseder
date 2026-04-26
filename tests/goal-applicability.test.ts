import test from "node:test";
import assert from "node:assert/strict";

import { getApplicableGoalsForDate } from "../src/features/goals/lib/goal-applicability";
import type { Goal } from "../src/features/goals/types/goal";

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: overrides.id ?? "goal-1",
    title: overrides.title ?? "Seasonal Goal",
    cadence: overrides.cadence ?? "weekly",
    status: overrides.status ?? "ongoing",
    type: overrides.type ?? "binary",
    ...overrides,
  };
}

test("weekly goals respect endDate in calendar applicability", () => {
  const weeklySeasonal = makeGoal({
    id: "weekly-seasonal",
    cadence: "weekly",
    activeDays: ["Mon"],
    startDate: "2026-08-01",
    endDate: "2026-08-31",
  });

  const beforeEnd = getApplicableGoalsForDate(
    [weeklySeasonal],
    new Date("2026-08-24T00:00:00"),
    new Map(),
  );
  const afterEnd = getApplicableGoalsForDate(
    [weeklySeasonal],
    new Date("2026-09-07T00:00:00"),
    new Map(),
  );

  assert.equal(beforeEnd.length, 1);
  assert.equal(afterEnd.length, 0);
});

test("daily goals keep respecting active window boundaries", () => {
  const dailySeasonal = makeGoal({
    id: "daily-seasonal",
    cadence: "daily",
    activeDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    startDate: "2026-04-01",
    endDate: "2026-04-10",
  });

  const inRange = getApplicableGoalsForDate(
    [dailySeasonal],
    new Date("2026-04-08T00:00:00"),
    new Map(),
  );
  const outOfRange = getApplicableGoalsForDate(
    [dailySeasonal],
    new Date("2026-04-18T00:00:00"),
    new Map(),
  );

  assert.equal(inRange.length, 1);
  assert.equal(outOfRange.length, 0);
});
