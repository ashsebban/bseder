import type { Goal } from "../../goals/types/goal";
import {
  createDayAssignmentId,
  type DayAssignment,
} from "../../planner/lib/day-assignment-store";
import {
  getSessionGroupAssignments,
  parseSessionGroupActionId,
} from "../../planner/lib/day-assignment-groups";

export function resolveAssignmentsForAction(
  assignments: DayAssignment[],
  actionId: string,
): DayAssignment[] {
  const sessionGroupId = parseSessionGroupActionId(actionId);
  if (sessionGroupId) return getSessionGroupAssignments(assignments, sessionGroupId);
  return assignments.filter((assignment) => assignment.id === actionId);
}

export function sumAssignmentAmounts(assignments: DayAssignment[], fallbackAmount: number): number {
  return assignments.reduce((sum, assignment) => sum + (assignment.targetAmount ?? fallbackAmount), 0);
}

export function suggestedAssignmentAmount(goal: Goal): number {
  if (goal.cadence === "daily") return goal.target ?? 1;
  return Math.ceil((goal.target ?? 1) / Math.max(1, goal.activeDays?.length ?? 7));
}

export function applyQuantifiedAssignmentCompletion({
  assignments,
  assignmentId,
  goal,
  amount,
  completedAt,
  createId = createDayAssignmentId,
}: {
  assignments: DayAssignment[];
  assignmentId: string;
  goal: Goal;
  amount: number;
  completedAt: string;
  createId?: () => string;
}): DayAssignment[] {
  const original = assignments.find((assignment) => assignment.id === assignmentId);
  if (!original) return assignments;

  const plannedAmount = original.targetAmount ?? suggestedAssignmentAmount(goal);
  if (amount >= plannedAmount) {
    return assignments.map((assignment) => {
      if (assignment.id !== assignmentId) return assignment;
      return {
        ...assignment,
        targetAmount: plannedAmount,
        completed: true,
        completedAt,
      };
    });
  }

  const sessionGroupId = original.sessionGroupId ?? createId();
  const remainingAmount = plannedAmount - amount;
  const completedFragment: DayAssignment = {
    ...original,
    targetAmount: amount,
    completed: true,
    completedAt,
    replacedAutoDate: undefined,
    sessionGroupId,
  };
  const remainingFragment: DayAssignment = {
    id: createId(),
    goalId: original.goalId,
    date: original.date,
    occurrenceDate: original.occurrenceDate,
    completed: false,
    targetAmount: remainingAmount,
    periodKey: original.periodKey,
    replacedAutoDate: original.replacedAutoDate,
    sessionGroupId,
    generated: original.generated,
  };

  return assignments.flatMap((assignment) =>
    assignment.id === assignmentId
      ? [completedFragment, remainingFragment]
      : [assignment],
  );
}

export function reopenCollapsedSessionGroupAsSingleAssignment(
  assignments: DayAssignment[],
  actionId: string,
): DayAssignment[] {
  const sessionGroupId = parseSessionGroupActionId(actionId);
  if (!sessionGroupId) return assignments;

  const groupAssignments = getSessionGroupAssignments(assignments, sessionGroupId);
  if (groupAssignments.length <= 1 || !groupAssignments.every((assignment) => assignment.completed)) {
    return assignments;
  }

  const representative = groupAssignments.find((assignment) => assignment.replacedAutoDate) ?? groupAssignments[0];
  const scheduledOwner = groupAssignments.find(
    (assignment) => assignment.scheduledTime !== undefined || assignment.durationMins !== undefined,
  );
  const groupAssignmentIds = new Set(groupAssignments.map((assignment) => assignment.id));
  const recombinedAssignment: DayAssignment = {
    ...representative,
    completed: false,
    completedAt: undefined,
    scheduledTime: scheduledOwner?.scheduledTime ?? representative.scheduledTime,
    durationMins: scheduledOwner?.durationMins ?? representative.durationMins,
    targetAmount: groupAssignments.reduce(
      (sum, assignment) => sum + (assignment.targetAmount ?? 1),
      0,
    ),
  };

  return assignments.flatMap((assignment) => {
    if (assignment.id !== representative.id) {
      return groupAssignmentIds.has(assignment.id) ? [] : [assignment];
    }
    return [recombinedAssignment];
  });
}
