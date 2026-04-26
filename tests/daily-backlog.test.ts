import test from "node:test";
import assert from "node:assert/strict";

import { getDailyBacklogEntries } from "../src/features/goals/lib/daily-backlog";
import { getGoalProgramLabel } from "../src/features/goals/lib/goal-programs";
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

test("daily backlog entries derive missed applicable dates before today", () => {
  const goal = makeGoal({
    title: "Daf Yomi",
    activeDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    ifUnfinished: "backlog",
    startDate: "2026-04-01",
    completedDates: ["2026-04-01", "2026-04-03"],
  });

  const entries = getDailyBacklogEntries(goal, new Date("2026-04-05T12:00:00"));

  assert.deepEqual(
    entries.map((entry) => entry.date),
    ["2026-04-02", "2026-04-04"],
  );
});

test("daily backlog skips non-active days", () => {
  const goal = makeGoal({
    title: "Tefillin",
    activeDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"],
    ifUnfinished: "backlog",
    startDate: "2026-04-03",
    completedDates: [],
  });

  const entries = getDailyBacklogEntries(goal, new Date("2026-04-06T12:00:00"));

  assert.deepEqual(
    entries.map((entry) => entry.date),
    ["2026-04-03", "2026-04-05"],
  );
});

test("daf yomi program labels are date-specific and populate missed entries", () => {
  const goal = makeGoal({
    title: "Daf Yomi",
    activeDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    ifUnfinished: "backlog",
    programKey: "daf-yomi",
    startDate: "2026-04-09",
    completedDates: [],
  });

  const todayLabel = getGoalProgramLabel(goal, new Date("2026-04-10T12:00:00"));
  const backlogEntries = getDailyBacklogEntries(goal, new Date("2026-04-11T12:00:00"));

  assert.equal(typeof todayLabel, "string");
  assert.ok(todayLabel && todayLabel.length > 0);
  assert.equal(backlogEntries.length, 2);
  assert.ok(backlogEntries.every((entry) => entry.label && entry.label.length > 0));
});

test("omer program labels reflect the current omer day", () => {
  const goal = makeGoal({
    title: "Sefirat HaOmer",
    programKey: "omer",
    startDate: "2026-04-03",
    endDate: "2026-05-21",
  });

  assert.equal(getGoalProgramLabel(goal, new Date("2026-04-03T12:00:00")), "Day 1 of Omer");
  assert.equal(getGoalProgramLabel(goal, new Date("2026-04-10T12:00:00")), "Day 8 of Omer");
  assert.equal(getGoalProgramLabel(goal, new Date("2026-05-22T12:00:00")), null);
});
