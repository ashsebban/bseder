import { startOfWeek, toIsoDate } from "@/lib/date";
import { DAY_KEYS } from "@/features/goals/lib/goal-progress";
import type { Goal } from "@/features/goals/types/goal";
import type { DayAssignment } from "@/features/planner/lib/day-assignment-store";

/**
 * For a goal with noGettingAhead enabled, compute how many additional units
 * can still be planned/assigned in the current period.
 *
 * "Effective cap" = goal.target + goal.backlog (backlog is carried-over obligation).
 *
 * For auto-scheduled weekly goals (cadence === "weekly" with activeDays set),
 * preferred days that don't yet have a manual assignment each consume one cap slot —
 * because they will automatically appear in the week view and count toward the period.
 *
 * Returns a non-negative number. 0 means the goal is fully allocated.
 */
export function computeRemainingCapacity(
  goal: Goal,
  existingAssignments: DayAssignment[],
  selectedDate: Date,
): number {
  if (!goal.noGettingAhead || goal.target === undefined) return Infinity;

  const effectiveCap = goal.target + (goal.backlog ?? 0);

  // Sum up all manually assigned units for this goal
  const assignedPlanned = existingAssignments
    .filter((a) => a.goalId === goal.id)
    .reduce((sum, a) => sum + (a.targetAmount ?? 1), 0);

  // For auto-scheduled weekly goals: preferred days without a manual assignment
  // are implicitly planned — count them against the cap.
  // Exception: preferred days that were explicitly replaced (replacedAutoDate on another
  // assignment) are already accounted for by that manual assignment and must not be
  // double-counted as additional auto-show slots.
  let autoScheduledCount = 0;
  if (goal.cadence === "weekly" && goal.activeDays && goal.activeDays.length > 0) {
    const replacedPreferredDays = new Set(
      existingAssignments
        .filter((a) => a.goalId === goal.id && a.replacedAutoDate)
        .map((a) => a.replacedAutoDate!),
    );
    const weekStart = startOfWeek(selectedDate);
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const dIso = toIsoDate(d);
      const dayKey = DAY_KEYS[d.getDay()];
      if (
        goal.activeDays.includes(dayKey) &&
        (!goal.startDate || dIso >= goal.startDate) &&
        !replacedPreferredDays.has(dIso) &&
        !existingAssignments.some((a) => a.goalId === goal.id && a.date === dIso)
      ) {
        autoScheduledCount++;
      }
    }
  }

  return Math.max(0, effectiveCap - assignedPlanned - autoScheduledCount);
}
