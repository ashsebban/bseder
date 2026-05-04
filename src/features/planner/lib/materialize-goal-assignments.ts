import { addDays, endOfWeek, startOfWeek, toIsoDate } from "../../../lib/date";
import {
  getAssignmentOccurrenceDate,
  getGoalDayModel,
  getGoalOccurrenceDateForPlannerDate,
} from "../../calendar/lib/goal-day";
import { isGoalApplicableOnDate } from "../../goals/lib/goal-applicability";
import type { Goal } from "../../goals/types/goal";
import { suggestedAssignmentAmount } from "../../calendar/lib/assignment-actions";
import type { DayZmanim } from "../../calendar/lib/zmanim";
import type { DayAssignment } from "./day-assignment-store";
import { computePeriodKey } from "./period-key";

function generatedAssignmentId(goalId: string, isoDate: string): string {
  return `generated:${goalId}:${isoDate}`;
}

function displayKey(goalId: string, plannerDate: string, occurrenceDate: string): string {
  return `${goalId}:${plannerDate}:${occurrenceDate}`;
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
  options: {
    now?: Date;
    getZmanimForDate?: (isoDate: string) => DayZmanim | null;
  } = {},
): DayAssignment[] {
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = endOfWeek(selectedDate);
  const goalsById = new Map(goals.map((goal) => [goal.id, goal]));
  const todayIso = options.now ? toIsoDate(options.now) : null;
  const zmanimByDate = new Map<string, DayZmanim | null | undefined>();
  const getZmanimForGoalDate = (goal: Goal, isoDate: string) => {
    if (getGoalDayModel(goal) !== "jewish") return undefined;
    if (!zmanimByDate.has(isoDate)) {
      zmanimByDate.set(isoDate, options.getZmanimForDate?.(isoDate));
    }
    return zmanimByDate.get(isoDate);
  };
  const getOccurrenceDateForPlannerSlot = (
    goal: Goal,
    isoDate: string,
    scheduledTime?: string,
  ) => getGoalOccurrenceDateForPlannerDate(goal, isoDate, {
    // Generated rows must be stable for the whole planner week. Only real
    // scheduled/completed times should move a Jewish-day goal after nightfall.
    scheduledTime,
    zmanim: getZmanimForGoalDate(goal, isoDate),
  });
  const getGenerationOccurrenceKey = (assignment: DayAssignment) => {
    const goal = goalsById.get(assignment.goalId);
    if (!goal) return displayKey(assignment.goalId, assignment.date, getAssignmentOccurrenceDate(assignment));
    const occurrenceDate = assignment.occurrenceDate ?? getOccurrenceDateForPlannerSlot(
      goal,
      assignment.date,
      assignment.scheduledTime ?? assignment.completedAt,
    );
    return displayKey(assignment.goalId, assignment.date, occurrenceDate);
  };
  const getReplacedOccurrenceKey = (assignment: DayAssignment) => {
    const replacedAutoDate = assignment.replacedAutoDate;
    if (!replacedAutoDate) return null;
    const goal = goalsById.get(assignment.goalId);
    const occurrenceDate = goal
      ? getOccurrenceDateForPlannerSlot(goal, replacedAutoDate)
      : replacedAutoDate;
    return displayKey(assignment.goalId, replacedAutoDate, occurrenceDate);
  };
  const getPrimaryGeneratedAssignmentId = (goal: Goal, isoDate: string) =>
    generatedAssignmentId(goal.id, isoDate);
  const getPrimaryOccurrenceDate = (goal: Goal, isoDate: string) =>
    getOccurrenceDateForPlannerSlot(goal, isoDate);
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
    const occurrenceDate = getOccurrenceDateForPlannerSlot(
      goal,
      assignment.date,
      assignment.scheduledTime ?? assignment.completedAt,
    );
    const stillApplicable = isGoalApplicableOnDate(goal, occurrenceDate, {
      excludedByGoal,
      mode: "auto",
    });
    if (!stillApplicable && isRuleOwnedGeneratedAssignment(assignment)) {
      changed = true;
      return [];
    }
    const expectedAmount = goal.type === "quantified" ? suggestedAssignmentAmount(goal) : undefined;
    const expectedPeriodKey = computePeriodKey(goal.cadence, new Date(`${occurrenceDate}T00:00:00`));
    const expectedCompleted = goal.completedDates?.includes(occurrenceDate) ?? false;
    if (
      isRuleOwnedGeneratedAssignment(assignment, { allowCompleted: true }) &&
      (
        assignment.targetAmount !== expectedAmount ||
        assignment.periodKey !== expectedPeriodKey ||
        assignment.completed !== expectedCompleted ||
        getAssignmentOccurrenceDate(assignment) !== occurrenceDate
      )
    ) {
      changed = true;
      return [{
        ...assignment,
        targetAmount: expectedAmount,
        periodKey: expectedPeriodKey,
        completed: expectedCompleted,
        occurrenceDate: occurrenceDate === assignment.date ? undefined : occurrenceDate,
        completedAt: expectedCompleted ? assignment.completedAt : undefined,
      }];
    }
    return [assignment];
  });
  const existingOccurrenceKeys = new Set(
    normalizedAssignments
      .filter((assignment) => !assignment.skipped)
      .map(getGenerationOccurrenceKey),
  );
  const skippedOccurrenceKeys = new Set(
    normalizedAssignments
      .filter((assignment) => assignment.skipped)
      .map(getGenerationOccurrenceKey),
  );
  const replacedOccurrenceKeys = new Set(
    normalizedAssignments
      .filter((assignment) => assignment.replacedAutoDate !== undefined)
      .map(getReplacedOccurrenceKey)
      .filter((key): key is string => key !== null),
  );

  const additions: DayAssignment[] = [];
  for (let cursor = weekStart; cursor <= weekEnd; cursor = addDays(cursor, 1)) {
    const isoDate = toIsoDate(cursor);
    for (const goal of goals) {
      const occurrenceDate = getPrimaryOccurrenceDate(goal, isoDate);
      if (isGoalApplicableOnDate(goal, occurrenceDate, { excludedByGoal, mode: "auto" })) {
        const key = displayKey(goal.id, isoDate, occurrenceDate);
        if (
          !existingOccurrenceKeys.has(key) &&
          !skippedOccurrenceKeys.has(key) &&
          !replacedOccurrenceKeys.has(key)
        ) {
          additions.push({
            id: getPrimaryGeneratedAssignmentId(goal, isoDate),
            goalId: goal.id,
            date: isoDate,
            occurrenceDate: occurrenceDate === isoDate ? undefined : occurrenceDate,
            completed: goal.completedDates?.includes(occurrenceDate) ?? false,
            targetAmount: goal.type === "quantified" ? suggestedAssignmentAmount(goal) : undefined,
            periodKey: computePeriodKey(goal.cadence, new Date(`${occurrenceDate}T00:00:00`)),
            generated: true,
          });
          changed = true;
          existingOccurrenceKeys.add(key);
        }
      }

    }
  }

  return changed ? [...normalizedAssignments, ...additions] : existingAssignments;
}
