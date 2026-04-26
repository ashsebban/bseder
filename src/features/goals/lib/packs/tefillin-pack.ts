import { toIsoDate } from "@/lib/date";
import type { Goal } from "@/features/goals/types/goal";
import type { StarterPack } from "./types";

export const TEFILLIN_GOAL_ID = "__pack_tefillin__";

function buildGoal(today: Date): Goal {
  return {
    id: TEFILLIN_GOAL_ID,
    title: "Tefillin",
    cadence: "daily",
    status: "ongoing",
    type: "binary",
    activeDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"],
    excludes: { categories: ["Yom Tov", "Chol HaMoed"] },
    startsAt: "Misheyakir",
    expiresAt: "Shkiyah",
    lockInDays: true,
    ifUnfinished: "kill-streak",
    startDate: toIsoDate(today),
    completedDates: [],
  };
}

export const tefillinPack: StarterPack = {
  activeGoalId: TEFILLIN_GOAL_ID,
  name: "Tefillin",
  description: "Daily binary · Sun–Fri · Misheyakir–Shkiyah · kill-streak",
  emoji: "🕍",
  buildGoal,
};
