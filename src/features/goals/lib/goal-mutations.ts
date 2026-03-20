import type { Goal } from "@/features/goals/types/goal";

/**
 * Canonical mutation for toggling a binary daily goal's completion on a specific date.
 *
 * Contract:
 * - Only touches `completedDates`. Never writes `current` for binary daily goals —
 *   `completedDates` is the source of truth and `current` is not meaningful for these goals.
 * - Safe to call from any surface (Goals page, Calendar page, etc.).
 */
export function toggleGoalDate(goals: Goal[], goalId: string, isoDate: string): Goal[] {
  return goals.map((g) => {
    if (g.id !== goalId) return g;
    const dates = g.completedDates ?? [];
    const newDates = dates.includes(isoDate)
      ? dates.filter((d) => d !== isoDate)
      : [...dates, isoDate];
    return { ...g, completedDates: newDates };
  });
}
