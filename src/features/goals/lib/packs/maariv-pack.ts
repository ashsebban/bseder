import { toIsoDate } from "@/lib/date";
import type { Goal } from "@/features/goals/types/goal";
import type { StarterPack } from "./types";

export const MAARIV_GOAL_ID = "__pack_maariv__";

const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildGoal(today: Date): Goal {
  return {
    id: MAARIV_GOAL_ID,
    title: "Maariv",
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

export const maarivPack: StarterPack = {
  activeGoalId: MAARIV_GOAL_ID,
  name: "Maariv",
  description: "Daily binary · all 7 days · Tzais–Alot",
  emoji: "🌙",
  buildGoal,
};
