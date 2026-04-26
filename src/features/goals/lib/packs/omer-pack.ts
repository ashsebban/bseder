import { OMER_GOAL_ID, buildPersistedOmerGoal } from "@/features/calendar/lib/omer-goal";
import type { StarterPack } from "./types";

export const omerPack: StarterPack = {
  activeGoalId: OMER_GOAL_ID,
  name: "Sefirat HaOmer",
  description: "Nightly binary · 49 nights · Tzais–Alot · auto-dates",
  emoji: "🌾",
  addAction: (ctx) => ctx.setGoals([buildPersistedOmerGoal(ctx.today, ctx.goals.find((g) => g.id === OMER_GOAL_ID)), ...ctx.goals.filter((g) => g.id !== OMER_GOAL_ID)]),
  removeAction: (ctx) => ctx.setGoals(ctx.goals.filter((g) => g.id !== OMER_GOAL_ID)),
};
