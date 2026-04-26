import { toIsoDate } from "@/lib/date";
import type { Goal } from "@/features/goals/types/goal";
import type { StarterPack } from "./types";

export const SHEMA_NIGHT_GOAL_ID = "__pack_shema_night__";

const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildGoal(today: Date): Goal {
  return {
    id: SHEMA_NIGHT_GOAL_ID,
    title: "Shema (Night)",
    cadence: "daily",
    status: "ongoing",
    type: "binary",
    activeDays: ALL_DAYS,
    startsAt: "Tzais HaKochavim",
    expiresAt: "Alot HaShachar",
    lockInDays: true,
    ifUnfinished: "forgive",
    startDate: toIsoDate(today),
    completedDates: [],
  };
}

export const shemaNightPack: StarterPack = {
  activeGoalId: SHEMA_NIGHT_GOAL_ID,
  name: "Shema (Night)",
  description: "Daily binary · all 7 days · Tzais–Alot",
  emoji: "✨",
  buildGoal,
};
