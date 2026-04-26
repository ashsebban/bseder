import type { Goal } from "@/features/goals/types/goal";
import type { CalendarPreferences } from "@/features/settings/types/calendar-preferences";

export interface PackAddContext {
  goals: Goal[];
  setGoals: (goals: Goal[]) => void;
  updatePreference: <K extends keyof CalendarPreferences>(key: K, value: CalendarPreferences[K]) => void;
  today: Date;
}

export interface StarterPack {
  /** Stable ID used to detect "already active" — matches the reserved goal ID */
  activeGoalId: string;
  name: string;
  description: string;
  emoji: string;
  /** Pure factory — undefined means use addAction instead */
  buildGoal?: (today: Date) => Goal;
  /** Custom add logic (e.g. Omer — delegates to preferences) */
  addAction?: (ctx: PackAddContext) => void;
  /** Custom remove logic — if undefined, removal deletes goal by activeGoalId */
  removeAction?: (ctx: PackAddContext) => void;
}
