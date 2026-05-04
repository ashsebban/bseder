import { HDate } from "@hebcal/core";
import { endOfMonth, endOfWeek, parseIsoDate, startOfMonth, startOfWeek, toIsoDate } from "@/lib/date";
import { DAY_KEYS } from "@/features/goals/lib/goal-applicability";
import type { Goal } from "@/features/goals/types/goal";
import type { DayAssignment } from "@/features/planner/lib/day-assignment-store";
import { computePeriodKey } from "@/features/planner/lib/period-key";
import { getAssignmentOccurrenceDate, getGoalDayModel } from "@/features/calendar/lib/goal-day";

export function isAssignmentInSelectedPeriod(
  goal: Goal,
  assignment: DayAssignment,
  selectedDate: Date,
): boolean {
  if (getGoalDayModel(goal) === "jewish") {
    // For Jewish-calendar goals, compare occurrenceDate (the Hebrew day) against the
    // Hebrew period of selectedDate.
    const occDate = parseIsoDate(getAssignmentOccurrenceDate(assignment));
    if (!occDate) return false;
    switch (goal.cadence) {
      case "daily":
        return getAssignmentOccurrenceDate(assignment) === toIsoDate(selectedDate);
      case "weekly":
        // Sunday-start week of occurrenceDate vs selectedDate (user decision: keep Gregorian week key)
        return toIsoDate(startOfWeek(occDate)) === toIsoDate(startOfWeek(selectedDate));
      case "monthly": {
        const hOcc = new HDate(occDate);
        const hSel = new HDate(selectedDate);
        return hOcc.getFullYear() === hSel.getFullYear() && hOcc.getMonth() === hSel.getMonth();
      }
      case "yearly": {
        const hOcc = new HDate(occDate);
        const hSel = new HDate(selectedDate);
        return hOcc.getFullYear() === hSel.getFullYear();
      }
      default:
        return true;
    }
  }

  const currentPeriodKey = computePeriodKey(goal.cadence, selectedDate);

  if (currentPeriodKey && assignment.periodKey !== undefined) {
    return assignment.periodKey === currentPeriodKey;
  }

  switch (goal.cadence) {
    case "daily":
      return assignment.date === toIsoDate(selectedDate);
    case "weekly": {
      const start = toIsoDate(startOfWeek(selectedDate));
      const end = toIsoDate(endOfWeek(selectedDate));
      return assignment.date >= start && assignment.date <= end;
    }
    case "monthly": {
      const start = toIsoDate(startOfMonth(selectedDate));
      const end = toIsoDate(endOfMonth(selectedDate));
      return assignment.date >= start && assignment.date <= end;
    }
    case "yearly": {
      const year = selectedDate.getFullYear().toString();
      return assignment.date.startsWith(`${year}-`);
    }
    default:
      return true;
  }
}

/**
 * For a goal with noGettingAhead enabled, compute how many additional units
 * can still be planned/assigned in the current period.
 *
 * "Effective cap" = goal.target + goal.backlog (backlog is carried-over obligation).
 *
 * For auto-scheduled weekly goals (cadence === "weekly" with activeDays set),
 * preferred days that don't yet have a manual assignment each consume their per-day
 * allocation, because they will automatically appear in the week view and count
 * toward the period.
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
  const relevantAssignments = existingAssignments.filter(
    (a) => a.goalId === goal.id && isAssignmentInSelectedPeriod(goal, a, selectedDate),
  );

  // Sum up all manually assigned units for this goal
  const assignedPlanned = relevantAssignments
    .filter((a) => !a.skipped)
    .reduce((sum, a) => sum + (a.targetAmount ?? 1), 0);

  // For auto-scheduled weekly goals: preferred days without a manual assignment
  // are implicitly planned — count them against the cap.
  // Exception: preferred days that were explicitly replaced (replacedAutoDate on another
  // assignment) are already accounted for by that manual assignment and must not be
  // double-counted as additional auto-show slots.
  let autoScheduledCount = 0;
  if (goal.cadence === "weekly" && goal.activeDays && goal.activeDays.length > 0) {
    const replacedPreferredDays = new Set(
      relevantAssignments
        .filter((a) => a.replacedAutoDate)
        .map((a) => a.replacedAutoDate!),
    );
    const perDayTarget = goal.type === "quantified" && goal.target && goal.activeDays.length
      ? Math.ceil(goal.target / goal.activeDays.length)
      : 1;
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
        !relevantAssignments.some((a) => a.date === dIso)
      ) {
        autoScheduledCount += perDayTarget;
      }
    }
  }

  return Math.max(0, effectiveCap - assignedPlanned - autoScheduledCount);
}
