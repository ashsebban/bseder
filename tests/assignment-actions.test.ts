import test from "node:test";
import assert from "node:assert/strict";

import {
  applyQuantifiedAssignmentCompletion,
  reopenCollapsedSessionGroupAsSingleAssignment,
  resolveAssignmentsForAction,
  suggestedAssignmentAmount,
  sumAssignmentAmounts,
} from "../src/features/calendar/lib/assignment-actions";
import { buildSessionGroupActionId } from "../src/features/planner/lib/day-assignment-groups";
import type { Goal } from "../src/features/goals/types/goal";
import type { DayAssignment } from "../src/features/planner/lib/day-assignment-store";

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: overrides.id ?? "goal-1",
    title: overrides.title ?? "Learn Talmud",
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

test("resolveAssignmentsForAction expands collapsed session group ids", () => {
  const assignments = [
    makeAssignment({ id: "a1", sessionGroupId: "session-1" }),
    makeAssignment({ id: "a2", sessionGroupId: "session-1" }),
    makeAssignment({ id: "a3" }),
  ];

  assert.deepEqual(
    resolveAssignmentsForAction(assignments, buildSessionGroupActionId("session-1")).map((item) => item.id),
    ["a1", "a2"],
  );
  assert.deepEqual(resolveAssignmentsForAction(assignments, "a3").map((item) => item.id), ["a3"]);
});

test("sumAssignmentAmounts respects target amounts and fallback values", () => {
  const assignments = [
    makeAssignment({ targetAmount: 4 }),
    makeAssignment({ id: "a2" }),
  ];

  assert.equal(sumAssignmentAmounts(assignments, 5), 9);
});

test("suggestedAssignmentAmount keeps daily goals per-session and splits weekly goals by active days", () => {
  assert.equal(suggestedAssignmentAmount(makeGoal({ cadence: "daily", target: 3 })), 3);
  assert.equal(
    suggestedAssignmentAmount(makeGoal({ cadence: "weekly", target: 10, activeDays: ["Thu", "Fri"] })),
    5,
  );
});

test("full quantified completion marks the original assignment done without splitting", () => {
  const goal = makeGoal({ target: 10, activeDays: ["Thu", "Fri"] });
  const assignments = [makeAssignment({ targetAmount: 5, scheduledTime: "07:00" })];

  const updated = applyQuantifiedAssignmentCompletion({
    assignments,
    assignmentId: "assignment-1",
    goal,
    amount: 5,
    completedAt: "17:35",
  });

  assert.equal(updated.length, 1);
  assert.equal(updated[0].completed, true);
  assert.equal(updated[0].targetAmount, 5);
  assert.equal(updated[0].completedAt, "17:35");
  assert.equal(updated[0].scheduledTime, "07:00");
});

test("partial quantified completion splits the session and keeps the leftover visible", () => {
  const goal = makeGoal({ target: 10, activeDays: ["Thu", "Fri"] });
  const assignments = [
    makeAssignment({
      targetAmount: 5,
      periodKey: "2026-03-01",
      replacedAutoDate: "2026-03-05",
      scheduledTime: "07:00",
      durationMins: 30,
    }),
  ];
  let callCount = 0;
  const ids = ["session-1", "remaining-1"];

  const updated = applyQuantifiedAssignmentCompletion({
    assignments,
    assignmentId: "assignment-1",
    goal,
    amount: 4,
    completedAt: "17:35",
    createId: () => ids[callCount++] ?? `extra-${callCount}`,
  });

  assert.equal(updated.length, 2);
  assert.deepEqual(
    updated.map((item) => ({
      id: item.id,
      targetAmount: item.targetAmount,
      completed: item.completed,
      replacedAutoDate: item.replacedAutoDate,
      sessionGroupId: item.sessionGroupId,
      scheduledTime: item.scheduledTime,
      durationMins: item.durationMins,
      completedAt: item.completedAt,
    })),
    [
      {
        id: "assignment-1",
        targetAmount: 4,
        completed: true,
        replacedAutoDate: undefined,
        sessionGroupId: "session-1",
        scheduledTime: "07:00",
        durationMins: 30,
        completedAt: "17:35",
      },
      {
        id: "remaining-1",
        targetAmount: 1,
        completed: false,
        replacedAutoDate: "2026-03-05",
        sessionGroupId: "session-1",
        scheduledTime: undefined,
        durationMins: undefined,
        completedAt: undefined,
      },
    ],
  );
});

test("reopening a collapsed completed session group recombines it into one incomplete assignment", () => {
  const assignments = [
    makeAssignment({
      id: "a1",
      targetAmount: 4,
      completed: true,
      completedAt: "07:00",
      scheduledTime: "07:00",
      durationMins: 30,
      sessionGroupId: "session-1",
    }),
    makeAssignment({
      id: "a2",
      targetAmount: 1,
      completed: true,
      completedAt: "08:30",
      sessionGroupId: "session-1",
      replacedAutoDate: "2026-03-05",
    }),
    makeAssignment({
      id: "a3",
      targetAmount: 2,
      completed: false,
    }),
  ];

  const updated = reopenCollapsedSessionGroupAsSingleAssignment(
    assignments,
    buildSessionGroupActionId("session-1"),
  );

  assert.deepEqual(
    updated.map((item) => ({
      id: item.id,
      targetAmount: item.targetAmount,
      completed: item.completed,
      completedAt: item.completedAt,
      scheduledTime: item.scheduledTime,
      durationMins: item.durationMins,
      sessionGroupId: item.sessionGroupId,
      replacedAutoDate: item.replacedAutoDate,
    })),
    [
      {
        id: "a2",
        targetAmount: 5,
        completed: false,
        completedAt: undefined,
        scheduledTime: "07:00",
        durationMins: 30,
        sessionGroupId: "session-1",
        replacedAutoDate: "2026-03-05",
      },
      {
        id: "a3",
        targetAmount: 2,
        completed: false,
        completedAt: undefined,
        scheduledTime: undefined,
        durationMins: undefined,
        sessionGroupId: undefined,
        replacedAutoDate: undefined,
      },
    ],
  );
});
