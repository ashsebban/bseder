import type { Goal } from "@/features/goals/types/goal";
import type { DayAssignment } from "@/features/planner/lib/day-assignment-store";
import { loadGoals } from "@/features/goals/lib/goal-store";
import { loadDayAssignments } from "@/features/planner/lib/day-assignment-store";
import { toIsoDate } from "@/lib/date";
import type { Prayer } from "@/features/shuls/types/minyan";

const PREBUILT_PRAYER_IDS: Record<Prayer, string> = {
  shacharit: "__pack_shacharis__",
  mincha: "__pack_mincha__",
  maariv: "__pack_maariv__",
};

const PRAYER_TITLE_KEYWORDS: Record<Prayer, string[]> = {
  shacharit: ["shacharis", "shacharit", "שחרית"],
  mincha: ["mincha", "מנחה"],
  maariv: ["maariv", "arvit", "מעריב"],
};

export function findPrayerGoal(goals: Goal[], prayer: Prayer): Goal | null {
  const prebuilt = goals.find((g) => g.id === PREBUILT_PRAYER_IDS[prayer]);
  if (prebuilt) return prebuilt;
  const keywords = PRAYER_TITLE_KEYWORDS[prayer];
  return goals.find((g) => keywords.some((k) => g.title.toLowerCase().includes(k))) ?? null;
}

export function hasAlreadyDavened(goals: Goal[], assignments: DayAssignment[], prayer: Prayer): boolean {
  const today = toIsoDate(new Date());
  const goal = findPrayerGoal(goals, prayer);
  if (!goal) return false;
  if (goal.completedDates?.includes(today)) return true;
  return assignments.some((a) => a.goalId === goal.id && a.date === today && a.completed);
}

/** Load from localStorage and check in one call — convenience for client components */
export function checkAlreadyDavened(storageScope: string, prayer: Prayer): boolean {
  const goals = loadGoals(storageScope);
  const assignments = loadDayAssignments(storageScope);
  return hasAlreadyDavened(goals, assignments, prayer);
}
