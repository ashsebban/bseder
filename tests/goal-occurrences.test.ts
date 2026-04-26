import test from "node:test";
import assert from "node:assert/strict";

import { buildGoalOccurrencesForDate, sortGoalOccurrences } from "../src/features/calendar/lib/goal-occurrences";
import { materializePlannerWeekAssignments } from "../src/features/planner/lib/materialize-goal-assignments";
import type { Goal } from "../src/features/goals/types/goal";
import type { DayAssignment } from "../src/features/planner/lib/day-assignment-store";

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: overrides.id ?? "goal-1",
    title: overrides.title ?? "Learn Gemara",
    cadence: overrides.cadence ?? "weekly",
    status: overrides.status ?? "ongoing",
    type: overrides.type ?? "quantified",
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<DayAssignment>): DayAssignment {
  return {
    id: overrides.id ?? "assignment-1",
    goalId: overrides.goalId ?? "goal-1",
    date: overrides.date ?? "2026-03-05",
    completed: overrides.completed ?? false,
    ...overrides,
  };
}

test("weekly quantified goals materialize concrete assignments for their active days", () => {
  const goal = makeGoal({
    target: 10,
    targetUnit: "pages",
    activeDays: ["Thu", "Fri"],
  });

  const assignments = materializePlannerWeekAssignments(
    [goal],
    [],
    new Date(2026, 2, 5),
    new Map(),
  );

  assert.deepEqual(
    assignments.map((assignment) => ({
      date: assignment.date,
      targetAmount: assignment.targetAmount,
      generated: assignment.generated,
    })),
    [
      { date: "2026-03-05", targetAmount: 5, generated: true },
      { date: "2026-03-06", targetAmount: 5, generated: true },
    ],
  );
});

test("occurrence builder renders only concrete assignments for the date", () => {
  const goal = makeGoal({
    target: 10,
    targetUnit: "pages",
    activeDays: ["Thu", "Fri"],
  });

  const occurrences = buildGoalOccurrencesForDate({
    date: new Date(2026, 2, 5),
    goals: [goal],
    dayAssignments: [makeAssignment({ targetAmount: 5 })],
    excludedByGoal: new Map(),
  });

  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].source, "assignment");
  assert.equal(occurrences[0].displayAmount, 5);
});

test("moved weekly assignments suppress rematerializing the original preferred day", () => {
  const goal = makeGoal({
    target: 10,
    targetUnit: "pages",
    activeDays: ["Thu", "Fri"],
  });

  const assignments = materializePlannerWeekAssignments(
    [goal],
    [
      makeAssignment({
        id: "moved-1",
        date: "2026-03-04",
        targetAmount: 5,
        replacedAutoDate: "2026-03-05",
      }),
    ],
    new Date(2026, 2, 5),
    new Map(),
  );

  assert.deepEqual(assignments.map((assignment) => assignment.date).sort(), ["2026-03-04", "2026-03-06"]);
});

test("occurrences sort by goal order regardless of source", () => {
  const goals = [
    makeGoal({ id: "goal-1", title: "First", activeDays: ["Thu"] }),
    makeGoal({ id: "goal-2", title: "Second", activeDays: ["Thu"] }),
  ];

  const assignments = materializePlannerWeekAssignments(
    goals,
    [makeAssignment({ goalId: "goal-2", targetAmount: 1 })],
    new Date(2026, 2, 5),
    new Map(),
  );

  const occurrences = buildGoalOccurrencesForDate({
    date: new Date(2026, 2, 5),
    goals,
    dayAssignments: assignments,
    excludedByGoal: new Map(),
  });

  const sorted = sortGoalOccurrences(occurrences, ["goal-2", "goal-1"]);
  assert.deepEqual(sorted.map((occurrence) => occurrence.goal.id), ["goal-2", "goal-1"]);
});
