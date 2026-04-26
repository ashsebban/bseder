import { toIsoDate } from "@/lib/date";
import type { Goal } from "@/features/goals/types/goal";
import type { StarterPack } from "./types";

export const KOTEL_GOAL_ID = "__pack_kotel__";

const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildGoal(today: Date): Goal {
  return {
    id: KOTEL_GOAL_ID,
    title: "40-Day Kotel Challenge",
    cadence: "daily",
    status: "ongoing",
    type: "binary",
    activeDays: ALL_DAYS,
    endAfterPeriods: 40,
    ifUnfinished: "kill-streak",
    startDate: toIsoDate(today),
    completedDates: [],
  };
}

export const kotelChallengePack: StarterPack = {
  activeGoalId: KOTEL_GOAL_ID,
  name: "40-Day Kotel Challenge",
  description: "Daily binary · all 7 days · 40-day kill-streak",
  emoji: "🪨",
  buildGoal,
};
