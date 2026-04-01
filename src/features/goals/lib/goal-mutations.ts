import type { Goal } from "@/features/goals/types/goal";

/**
 * When a child goal's calendar assignment is completed/uncompleted, feed the
 * delta back to the parent one-time goal's `current` progress counter.
 * @param delta  positive = adding progress, negative = removing
 */
export function updateParentProgress(goals: Goal[], parentGoalId: string, delta: number): Goal[] {
  return goals.map((g) => {
    if (g.id !== parentGoalId) return g;
    return { ...g, current: Math.max(0, (g.current ?? 0) + delta) };
  });
}

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
