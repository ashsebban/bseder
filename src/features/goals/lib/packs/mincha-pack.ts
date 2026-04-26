import { toIsoDate } from "@/lib/date";
import type { Goal } from "@/features/goals/types/goal";
import type { StarterPack } from "./types";

export const MINCHA_GOAL_ID = "__pack_mincha__";

const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildGoal(today: Date): Goal {
  return {
    id: MINCHA_GOAL_ID,
    title: "Mincha",
    cadence: "daily",
    status: "ongoing",
    type: "binary",
    activeDays: ALL_DAYS,
    startsAt: "Mincha Gedola",
    expiresAt: "Shkiyah",
    lockInDays: true,
    ifUnfinished: "forgive",
    startDate: toIsoDate(today),
    completedDates: [],
  };
}

export const minchaPack: StarterPack = {
  activeGoalId: MINCHA_GOAL_ID,
  name: "Mincha",
  description: "Daily binary · all 7 days · Mincha Gedola–Shkiyah",
  emoji: "☀️",
  buildGoal,
};
