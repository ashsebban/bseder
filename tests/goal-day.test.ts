import test from "node:test";
import assert from "node:assert/strict";

import {
  getAssignmentOccurrenceDate,
  getDateForGoalProgramLabel,
  getGoalOccurrenceDateForPlannerDate,
} from "../src/features/calendar/lib/goal-day";
import { buildGoalOccurrencesForDate } from "../src/features/calendar/lib/goal-occurrences";
import { getGoalProgramLabel } from "../src/features/goals/lib/goal-programs";
import type { DayZmanim } from "../src/features/calendar/lib/zmanim";
import type { Goal } from "../src/features/goals/types/goal";
import type { DayAssignment } from "../src/features/planner/lib/day-assignment-store";

const fakeZmanim: DayZmanim = {
  tzid: "America/Los_Angeles",
  periods: [
    { name: "Night", startHour: 0, endHour: 5, boundaryTime: null, color: "#000" },
    { name: "Alot HaShachar", startHour: 5, endHour: 18, boundaryTime: new Date(2026, 3, 27, 5), color: "#000" },
    { name: "Shkiyah", startHour: 18, endHour: 20, boundaryTime: new Date(2026, 3, 27, 18), color: "#000" },
    { name: "Tzais HaKochavim", startHour: 20, endHour: 24, boundaryTime: new Date(2026, 3, 27, 20), color: "#000" },
  ],
};

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: overrides.id ?? "__omer__",
    title: overrides.title ?? "Sefirat HaOmer",
    cadence: overrides.cadence ?? "daily",
    status: overrides.status ?? "ongoing",
    type: overrides.type ?? "binary",
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<DayAssignment>): DayAssignment {
  return {
    id: overrides.id ?? "assignment-1",
    goalId: overrides.goalId ?? "__omer__",
    date: overrides.date ?? "2026-04-27",
    completed: overrides.completed ?? false,
    ...overrides,
  };
}

test("jewish-day goals count evening work toward the next obligation date", () => {
  const goal = makeGoal({
    dayModel: "jewish",
    programKey: "omer",
    startDate: "2026-04-03",
    endDate: "2026-05-21",
  });

  assert.equal(
    getGoalOccurrenceDateForPlannerDate(goal, "2026-04-27", {
      scheduledTime: "19:30",
      zmanim: fakeZmanim,
    }),
    "2026-04-27",
  );
  assert.equal(
    getGoalOccurrenceDateForPlannerDate(goal, "2026-04-27", {
      scheduledTime: "20:30",
      zmanim: fakeZmanim,
    }),
    "2026-04-28",
  );
});

test("the first Omer count starts on the second night of Pesach", () => {
  const goal = makeGoal({
    dayModel: "jewish",
    programKey: "omer",
    startDate: "2026-04-03",
    endDate: "2026-05-21",
    startsAt: "Tzais HaKochavim",
  });

  assert.equal(
    getGoalOccurrenceDateForPlannerDate(goal, "2026-04-02", {
      scheduledTime: "20:30",
      zmanim: fakeZmanim,
    }),
    "2026-04-03",
  );
});

test("early Maariv caveat window counts toward the coming obligation date", () => {
  const goal = makeGoal({
    id: "__pack_maariv__",
    dayModel: "jewish",
    startsAt: "Tzais HaKochavim",
  });

  assert.equal(
    getGoalOccurrenceDateForPlannerDate(goal, "2026-04-27", {
      scheduledTime: "18:30",
      zmanim: fakeZmanim,
    }),
    "2026-04-28",
  );
});

test("omer labels follow the Jewish-day span around tzeit", () => {
  const goal = makeGoal({
    dayModel: "jewish",
    programKey: "omer",
    startDate: "2026-04-03",
    endDate: "2026-05-21",
    startsAt: "Tzais HaKochavim",
    expiresAt: "Shkiyah",
  });

  function labelFor(plannerIso: string, now: Date): string | null {
    const occurrenceDate = getGoalOccurrenceDateForPlannerDate(goal, plannerIso, {
      now,
      zmanim: fakeZmanim,
    });
    return getGoalProgramLabel(goal, getDateForGoalProgramLabel(goal, occurrenceDate));
  }

  assert.equal(labelFor("2026-04-27", new Date(2026, 3, 27, 19, 30)), "Day 25 of Omer");
  assert.equal(labelFor("2026-04-27", new Date(2026, 3, 27, 20, 30)), "Day 26 of Omer");
  assert.equal(labelFor("2026-04-28", new Date(2026, 3, 28, 12, 0)), "Day 26 of Omer");
  assert.equal(labelFor("2026-04-28", new Date(2026, 3, 28, 20, 30)), "Day 27 of Omer");
});

test("occurrence labels use the obligation date instead of the planner date", () => {
  const goal = makeGoal({
    dayModel: "jewish",
    programKey: "omer",
    startDate: "2026-04-03",
    endDate: "2026-05-21",
  });
  const assignment = makeAssignment({
    id: "assignment-omer-label",
    date: "2026-04-27",
    occurrenceDate: "2026-04-28",
  });

  const occurrences = buildGoalOccurrencesForDate({
    date: new Date(2026, 3, 27),
    goals: [goal],
    dayAssignments: [assignment],
  });

  assert.equal(getAssignmentOccurrenceDate(assignment), "2026-04-28");
  assert.equal(occurrences[0].occurrenceDate, "2026-04-28");
  assert.equal(occurrences[0].programLabel, "Day 26 of Omer");
});
