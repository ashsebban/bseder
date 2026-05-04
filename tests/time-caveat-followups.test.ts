import test from "node:test";
import assert from "node:assert/strict";

import type { Goal } from "../src/features/goals/types/goal";
import type { DayAssignment } from "../src/features/planner/lib/day-assignment-store";
import {
  NIGHT_SHEMA_GOAL_ID,
  type GoalTimeCaveat,
} from "../src/features/calendar/lib/goal-time-window";
import { syncTimeCaveatFollowup } from "../src/features/calendar/lib/time-caveat-followups";

const caveat: GoalTimeCaveat = {
  kind: "repeat-night-shema",
  followupGoalId: NIGHT_SHEMA_GOAL_ID,
  title: "Repeat Shema after nightfall",
  description: "Ma'ariv before definite nightfall does not cover nighttime Shema.",
};

test("syncTimeCaveatFollowup creates and removes the auto night-shema task", () => {
  const goals: Goal[] = [];
  const assignments: DayAssignment[] = [];

  const created = syncTimeCaveatFollowup(goals, assignments, "2026-04-27", caveat);
  assert.equal(created.goals.length, 1);
  assert.equal(created.dayAssignments.length, 1);
  assert.equal(created.goals[0].title, "Repeat Shema after nightfall");
  assert.equal(created.goals[0].startsAt, "Tzais HaKochavim");

  const removed = syncTimeCaveatFollowup(created.goals, created.dayAssignments, "2026-04-27", null);
  assert.deepEqual(removed.goals, []);
  assert.deepEqual(removed.dayAssignments, []);
});

test("syncTimeCaveatFollowup does not create a duplicate when night shema is already enabled", () => {
  const goals: Goal[] = [{
    id: NIGHT_SHEMA_GOAL_ID,
    title: "Shema (Night)",
    cadence: "daily",
    status: "ongoing",
    type: "binary",
  }];

  const synced = syncTimeCaveatFollowup(goals, [], "2026-04-27", caveat);
  assert.equal(synced.goals, goals);
  assert.deepEqual(synced.dayAssignments, []);
});
