import { toIsoDate } from "@/lib/date";
import type { Goal } from "@/features/goals/types/goal";
import type { StarterPack } from "./types";

export const SHACHARIS_GOAL_ID = "__pack_shacharis__";

const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildGoal(today: Date): Goal {
  return {
    id: SHACHARIS_GOAL_ID,
    title: "Shacharis",
    cadence: "daily",
    status: "ongoing",
    type: "binary",
    activeDays: ALL_DAYS,
    startsAt: "Alot HaShachar",
    expiresAt: "Chatzot",
    lockInDays: true,
    ifUnfinished: "forgive",
    startDate: toIsoDate(today),
    completedDates: [],
  };
}

export const shacharisPack: StarterPack = {
  activeGoalId: SHACHARIS_GOAL_ID,
  name: "Shacharis",
  description: "Daily binary · all 7 days · Alot–Chatzot",
  emoji: "🌅",
  buildGoal,
};
