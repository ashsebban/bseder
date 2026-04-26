import { toIsoDate } from "@/lib/date";
import type { Goal } from "@/features/goals/types/goal";
import type { StarterPack } from "./types";

export const SHEMA_MORNING_GOAL_ID = "__pack_shema_morning__";

const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildGoal(today: Date): Goal {
  return {
    id: SHEMA_MORNING_GOAL_ID,
    title: "Shema (Morning)",
    cadence: "daily",
    status: "ongoing",
    type: "binary",
    activeDays: ALL_DAYS,
    startsAt: "Alot HaShachar",
    expiresAt: "Sof Zman Shema",
    lockInDays: true,
    ifUnfinished: "forgive",
    startDate: toIsoDate(today),
    completedDates: [],
  };
}

export const shemaMorningPack: StarterPack = {
  activeGoalId: SHEMA_MORNING_GOAL_ID,
  name: "Shema (Morning)",
  description: "Daily binary · all 7 days · Alot–Sof Zman Shema",
  emoji: "🕯️",
  buildGoal,
};
