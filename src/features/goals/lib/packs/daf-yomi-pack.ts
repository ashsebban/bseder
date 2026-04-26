import "@hebcal/learning";
import { toIsoDate } from "@/lib/date";
import type { Goal } from "@/features/goals/types/goal";
import type { StarterPack } from "./types";

export const DAF_YOMI_GOAL_ID = "__pack_daf_yomi__";

const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildGoal(today: Date): Goal {
  return {
    id: DAF_YOMI_GOAL_ID,
    title: "Daf Yomi",
    cadence: "daily",
    status: "ongoing",
    type: "binary",
    activeDays: ALL_DAYS,
    lockInDays: true,
    ifUnfinished: "backlog",
    programKey: "daf-yomi",
    startDate: toIsoDate(today),
    completedDates: [],
  };
}

export const dafYomiPack: StarterPack = {
  activeGoalId: DAF_YOMI_GOAL_ID,
  name: "Daf Yomi",
  description: "Daily binary · all 7 days · current daf auto-detected · backlog",
  emoji: "📖",
  buildGoal,
};
