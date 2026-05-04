import test from "node:test";
import assert from "node:assert/strict";

import { buildOnTrackSummary } from "../src/features/goals/lib/on-track-summary";
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
    { name: "Alot HaShachar", startHour: 5, endHour: 12, boundaryTime: new Date(2026, 3, 8, 5), color: "#000" },
    { name: "Chatzot", startHour: 12, endHour: 18, boundaryTime: new Date(2026, 3, 8, 12), color: "#000" },
    { name: "Shkiyah", startHour: 18, endHour: 20, boundaryTime: new Date(2026, 3, 8, 18), color: "#000" },
    { name: "Tzais HaKochavim", startHour: 20, endHour: 24, boundaryTime: new Date(2026, 3, 8, 20), color: "#000" },
  ],
};

test("on-track summary flags today's expired daily window", () => {
  const summary = buildOnTrackSummary({
    goals: [
      makeGoal({
        startsAt: "Alot HaShachar",
        expiresAt: "Chatzot",
      }),
      makeGoal({
        id: "done",
        completedDates: ["2026-04-08"],
      }),
    ],
    assignments: [],
    today: new Date(2026, 3, 8),
    now: new Date(2026, 3, 8, 13),
    todayZmanim: fakeZmanim,
    weekStartsOn: 0,
    excludedByGoal: new Map(),
  });

  assert.equal(summary.total, 2);
  assert.equal(summary.onTrack, 1);
  assert.equal(summary.offTrack, 1);
  assert.equal(summary.percent, 0.5);
  assert.equal(summary.items[0]?.reason, "missed window");
});

test("on-track summary flags period goals that are behind pace", () => {
  const summary = buildOnTrackSummary({
    goals: [
      makeGoal({
        cadence: "weekly",
        type: "quantified",
        target: 10,
        current: 1,
      }),
    ],
    assignments: [],
    today: new Date(2026, 3, 8),
    now: new Date(2026, 3, 8, 12),
    todayZmanim: null,
    weekStartsOn: 0,
    excludedByGoal: new Map(),
  });

  assert.equal(summary.total, 1);
  assert.equal(summary.onTrack, 0);
  assert.equal(summary.offTrack, 1);
  assert.equal(summary.items[0]?.reason, "behind pace");
});
