import { addDays, endOfWeek, startOfWeek, toIsoDate } from "../../../lib/date";
import { getApplicableGoalsForDate, isGoalApplicableOnDate } from "../../goals/lib/goal-applicability";
import type { Goal } from "../../goals/types/goal";
import { suggestedAssignmentAmount } from "../../calendar/lib/assignment-actions";
import { createDayAssignmentId, type DayAssignment } from "./day-assignment-store";
import { computePeriodKey } from "./period-key";

function occurrenceKey(goalId: string, isoDate: string): string {
  return `${goalId}:${isoDate}`;
}

function isRuleOwnedGeneratedAssignment(
  assignment: DayAssignment,
  options: { allowCompleted?: boolean } = {},
): boolean {
  if (!options.allowCompleted && (assignment.completed || assignment.completedAt !== undefined)) {
    return false;
  }
  return (
    assignment.generated === true &&
    assignment.replacedAutoDate === undefined &&
    assignment.scheduledTime === undefined &&
    assignment.durationMins === undefined &&
    assignment.sessionGroupId === undefined &&
    assignment.skipped !== true
  );
}

export function materializePlannerWeekAssignments(
  goals: Goal[],
  existingAssignments: DayAssignment[],
  selectedDate: Date,
  excludedByGoal: Map<string, Set<string>>,
): DayAssignment[] {
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = endOfWeek(selectedDate);
  const goalsById = new Map(goals.map((goal) => [goal.id, goal]));
  let changed = false;
  const normalizedAssignments = existingAssignments.flatMap((assignment) => {
    if (!assignment.generated) return [assignment];
    const assignmentDate = new Date(`${assignment.date}T00:00:00`);
    const inWeek = assignmentDate >= weekStart && assignmentDate <= weekEnd;
    if (!inWeek || assignment.skipped) return [assignment];
    const goal = goalsById.get(assignment.goalId);
    if (!goal) {
      if (isRuleOwnedGeneratedAssignment(assignment)) {
        changed = true;
        return [];
      }
      return [assignment];
    }
    const stillApplicable = isGoalApplicableOnDate(goal, assignmentDate, {
      excludedByGoal,
      mode: "auto",
    });
    if (!stillApplicable && isRuleOwnedGeneratedAssignment(assignment)) {
      changed = true;
      return [];
    }
    const expectedAmount = goal.type === "quantified" ? suggestedAssignmentAmount(goal) : undefined;
    const expectedPeriodKey = computePeriodKey(goal.cadence, assignmentDate);
    const expectedCompleted = goal.completedDates?.includes(assignment.date) ?? false;
    if (
      isRuleOwnedGeneratedAssignment(assignment, { allowCompleted: true }) &&
      (
        assignment.targetAmount !== expectedAmount ||
        assignment.periodKey !== expectedPeriodKey ||
        assignment.completed !== expectedCompleted
      )
    ) {
      changed = true;
      return [{
        ...assignment,
        targetAmount: expectedAmount,
        periodKey: expectedPeriodKey,
        completed: expectedCompleted,
        completedAt: expectedCompleted ? assignment.completedAt : undefined,
      }];
    }
    return [assignment];
  });
  const existingOccurrenceKeys = new Set(
    normalizedAssignments
      .filter((assignment) => !assignment.skipped)
      .map((assignment) => occurrenceKey(assignment.goalId, assignment.date)),
  );
  const skippedOccurrenceKeys = new Set(
    normalizedAssignments
      .filter((assignment) => assignment.skipped)
      .map((assignment) => occurrenceKey(assignment.goalId, assignment.date)),
  );
  const replacedOccurrenceKeys = new Set(
    normalizedAssignments
      .filter((assignment) => assignment.replacedAutoDate !== undefined)
      .map((assignment) => occurrenceKey(assignment.goalId, assignment.replacedAutoDate!)),
  );

  const additions: DayAssignment[] = [];
  for (let cursor = weekStart; cursor <= weekEnd; cursor = addDays(cursor, 1)) {
    const isoDate = toIsoDate(cursor);
    const applicableGoals = getApplicableGoalsForDate(goals, cursor, excludedByGoal);
    for (const goal of applicableGoals) {
      const key = occurrenceKey(goal.id, isoDate);
      if (
        existingOccurrenceKeys.has(key) ||
        skippedOccurrenceKeys.has(key) ||
        replacedOccurrenceKeys.has(key)
      ) {
        continue;
      }
      additions.push({
        id: createDayAssignmentId(),
        goalId: goal.id,
        date: isoDate,
        completed: goal.completedDates?.includes(isoDate) ?? false,
        targetAmount: goal.type === "quantified" ? suggestedAssignmentAmount(goal) : undefined,
        periodKey: computePeriodKey(goal.cadence, cursor),
        generated: true,
      });
      changed = true;
      existingOccurrenceKeys.add(key);
    }
  }

  return changed ? [...normalizedAssignments, ...additions] : existingAssignments;
}
