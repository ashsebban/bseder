import { addDays, parseIsoDate, toIsoDate } from "../../../lib/date";
import type { Goal, GoalDayModel } from "../../goals/types/goal";
import type { DayAssignment } from "../../planner/lib/day-assignment-store";
import type { DayZmanim } from "./zmanim";

const IMPLIED_JEWISH_DAY_GOAL_IDS = new Set([
  "__omer__",
  "__pack_maariv__",
  "__pack_shema_night__",
]);

const FALLBACK_JEWISH_DAY_START_HOUR = 18;
const MAARIV_GOAL_ID = "__pack_maariv__";

function parseHHMMFraction(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours + minutes / 60;
}

function dateToFraction(date: Date): number {
  return date.getHours() + date.getMinutes() / 60;
}

function getBoundaryHour(zmanim: DayZmanim | null | undefined, name: string): number | null {
  return zmanim?.periods.find((period) => period.name === name)?.startHour ?? null;
}

function getJewishDayStartHour(
  goal: Pick<Goal, "id" | "startsAt">,
  zmanim?: DayZmanim | null,
): number {
  const shkiyah = getBoundaryHour(zmanim, "Shkiyah");
  const tzeit = getBoundaryHour(zmanim, "Tzais HaKochavim");

  if (goal.id === MAARIV_GOAL_ID) {
    return shkiyah ?? tzeit ?? FALLBACK_JEWISH_DAY_START_HOUR;
  }

  if (goal.startsAt) {
    const startsAt = getBoundaryHour(zmanim, goal.startsAt);
    if (startsAt !== null && startsAt >= (shkiyah ?? FALLBACK_JEWISH_DAY_START_HOUR)) {
      return startsAt;
    }
  }

  return tzeit ?? shkiyah ?? FALLBACK_JEWISH_DAY_START_HOUR;
}

export function getGoalDayModel(goal: Pick<Goal, "id" | "programKey" | "dayModel">): GoalDayModel {
  if (goal.dayModel) return goal.dayModel;
  if (goal.programKey === "omer") return "jewish";
  if (IMPLIED_JEWISH_DAY_GOAL_IDS.has(goal.id)) return "jewish";
  return "civil";
}

export function getAssignmentOccurrenceDate(
  assignment: Pick<DayAssignment, "date" | "occurrenceDate">,
): string {
  return assignment.occurrenceDate ?? assignment.date;
}

export function getGoalOccurrenceKey(goalId: string, occurrenceDate: string): string {
  return `${goalId}:${occurrenceDate}`;
}

export function getAssignmentOccurrenceKey(assignment: Pick<DayAssignment, "goalId" | "date" | "occurrenceDate">): string {
  return getGoalOccurrenceKey(assignment.goalId, getAssignmentOccurrenceDate(assignment));
}

export function getGoalOccurrenceDateForPlannerDate(
  goal: Pick<Goal, "id" | "programKey" | "dayModel" | "startsAt">,
  plannerDate: Date | string,
  options: {
    scheduledTime?: string;
    now?: Date;
    zmanim?: DayZmanim | null;
  } = {},
): string {
  const plannerDateObject = typeof plannerDate === "string"
    ? parseIsoDate(plannerDate)
    : plannerDate;
  const plannerIso = typeof plannerDate === "string"
    ? plannerDate
    : toIsoDate(plannerDate);

  if (!plannerDateObject || getGoalDayModel(goal) !== "jewish") return plannerIso;

  let fraction: number | null = null;
  if (options.scheduledTime) {
    fraction = parseHHMMFraction(options.scheduledTime);
  } else if (options.now && toIsoDate(options.now) === plannerIso) {
    fraction = dateToFraction(options.now);
  }

  if (fraction === null) return plannerIso;
  return fraction >= getJewishDayStartHour(goal, options.zmanim)
    ? toIsoDate(addDays(plannerDateObject, 1))
    : plannerIso;
}

export function getDateForGoalProgramLabel(goal: Pick<Goal, "id" | "programKey" | "dayModel">, occurrenceDate: string): Date {
  return parseIsoDate(occurrenceDate) ?? new Date(`${occurrenceDate}T00:00:00`);
}

/**
 * Returns the ISO date string of the current Jewish "day".
 * After nightfall (Tzais HaKochavim), the Jewish day has already turned over,
 * so we return tomorrow's civil date as "today" in the Jewish calendar.
 * Falls back to 18:00 when zmanim are unavailable.
 */
export function todayJewishIso(zmanim?: DayZmanim | null): string {
  const now = new Date();
  const fraction = now.getHours() + now.getMinutes() / 60;
  const tzais = getBoundaryHour(zmanim, "Tzais HaKochavim") ?? FALLBACK_JEWISH_DAY_START_HOUR;
  return fraction >= tzais ? toIsoDate(addDays(now, 1)) : toIsoDate(now);
}
