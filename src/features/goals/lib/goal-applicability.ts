import { toIsoDate } from "../../../lib/date";
import type { Goal } from "../types/goal";

export const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export type DayKey = typeof DAY_KEYS[number];
export type GoalApplicabilityMode = "auto" | "manual";

export interface GoalApplicabilityOptions {
  excludedByGoal?: Map<string, Set<string>>;
  mode?: GoalApplicabilityMode;
}

/**
 * Lightweight streak-broken check for kill-streak goals (no holiday exclusion —
 * the full version with exclusions lives in goal-progress.ts for the display layer).
 * Used at assignment-generation time to suppress planner slots when streak is gone.
 */
function isKillStreakBroken(goal: Goal, date: Date): boolean {
  if (goal.status === "killed") return true;
  const isKillOnMiss = goal.killOnMiss !== undefined ? goal.killOnMiss : goal.ifUnfinished === "kill-streak";
  if (!isKillOnMiss || goal.type !== "binary" || goal.cadence !== "daily") {
    return false;
  }
  const completed = new Set(goal.completedDates ?? []);
  const activeDayKeys: string[] = goal.activeDays ?? [...DAY_KEYS];
  const cursor = new Date(date);
  cursor.setDate(cursor.getDate() - 1);
  for (let i = 0; i < 60; i++) {
    const dayKey = DAY_KEYS[cursor.getDay()];
    const dateStr = toIsoDate(cursor);
    if (goal.startDate && dateStr < goal.startDate) return false;
    if (!activeDayKeys.includes(dayKey)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    return !completed.has(dateStr);
  }
  return false;
}

function normalizeDate(input: Date | string): { date: Date; isoDate: string } {
  if (typeof input === "string") {
    return { date: new Date(`${input}T00:00:00`), isoDate: input };
  }
  return { date: input, isoDate: toIsoDate(input) };
}

export function isGoalExcludedOnDate(
  goal: Goal,
  date: Date | string,
  excludedByGoal?: Map<string, Set<string>>,
): boolean {
  if (!goal.excludes?.categories?.length && !goal.excludes?.individual?.length) return false;
  const { isoDate } = normalizeDate(date);
  return excludedByGoal?.get(goal.id)?.has(isoDate) ?? false;
}

export function isGoalApplicableOnDate(
  goal: Goal,
  dateInput: Date | string,
  options: GoalApplicabilityOptions = {},
): boolean {
  const { date, isoDate } = normalizeDate(dateInput);
  const mode = options.mode ?? "auto";

  if (goal.status !== "ongoing") return false;
  if (goal.startDate && isoDate < goal.startDate) return false;
  if (goal.endDate && isoDate > goal.endDate) return false;
  if (isGoalExcludedOnDate(goal, isoDate, options.excludedByGoal)) return false;

  const dayKey = DAY_KEYS[date.getDay()];
  const activeDays: string[] = goal.activeDays ?? [...DAY_KEYS];

  if (mode === "manual") {
    if (goal.cadence === "daily") return activeDays.includes(dayKey);
    if (goal.lockInDays && goal.activeDays?.length) return goal.activeDays.includes(dayKey);
    return true;
  }

  if (goal.cadence === "weekly" && goal.activeDays?.length) {
    return goal.activeDays.includes(dayKey);
  }

  if (goal.cadence === "daily") {
    if (!activeDays.includes(dayKey)) return false;
    return !isKillStreakBroken(goal, date);
  }

  return false;
}

/**
 * Return the list of goals that apply to a specific date for planner surfaces.
 * Includes:
 *   - Daily goals that match the date's day key and are not excluded
 *   - Weekly goals with activeDays set — they auto-appear on preferred days
 */
export function getApplicableGoalsForDate(
  goals: Goal[],
  date: Date,
  excludedByGoal?: Map<string, Set<string>>,
): Goal[] {
  return goals.filter((goal) =>
    isGoalApplicableOnDate(goal, date, { excludedByGoal, mode: "auto" }),
  );
}
