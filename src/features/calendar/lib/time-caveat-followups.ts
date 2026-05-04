import type { Goal } from "../../goals/types/goal";
import type { DayAssignment } from "../../planner/lib/day-assignment-store";
import { createAssignment } from "../../planner/lib/day-assignment-store";
import {
  NIGHT_SHEMA_GOAL_ID,
  type GoalTimeCaveat,
} from "./goal-time-window";

const MAARIV_SHEMA_FOLLOWUP_ID_PREFIX = "__maariv_shema_followup__";

function followupGoalIdForDate(isoDate: string): string {
  return `${MAARIV_SHEMA_FOLLOWUP_ID_PREFIX}:${isoDate}`;
}

function hasNightShemaGoalForDate(goals: Goal[], isoDate: string): boolean {
  const shemaGoal = goals.find((goal) => goal.id === NIGHT_SHEMA_GOAL_ID && goal.status === "ongoing");
  if (!shemaGoal) return false;
  return shemaGoal.cadence === "daily" || !(shemaGoal.completedDates?.includes(isoDate) ?? false);
}

export function applyTimeCaveatFollowup(
  goals: Goal[],
  dayAssignments: DayAssignment[],
  isoDate: string,
  caveat: GoalTimeCaveat,
): { goals: Goal[]; dayAssignments: DayAssignment[] } {
  if (caveat.kind !== "repeat-night-shema") {
    return { goals, dayAssignments };
  }

  if (hasNightShemaGoalForDate(goals, isoDate)) {
    return { goals, dayAssignments };
  }

  const followupGoalId = followupGoalIdForDate(isoDate);
  const hasFollowupGoal = goals.some((goal) => goal.id === followupGoalId);
  const followupGoal: Goal = {
    id: followupGoalId,
    title: caveat.title,
    cadence: "one-time",
    status: "ongoing",
    type: "binary",
    startsAt: "Tzais HaKochavim",
    expiresAt: "Alot HaShachar",
    startDate: isoDate,
    dueDate: isoDate,
    lockInDays: true,
    adhoc: true,
  };
  const nextGoals = hasFollowupGoal
    ? goals
    : [...goals, followupGoal];

  const hasFollowupAssignment = dayAssignments.some(
    (assignment) => assignment.goalId === followupGoalId && assignment.date === isoDate && !assignment.skipped,
  );
  const nextAssignments = hasFollowupAssignment
    ? dayAssignments
    : [...dayAssignments, createAssignment(followupGoalId, isoDate)];

  return { goals: nextGoals, dayAssignments: nextAssignments };
}

export function removeTimeCaveatFollowup(
  goals: Goal[],
  dayAssignments: DayAssignment[],
  isoDate: string,
): { goals: Goal[]; dayAssignments: DayAssignment[] } {
  const followupGoalId = followupGoalIdForDate(isoDate);
  const hasFollowupGoal = goals.some((goal) => goal.id === followupGoalId);
  const hasFollowupAssignments = dayAssignments.some((assignment) => assignment.goalId === followupGoalId);
  if (!hasFollowupGoal && !hasFollowupAssignments) return { goals, dayAssignments };

  return {
    goals: goals.filter((goal) => goal.id !== followupGoalId),
    dayAssignments: dayAssignments.filter((assignment) => assignment.goalId !== followupGoalId),
  };
}

export function syncTimeCaveatFollowup(
  goals: Goal[],
  dayAssignments: DayAssignment[],
  isoDate: string,
  caveat: GoalTimeCaveat | null,
): { goals: Goal[]; dayAssignments: DayAssignment[] } {
  return caveat
    ? applyTimeCaveatFollowup(goals, dayAssignments, isoDate, caveat)
    : removeTimeCaveatFollowup(goals, dayAssignments, isoDate);
}
