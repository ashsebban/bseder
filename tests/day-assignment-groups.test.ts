import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAssignmentDisplayGroups,
  buildSessionGroupActionId,
  parseSessionGroupActionId,
  shouldCollapseSessionGroup,
} from "../src/features/planner/lib/day-assignment-groups";
import type { DayAssignment } from "../src/features/planner/lib/day-assignment-store";

function assignment(overrides: Partial<DayAssignment>): DayAssignment {
  return {
    id: overrides.id ?? "a1",
    goalId: overrides.goalId ?? "goal-1",
    date: overrides.date ?? "2026-03-05",
    completed: overrides.completed ?? false,
    ...overrides,
  };
}

test("session group action ids round-trip", () => {
  const actionId = buildSessionGroupActionId("session-1");
  assert.equal(actionId, "session-group:session-1");
  assert.equal(parseSessionGroupActionId(actionId), "session-1");
  assert.equal(parseSessionGroupActionId("assignment-1"), null);
});

test("completed groups collapse and prefer the fragment carrying replacedAutoDate", () => {
  const groups = buildAssignmentDisplayGroups([
    assignment({ id: "done-1", completed: true, targetAmount: 4, sessionGroupId: "session-1" }),
    assignment({
      id: "done-2",
      completed: true,
      targetAmount: 1,
      sessionGroupId: "session-1",
      replacedAutoDate: "2026-03-06",
    }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].collapsed, true);
  assert.equal(groups[0].id, "session-group:session-1");
  assert.equal(groups[0].representative.id, "done-2");
  assert.equal(groups[0].totalAmount, 5);
});

test("incomplete groups stay split until every fragment is done", () => {
  const assignments = [
    assignment({ id: "done-1", completed: true, targetAmount: 4, sessionGroupId: "session-1" }),
    assignment({ id: "todo-1", completed: false, targetAmount: 1, sessionGroupId: "session-1" }),
  ];

  assert.equal(shouldCollapseSessionGroup(assignments), false);

  const groups = buildAssignmentDisplayGroups(assignments);
  assert.equal(groups.length, 2);
  assert.ok(groups.every((group) => group.collapsed === false));
});
