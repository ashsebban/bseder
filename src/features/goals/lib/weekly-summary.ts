import { addDays, formatWeekRangeLabel, startOfWeek, toIsoDate } from "../../../lib/date";
import { getGoalTimeStateForNow } from "../../calendar/lib/goal-time-window";
import { getAssignmentOccurrenceDate, getGoalOccurrenceDateForPlannerDate, getGoalOccurrenceKey } from "../../calendar/lib/goal-day";
import type { DayZmanim } from "../../calendar/lib/zmanim";
import { isGoalApplicableOnDate } from "./goal-applicability";
import type { Goal } from "../types/goal";
import type { DayAssignment } from "../../planner/lib/day-assignment-store";
import { buildAssignmentDisplayGroups } from "../../planner/lib/day-assignment-groups";

interface WeeklyGoalOccurrence {
  goalId: string;
  date: string;
  completed: boolean;
}

export interface WeeklyGoalsSummary {
  weekStart: Date;
  weekEnd: Date;
  label: string;
  total: number;
  completed: number;
  missed: number;
  remaining: number;
  dueToday: number;
  completionRate: number;
}

function occurrenceKey(goalId: string, isoDate: string): string {
  return getGoalOccurrenceKey(goalId, isoDate);
}

function isGoalCountable(goal: Goal): boolean {
  return goal.status === "ongoing" && !goal.adhoc;
}

export function buildWeeklyGoalsSummary({
  goals,
  assignments,
  today,
  now = today,
  todayZmanim = null,
  weekStartsOn,
  excludedByGoal,
}: {
  goals: Goal[];
  assignments: DayAssignment[];
  today: Date;
  now?: Date;
  todayZmanim?: DayZmanim | null;
  weekStartsOn: 0 | 1;
  excludedByGoal?: Map<string, Set<string>>;
}): WeeklyGoalsSummary {
  const weekStart = startOfWeek(today, weekStartsOn);
  const weekEndExclusive = addDays(weekStart, 7);
  const weekEnd = addDays(weekEndExclusive, -1);
  const weekStartIso = toIsoDate(weekStart);
  const weekEndIso = toIsoDate(weekEndExclusive);
  const todayIso = toIsoDate(today);
  const goalsById = new Map(goals.filter(isGoalCountable).map((goal) => [goal.id, goal]));

  const weekAssignments = assignments.filter((assignment) => (
    getAssignmentOccurrenceDate(assignment) >= weekStartIso &&
    getAssignmentOccurrenceDate(assignment) < weekEndIso &&
    assignment.skipped !== true &&
    goalsById.has(assignment.goalId)
  ));

  const occurrences: WeeklyGoalOccurrence[] = [];
  const existingOccurrenceKeys = new Set<string>();
  const skippedOccurrenceKeys = new Set(
    assignments
      .filter((assignment) => assignment.skipped === true)
      .map((assignment) => occurrenceKey(assignment.goalId, getAssignmentOccurrenceDate(assignment))),
  );
  const replacedOccurrenceKeys = new Set(
    assignments
      .filter((assignment) => assignment.replacedAutoDate !== undefined)
      .map((assignment) => occurrenceKey(assignment.goalId, assignment.replacedAutoDate!)),
  );

  for (let cursor = new Date(weekStart); cursor < weekEndExclusive; cursor = addDays(cursor, 1)) {
    const plannerDateIso = toIsoDate(cursor);
    const assignmentsForDay = weekAssignments.filter((assignment) => assignment.date === plannerDateIso);

    for (const group of buildAssignmentDisplayGroups(assignmentsForDay)) {
      const goal = goalsById.get(group.representative.goalId);
      if (!goal) continue;
      const occurrenceDate = getAssignmentOccurrenceDate(group.representative);
      const key = occurrenceKey(goal.id, occurrenceDate);
      existingOccurrenceKeys.add(key);
      occurrences.push({
        goalId: goal.id,
        date: occurrenceDate,
        completed: group.assignments.every((assignment) => assignment.completed),
      });
    }

    for (const goal of goalsById.values()) {
      const occurrenceDate = getGoalOccurrenceDateForPlannerDate(goal, cursor, {
        zmanim: toIsoDate(cursor) === todayIso ? todayZmanim : null,
      });
      const key = occurrenceKey(goal.id, occurrenceDate);
      if (
        existingOccurrenceKeys.has(key) ||
        skippedOccurrenceKeys.has(key) ||
        replacedOccurrenceKeys.has(key)
      ) {
        continue;
      }
      if (!isGoalApplicableOnDate(goal, occurrenceDate, { excludedByGoal, mode: "auto" })) continue;
      occurrences.push({
        goalId: goal.id,
        date: occurrenceDate,
        completed: goal.completedDates?.includes(occurrenceDate) ?? false,
      });
      existingOccurrenceKeys.add(key);
    }
  }

  function isMissedOccurrence(occurrence: WeeklyGoalOccurrence): boolean {
    if (occurrence.completed) return false;
    if (occurrence.date < todayIso) return true;
    if (occurrence.date > todayIso) return false;

    const goal = goalsById.get(occurrence.goalId);
    if (!goal) return false;
    return getGoalTimeStateForNow(goal, todayZmanim ?? undefined, true, now) === "expired";
  }

  const completed = occurrences.filter((occurrence) => occurrence.completed).length;
  const missed = occurrences.filter(isMissedOccurrence).length;
  const remaining = occurrences.filter((occurrence) => !occurrence.completed && !isMissedOccurrence(occurrence)).length;
  const dueToday = occurrences.filter((occurrence) => (
    !occurrence.completed &&
    occurrence.date === todayIso &&
    !isMissedOccurrence(occurrence)
  )).length;
  const total = occurrences.length;

  return {
    weekStart,
    weekEnd,
    label: formatWeekRangeLabel(weekStart, weekEnd),
    total,
    completed,
    missed,
    remaining,
    dueToday,
    completionRate: total > 0 ? completed / total : 0,
  };
}
