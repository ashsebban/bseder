import test from "node:test";
import assert from "node:assert/strict";

import { buildActiveGoalsSummary } from "../src/features/goals/lib/active-goals-summary";
import type { Goal } from "../src/features/goals/types/goal";

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

test("active goals summary counts only live ongoing goals", () => {
  const summary = buildActiveGoalsSummary([
    makeGoal({ id: "daily", cadence: "daily" }),
    makeGoal({ id: "weekly", cadence: "weekly", startDate: "2026-04-01" }),
    makeGoal({ id: "project", cadence: "one-time" }),
    makeGoal({ id: "paused", status: "paused", cadence: "monthly" }),
    makeGoal({ id: "queued", startDate: "2026-05-01" }),
    makeGoal({ id: "ended", endDate: "2026-04-25" }),
    makeGoal({ id: "adhoc", adhoc: true }),
    makeGoal({ id: "done", status: "done" }),
  ], new Date(2026, 3, 26));

  assert.equal(summary.active, 3);
  assert.equal(summary.paused, 1);
  assert.equal(summary.queued, 1);
  assert.deepEqual(
    summary.cadenceBreakdown
      .filter((item) => item.count > 0)
      .map((item) => [item.cadence, item.count]),
    [
      ["daily", 1],
      ["weekly", 1],
      ["one-time", 1],
    ],
  );
});
