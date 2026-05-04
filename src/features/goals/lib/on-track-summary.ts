import { addDays, parseIsoDate, startOfDay, startOfMonth, startOfWeek, toIsoDate } from "../../../lib/date";
import { getGoalTimeStateForNow, getGoalWindowInfo } from "../../calendar/lib/goal-time-window";
import { getAssignmentOccurrenceDate, getGoalOccurrenceDateForPlannerDate } from "../../calendar/lib/goal-day";
import type { DayZmanim } from "../../calendar/lib/zmanim";
import type { DayAssignment } from "../../planner/lib/day-assignment-store";
import { computePeriodKey } from "../../planner/lib/period-key";
import { getDailyBacklogEntries } from "./daily-backlog";
import { isActiveGoalToday } from "./active-goals-summary";
import { isGoalApplicableOnDate } from "./goal-applicability";
import type { Goal, GoalCadence } from "../types/goal";

export type OnTrackStatus = "on-track" | "attention" | "off-track";

export interface OnTrackItem {
  goalId: string;
  title: string;
  status: OnTrackStatus;
  reason: string;
}

export interface OnTrackSummary {
  total: number;
  onTrack: number;
  attention: number;
  offTrack: number;
  percent: number;
  items: OnTrackItem[];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function statusRank(status: OnTrackStatus): number {
  if (status === "off-track") return 3;
  if (status === "attention") return 2;
  return 1;
}

function getCurrentPeriodBounds(cadence: GoalCadence, today: Date, weekStartsOn: 0 | 1) {
  if (cadence === "weekly") {
    const start = startOfWeek(today, weekStartsOn);
    return { start, end: addDays(start, 7) };
  }
  if (cadence === "monthly") {
    const start = startOfMonth(today);
    return { start, end: new Date(today.getFullYear(), today.getMonth() + 1, 1) };
  }
  if (cadence === "yearly") {
    return { start: new Date(today.getFullYear(), 0, 1), end: new Date(today.getFullYear() + 1, 0, 1) };
  }
  return { start: today, end: addDays(today, 1) };
}

function shiftDateTime(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getDailyWindowElapsed(goal: Goal, todayZmanim: DayZmanim | null, now: Date): number {
  const windowInfo = getGoalWindowInfo(goal, todayZmanim ?? undefined);
  if (!windowInfo || !windowInfo.startTime || !windowInfo.endTime) {
    const dayStart = startOfDay(now);
    return clamp01((now.getTime() - dayStart.getTime()) / (24 * 60 * 60 * 1000));
  }

  let startTime = new Date(windowInfo.startTime);
  let endTime = new Date(windowInfo.endTime);
  if (windowInfo.wrapsOvernight && endTime <= startTime) {
    if (now < endTime) startTime = shiftDateTime(startTime, -1);
    else endTime = shiftDateTime(endTime, 1);
  }

  const total = endTime.getTime() - startTime.getTime();
  if (total <= 0) return 0;
  return clamp01((now.getTime() - startTime.getTime()) / total);
}

function getCompletedAmount(goal: Goal, rollupDone: number): number {
  if (goal.type === "quantified") return Math.max(rollupDone, goal.current ?? 0);
  return Math.max(rollupDone, goal.current && goal.current > 0 ? 1 : 0);
}

function getPeriodCompletedAmount(
  goal: Goal,
  assignments: DayAssignment[],
  periodStart: Date,
  periodEnd: Date,
): number {
  const periodStartIso = toIsoDate(periodStart);
  const periodEndIso = toIsoDate(periodEnd);
  const periodKey = computePeriodKey(goal.cadence, periodStart);
  const periodAssignments = assignments.filter((assignment) => (
    assignment.goalId === goal.id &&
    (
      assignment.periodKey === periodKey ||
      (
        assignment.periodKey === undefined &&
        assignment.date >= periodStartIso &&
        assignment.date < periodEndIso
      )
    )
  ));

  const manualDone = periodAssignments
    .filter((assignment) => assignment.completed)
    .reduce((sum, assignment) => sum + (assignment.targetAmount ?? 1), 0);
  const manualDates = new Set(periodAssignments.map((assignment) => assignment.date));
  const autoShowDone = (goal.completedDates ?? []).filter((dateIso) => (
    dateIso >= periodStartIso &&
    dateIso < periodEndIso &&
    !manualDates.has(dateIso)
  )).length;
  const trackedDone = manualDone + autoShowDone;

  return getCompletedAmount(goal, trackedDone);
}

function isGoalDoneToday(goal: Goal, todayIso: string, assignments: DayAssignment[]): boolean {
  if (goal.completedDates?.includes(todayIso)) return true;
  return assignments.some((assignment) => (
    assignment.goalId === goal.id &&
    getAssignmentOccurrenceDate(assignment) === todayIso &&
    assignment.completed
  ));
}

function classifyDailyGoal({
  goal,
  assignments,
  today,
  todayIso,
  now,
  todayZmanim,
  excludedByGoal,
}: {
  goal: Goal;
  assignments: DayAssignment[];
  today: Date;
  todayIso: string;
  now: Date;
  todayZmanim: DayZmanim | null;
  excludedByGoal?: Map<string, Set<string>>;
}): OnTrackItem {
  const occurrenceIso = getGoalOccurrenceDateForPlannerDate(goal, todayIso, { now, zmanim: todayZmanim });
  if (getDailyBacklogEntries(goal, today).length > 0) {
    return { goalId: goal.id, title: goal.title, status: "off-track", reason: "catch-up backlog" };
  }
  if (!isGoalApplicableOnDate(goal, occurrenceIso, { excludedByGoal, mode: "auto" })) {
    return { goalId: goal.id, title: goal.title, status: "on-track", reason: "not scheduled today" };
  }
  if (isGoalDoneToday(goal, occurrenceIso, assignments)) {
    return { goalId: goal.id, title: goal.title, status: "on-track", reason: "done today" };
  }

  const timeState = getGoalTimeStateForNow(goal, todayZmanim ?? undefined, true, now);
  if (timeState === "expired") {
    return { goalId: goal.id, title: goal.title, status: "off-track", reason: "missed window" };
  }
  if (timeState === "not-yet") {
    return { goalId: goal.id, title: goal.title, status: "on-track", reason: "window opens later" };
  }

  const elapsed = getDailyWindowElapsed(goal, todayZmanim, now);
  if (elapsed >= 0.75) {
    return { goalId: goal.id, title: goal.title, status: "attention", reason: "due soon" };
  }
  return { goalId: goal.id, title: goal.title, status: "on-track", reason: "still available" };
}

function isProjectComplete(goal: Goal): boolean {
  if (goal.status === "done") return true;
  if (goal.type === "quantified" && goal.target) return (goal.current ?? 0) >= goal.target;
  return false;
}

function classifyProjectGoal(goal: Goal, todayIso: string): OnTrackItem {
  if (isProjectComplete(goal)) {
    return { goalId: goal.id, title: goal.title, status: "on-track", reason: "complete" };
  }
  if (!goal.dueDate) {
    return { goalId: goal.id, title: goal.title, status: "on-track", reason: "no deadline" };
  }
  if (goal.dueDate < todayIso) {
    return { goalId: goal.id, title: goal.title, status: "off-track", reason: "past due" };
  }

  const dueDate = parseIsoDate(goal.dueDate);
  const today = parseIsoDate(todayIso);
  if (!dueDate || !today) {
    return { goalId: goal.id, title: goal.title, status: "on-track", reason: "scheduled" };
  }

  const daysRemaining = Math.round((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (daysRemaining <= 7) {
    return { goalId: goal.id, title: goal.title, status: "attention", reason: "due soon" };
  }
  return { goalId: goal.id, title: goal.title, status: "on-track", reason: "scheduled" };
}

function classifyPeriodGoal({
  goal,
  assignments,
  today,
  now,
  weekStartsOn,
}: {
  goal: Goal;
  assignments: DayAssignment[];
  today: Date;
  now: Date;
  weekStartsOn: 0 | 1;
}): OnTrackItem {
  const { start, end } = getCurrentPeriodBounds(goal.cadence, today, weekStartsOn);
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) {
    return { goalId: goal.id, title: goal.title, status: "on-track", reason: "scheduled" };
  }

  const target = goal.type === "quantified" ? (goal.target ?? 0) : 1;
  if (!target || target <= 0) {
    return { goalId: goal.id, title: goal.title, status: "on-track", reason: "no target" };
  }

  const completed = getPeriodCompletedAmount(goal, assignments, start, end);
  const progressDone = clamp01(completed / target);
  if (progressDone >= 1) {
    return { goalId: goal.id, title: goal.title, status: "on-track", reason: "complete" };
  }

  const timeElapsed = clamp01((now.getTime() - start.getTime()) / totalMs);
  if (timeElapsed < 0.12) {
    return { goalId: goal.id, title: goal.title, status: "on-track", reason: "period just started" };
  }

  const paceGap = timeElapsed - progressDone;
  const pressureScore = paceGap / Math.max(1 - timeElapsed, 0.05);
  if (paceGap > 0.18 || (paceGap > 0.08 && pressureScore >= 0.35)) {
    return { goalId: goal.id, title: goal.title, status: "off-track", reason: "behind pace" };
  }
  if (paceGap > 0.08 || (timeElapsed >= 0.75 && progressDone < 1)) {
    return { goalId: goal.id, title: goal.title, status: "attention", reason: "needs progress" };
  }
  return { goalId: goal.id, title: goal.title, status: "on-track", reason: "on pace" };
}

export function buildOnTrackSummary({
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
}): OnTrackSummary {
  const todayIso = toIsoDate(today);
  const activeGoals = goals.filter((goal) => isActiveGoalToday(goal, todayIso));
  const items = activeGoals
    .map((goal) => {
      if (goal.cadence === "daily") {
        return classifyDailyGoal({ goal, assignments, today, todayIso, now, todayZmanim, excludedByGoal });
      }
      if (goal.cadence === "one-time") {
        return classifyProjectGoal(goal, todayIso);
      }
      return classifyPeriodGoal({ goal, assignments, today, now, weekStartsOn });
    })
    .sort((a, b) => {
      const rankDiff = statusRank(b.status) - statusRank(a.status);
      if (rankDiff !== 0) return rankDiff;
      return a.title.localeCompare(b.title);
    });

  const onTrack = items.filter((item) => item.status === "on-track").length;
  const attention = items.filter((item) => item.status === "attention").length;
  const offTrack = items.filter((item) => item.status === "off-track").length;

  return {
    total: items.length,
    onTrack,
    attention,
    offTrack,
    percent: items.length > 0 ? onTrack / items.length : 0,
    items,
  };
}
