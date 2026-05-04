import test from "node:test";
import assert from "node:assert/strict";

import {
  getGoalTimePlacementForFraction,
  getGoalTimeStateForNow,
  isTimeInGoalWindowFraction,
  MAARIV_GOAL_ID,
} from "../src/features/calendar/lib/goal-time-window";
import type { DayZmanim } from "../src/features/calendar/lib/zmanim";
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

const fakeZmanim: DayZmanim = {
  tzid: "America/Los_Angeles",
  periods: [
    { name: "Night", startHour: 0, endHour: 5, boundaryTime: null, color: "#000" },
    { name: "Alot HaShachar", startHour: 5, endHour: 12, boundaryTime: new Date("2026-04-10T05:00:00"), color: "#000" },
    { name: "Chatzot", startHour: 12, endHour: 18, boundaryTime: new Date("2026-04-10T12:00:00"), color: "#000" },
    { name: "Shkiyah", startHour: 18, endHour: 20, boundaryTime: new Date("2026-04-10T18:00:00"), color: "#000" },
    { name: "Tzais HaKochavim", startHour: 20, endHour: 24, boundaryTime: new Date("2026-04-10T20:00:00"), color: "#000" },
  ],
};

test("daytime windows still report not-yet, active, and expired correctly", () => {
  const goal = makeGoal({
    startsAt: "Alot HaShachar",
    expiresAt: "Chatzot",
  });

  assert.equal(getGoalTimeStateForNow(goal, fakeZmanim, true, new Date("2026-04-10T04:00:00")), "not-yet");
  assert.equal(getGoalTimeStateForNow(goal, fakeZmanim, true, new Date("2026-04-10T09:00:00")), "active");
  assert.equal(getGoalTimeStateForNow(goal, fakeZmanim, true, new Date("2026-04-10T13:00:00")), "expired");
});

test("overnight windows stay active after tzeit through alot", () => {
  const goal = makeGoal({
    startsAt: "Tzais HaKochavim",
    expiresAt: "Alot HaShachar",
  });

  assert.equal(isTimeInGoalWindowFraction(goal, fakeZmanim, 21), true);
  assert.equal(isTimeInGoalWindowFraction(goal, fakeZmanim, 2), true);
  assert.equal(isTimeInGoalWindowFraction(goal, fakeZmanim, 14), false);

  assert.equal(getGoalTimeStateForNow(goal, fakeZmanim, true, new Date("2026-04-10T21:00:00")), "active");
  assert.equal(getGoalTimeStateForNow(goal, fakeZmanim, true, new Date("2026-04-10T02:00:00")), "active");
  assert.equal(getGoalTimeStateForNow(goal, fakeZmanim, true, new Date("2026-04-10T14:00:00")), "not-yet");
});

test("maariv is allowed after shkiyah with a repeat-shema caveat before tzeit", () => {
  const goal = makeGoal({
    id: MAARIV_GOAL_ID,
    startsAt: "Tzais HaKochavim",
    expiresAt: "Alot HaShachar",
  });

  assert.equal(getGoalTimePlacementForFraction(goal, fakeZmanim, 17.5).kind, "blocked");

  const early = getGoalTimePlacementForFraction(goal, fakeZmanim, 19);
  assert.equal(early.kind, "allowed-with-caveat");
  assert.equal(early.caveat?.kind, "repeat-night-shema");

  assert.equal(getGoalTimePlacementForFraction(goal, fakeZmanim, 21).kind, "allowed");
  assert.equal(getGoalTimePlacementForFraction(goal, fakeZmanim, 2).kind, "allowed");
});
