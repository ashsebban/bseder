import { HDate, months } from "@hebcal/core";
import { toIsoDate } from "@/lib/date";
import type { Goal } from "@/features/goals/types/goal";
import type { StarterPack } from "./types";

export const CHANUKAH_GOAL_ID = "__pack_chanukah__";

const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getChanukahDateRange(today: Date): { startDate: string; endDate: string } {
  let year = new HDate(today).getFullYear();
  // If this year's Chanukah has already ended, use next Hebrew year
  if (new HDate(3, months.TEVET, year).greg() < today) {
    year++;
  }
  return {
    startDate: toIsoDate(new HDate(25, months.KISLEV, year).greg()),
    // 3 Tevet is always the 8th night, even in a short Kislev year
    endDate: toIsoDate(new HDate(3, months.TEVET, year).greg()),
  };
}

function buildGoal(today: Date): Goal {
  const { startDate, endDate } = getChanukahDateRange(today);
  return {
    id: CHANUKAH_GOAL_ID,
    title: "Chanukah Candles",
    cadence: "daily",
    status: "ongoing",
    type: "binary",
    activeDays: ALL_DAYS,
    startsAt: "Shkiyah",
    expiresAt: "Alot HaShachar",
    lockInDays: true,
    ifUnfinished: "forgive",
    startDate,
    endDate,
    completedDates: [],
  };
}

export const chanukahPack: StarterPack = {
  activeGoalId: CHANUKAH_GOAL_ID,
  name: "Chanukah Candles",
  description: "Nightly binary · 8 nights · Shkiyah–Alot · auto-dates",
  emoji: "🕎",
  buildGoal,
};
