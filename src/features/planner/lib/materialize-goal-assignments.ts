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
  // Pre-pass: detect duplicate non-generated binary assignments for the same (goalId, date).
  // These arise from an old bug where drag-to-timeline created a new assignment instead of
  // updating the existing generated one. Keep the "best" one per slot; mark the rest for removal.
  const bestNonGeneratedId = new Map<string, string>(); // "goalId:date" → id of assignment to keep
  const redundantNonGeneratedIds = new Set<string>();
  for (const a of existingAssignments) {
    if (a.generated || a.skipped) continue;
    const g = goalsById.get(a.goalId);
    if (!g || g.type !== "binary") continue;
    const key = `${a.goalId}:${a.date}`;
    const keptId = bestNonGeneratedId.get(key);
    if (!keptId) {
      bestNonGeneratedId.set(key, a.id);
    } else {
      const kept = existingAssignments.find((x) => x.id === keptId)!;
      const scoreOf = (x: typeof a) =>
        (x.scheduledTime ? 8 : 0) + (x.completed ? 4 : 0) + (x.completedAt ? 2 : 0);
      if (scoreOf(a) > scoreOf(kept)) {
        redundantNonGeneratedIds.add(keptId);
        bestNonGeneratedId.set(key, a.id);
      } else {
        redundantNonGeneratedIds.add(a.id);
      }
    }
  }

  let changed = false;
  const normalizedAssignments = existingAssignments.flatMap((assignment) => {
    // Drop redundant duplicates identified above
    if (redundantNonGeneratedIds.has(assignment.id)) {
      changed = true;
      return [];
    }

    if (!assignment.generated) {
      // Correct stale occurrenceDate on non-generated assignments (e.g. Maariv stored with
      // old shift behavior). Without this the generation loop produces a new entry with the
      // same deterministic ID, causing duplicate-key React errors.
      const ng = goalsById.get(assignment.goalId);
      if (ng) {
        const correct = getOccurrenceDateForPlannerSlot(
          ng, assignment.date, assignment.scheduledTime ?? assignment.completedAt,
        );
        if (getAssignmentOccurrenceDate(assignment) !== correct) {
          changed = true;
          return [{
            ...assignment,
            occurrenceDate: correct === assignment.date ? undefined : correct,
            periodKey: computePeriodKey(ng.cadence, new Date(`${correct}T00:00:00`)),
          }];
        }
      }
      return [assignment];
    }

    // Generated assignment — remove it if a non-generated already owns this (goalId, date).
    // This covers both rule-owned and scheduled-generated (which has scheduledTime set and
    // therefore passes isRuleOwnedGeneratedAssignment = false). Without this, both would
    // appear in the output giving the same deterministic ID twice.
    const genGoal = goalsById.get(assignment.goalId);
    if (genGoal?.type === "binary" && bestNonGeneratedId.has(`${assignment.goalId}:${assignment.date}`)) {
      changed = true;
      return [];
    }

    // For generated-with-scheduledTime (not rule-owned): correct stale occurrenceDate so the
    // existingOccurrenceKeys entry matches what the generation loop would compute, preventing
    // a second entry with the same ID from being appended via the additions list.
    if (genGoal && !isRuleOwnedGeneratedAssignment(assignment, { allowCompleted: true })) {
      const correct = getOccurrenceDateForPlannerSlot(
        genGoal, assignment.date, assignment.scheduledTime ?? assignment.completedAt,
      );
      if (getAssignmentOccurrenceDate(assignment) !== correct) {
        changed = true;
        return [{
          ...assignment,
          occurrenceDate: correct === assignment.date ? undefined : correct,
          periodKey: computePeriodKey(genGoal.cadence, new Date(`${correct}T00:00:00`)),
        }];
      }
    }

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

  if (!changed) return existingAssignments;

  // Deduplicate by assignment ID before returning. Stale occurrenceDates stored from older
  // versions of the app can cause both a normalizedAssignment AND a new addition to share the
  // same deterministic ID (e.g. "generated:__pack_maariv__:2026-05-06"), which crashes React
  // with a duplicate-key error. When an ID appears twice we prefer the non-generated version
  // (user data), or failing that the first occurrence.
  const merged = [...normalizedAssignments, ...additions];
  const seenIds = new Set<string>();
  return merged.filter((a) => {
    if (seenIds.has(a.id)) return false;
    seenIds.add(a.id);
    return true;
  });
}
