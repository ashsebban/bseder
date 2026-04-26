import { toIsoDate } from "../../../lib/date";
import type { Goal } from "../../goals/types/goal";
import { getGoalProgramLabel } from "../../goals/lib/goal-programs";
import type { DayAssignment } from "../../planner/lib/day-assignment-store";
import { buildAssignmentDisplayGroups } from "../../planner/lib/day-assignment-groups";

interface GoalOccurrenceBase {
  id: string;
  goal: Goal;
  date: string;
  actionId: string;
  collapsed: boolean;
  completed: boolean;
  displayAmount: number;
  programLabel?: string | null;
}

export type GoalOccurrence =
  | (GoalOccurrenceBase & {
      source: "assignment";
      assignment: DayAssignment;
      autoKind?: never;
    })
  | (GoalOccurrenceBase & {
      source: "auto";
      autoKind: "daily" | "weekly";
      assignment?: never;
    });

export function buildSuppressedAutoShowKeys(dayAssignments: DayAssignment[]): Set<string> {
  return new Set<string>([
    ...dayAssignments
      .filter((assignment) => assignment.replacedAutoDate !== undefined)
      .map((assignment) => `${assignment.goalId}:${assignment.replacedAutoDate}`),
    ...dayAssignments
      .filter((assignment) => assignment.skipped === true)
      .map((assignment) => `${assignment.goalId}:${assignment.date}`),
  ]);
}

export function buildGoalOccurrencesForDate({
  date,
  goals,
  dayAssignments,
}: {
  date: Date;
  goals: Goal[];
  dayAssignments: DayAssignment[];
  excludedByGoal: Map<string, Set<string>>;
}): GoalOccurrence[] {
  const goalsById = new Map(goals.map((goal) => [goal.id, goal]));
  const assignmentsForDay = dayAssignments.filter(
    (assignment) => assignment.date === toIsoDate(date) && !assignment.skipped,
  );

  const assignmentOccurrences: GoalOccurrence[] = [];
  for (const group of buildAssignmentDisplayGroups(assignmentsForDay)) {
    const goal = goalsById.get(group.representative.goalId);
    if (!goal) continue;
    assignmentOccurrences.push({
      id: group.id,
      goal,
      date: toIsoDate(date),
      source: "assignment",
      assignment: group.representative,
      actionId: group.id,
      collapsed: group.collapsed,
      completed: group.assignments.every((assignment) => assignment.completed),
      displayAmount: group.totalAmount,
      programLabel: getGoalProgramLabel(goal, date),
    });
  }
  return assignmentOccurrences;
}

export function sortGoalOccurrences(
  occurrences: GoalOccurrence[],
  goalOrder: string[],
): GoalOccurrence[] {
  return [...occurrences].sort((left, right) => {
    const leftIndex = goalOrder.indexOf(left.goal.id);
    const rightIndex = goalOrder.indexOf(right.goal.id);
    return (leftIndex === -1 ? Infinity : leftIndex) - (rightIndex === -1 ? Infinity : rightIndex);
  });
}
