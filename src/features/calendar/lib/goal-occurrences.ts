import { toIsoDate } from "../../../lib/date";
import type { Goal } from "../../goals/types/goal";
import { getGoalProgramLabel } from "../../goals/lib/goal-programs";
import type { DayAssignment } from "../../planner/lib/day-assignment-store";
import { buildAssignmentDisplayGroups } from "../../planner/lib/day-assignment-groups";
import { getAssignmentOccurrenceDate, getDateForGoalProgramLabel } from "./goal-day";

interface GoalOccurrenceBase {
  id: string;
  goal: Goal;
  date: string;
  occurrenceDate: string;
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

export function buildGoalOccurrencesForDate({
  date,
  goals,
  dayAssignments,
}: {
  date: Date;
  goals: Goal[];
  dayAssignments: DayAssignment[];
}): GoalOccurrence[] {
  const goalsById = new Map(goals.map((goal) => [goal.id, goal]));
  const assignmentsForDay = dayAssignments.filter(
    (assignment) => assignment.date === toIsoDate(date) && !assignment.skipped,
  );

  const assignmentOccurrences: GoalOccurrence[] = [];
  for (const group of buildAssignmentDisplayGroups(assignmentsForDay)) {
    const goal = goalsById.get(group.representative.goalId);
    if (!goal) continue;
    const occurrenceDate = getAssignmentOccurrenceDate(group.representative);
    assignmentOccurrences.push({
      id: group.id,
      goal,
      date: toIsoDate(date),
      occurrenceDate,
      source: "assignment",
      assignment: group.representative,
      actionId: group.id,
      collapsed: group.collapsed,
      completed: group.assignments.every((assignment) => assignment.completed),
      displayAmount: group.totalAmount,
      programLabel: getOccurrenceProgramLabel(goal, occurrenceDate),
    });
  }
  return assignmentOccurrences;
}

function getOccurrenceProgramLabel(goal: Goal, occurrenceDate: string): string | null {
  return getGoalProgramLabel(goal, getDateForGoalProgramLabel(goal, occurrenceDate));
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
