import { HDate, months } from "@hebcal/core";
import { toIsoDate } from "@/lib/date";
import type { Goal } from "@/features/goals/types/goal";
import type { StarterPack } from "./types";

export const ELUL_SELICHOT_GOAL_ID = "__pack_elul_selichot__";

function getElulDateRange(today: Date): { startDate: string; endDate: string } {
  let year = new HDate(today).getFullYear();
  // If this year's Elul has already ended, use the next Hebrew year.
  if (new HDate(29, months.ELUL, year).greg() < today) {
    year++;
  }
  return {
    startDate: toIsoDate(new HDate(1, months.ELUL, year).greg()),
    endDate: toIsoDate(new HDate(29, months.ELUL, year).greg()),
  };
}

function buildGoal(today: Date): Goal {
  const { startDate, endDate } = getElulDateRange(today);
  return {
    id: ELUL_SELICHOT_GOAL_ID,
    title: "Elul Selichot",
    cadence: "daily",
    status: "ongoing",
    type: "binary",
    activeDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    lockInDays: true,
    startDate,
    endDate,
    completedDates: [],
    ifUnfinished: "forgive",
  };
}

export const elulSelichotPack: StarterPack = {
  activeGoalId: ELUL_SELICHOT_GOAL_ID,
  name: "Elul Selichot",
  description: "Daily binary · Sephardi minhag · 1–29 Elul · auto-dates",
  emoji: "🤲",
  buildGoal,
};
