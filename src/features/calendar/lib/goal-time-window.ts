import type { Goal } from "../../goals/types/goal";
import type { DayZmanim } from "./zmanim";

export type GoalTimeState = "active" | "not-yet" | "expired";

type GoalWindowInfo = {
  startHour: number | null;
  endHour: number | null;
  startTime: Date | null;
  endTime: Date | null;
  wrapsOvernight: boolean;
};

function nowFraction(now: Date): number {
  return now.getHours() + now.getMinutes() / 60;
}

function shiftDays(date: Date, deltaDays: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + deltaDays);
  return next;
}

export function getGoalWindowInfo(
  goal: Pick<Goal, "startsAt" | "expiresAt">,
  zmanim: DayZmanim | undefined,
): GoalWindowInfo | null {
  if (!zmanim || (!goal.startsAt && !goal.expiresAt)) return null;

  const startPeriod = goal.startsAt
    ? (zmanim.periods.find((period) => period.name === goal.startsAt) ?? null)
    : null;
  const endPeriod = goal.expiresAt
    ? (zmanim.periods.find((period) => period.name === goal.expiresAt) ?? null)
    : null;

  const startHour = startPeriod?.startHour ?? null;
  const endHour = endPeriod?.startHour ?? null;

  return {
    startHour,
    endHour,
    startTime: startPeriod?.boundaryTime ?? null,
    endTime: endPeriod?.boundaryTime ?? null,
    wrapsOvernight:
      startHour !== null &&
      endHour !== null &&
      startHour > endHour,
  };
}

export function isTimeInGoalWindowFraction(
  goal: Pick<Goal, "startsAt" | "expiresAt">,
  zmanim: DayZmanim | undefined,
  fraction: number,
): boolean {
  const windowInfo = getGoalWindowInfo(goal, zmanim);
  if (!windowInfo) return true;

  const { startHour, endHour, wrapsOvernight } = windowInfo;
  if (startHour !== null && endHour !== null) {
    return wrapsOvernight
      ? fraction >= startHour || fraction < endHour
      : fraction >= startHour && fraction < endHour;
  }
  if (startHour !== null) return fraction >= startHour;
  if (endHour !== null) return fraction < endHour;
  return true;
}

export function getGoalTimeStateForNow(
  goal: Pick<Goal, "startsAt" | "expiresAt">,
  zmanim: DayZmanim | undefined,
  isToday: boolean,
  now: Date = new Date(),
): GoalTimeState {
  const windowInfo = getGoalWindowInfo(goal, zmanim);
  if (!isToday || !windowInfo) return "active";

  const { startHour, endHour, wrapsOvernight } = windowInfo;
  const fraction = nowFraction(now);

  if (startHour !== null && endHour !== null) {
    if (wrapsOvernight) {
      return isTimeInGoalWindowFraction(goal, zmanim, fraction) ? "active" : "not-yet";
    }
    if (fraction < startHour) return "not-yet";
    if (fraction >= endHour) return "expired";
    return "active";
  }
  if (startHour !== null && fraction < startHour) return "not-yet";
  if (endHour !== null && fraction >= endHour) return "expired";
  return "active";
}

function formatDiffMs(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "< 1m";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

export function computeGoalCountdown(
  goal: Pick<Goal, "startsAt" | "expiresAt">,
  zmanim: DayZmanim | undefined,
  now: Date,
  isDone: boolean,
): { label: string; urgent: boolean } | null {
  const windowInfo = getGoalWindowInfo(goal, zmanim);
  if (!windowInfo) return null;

  const { startHour, endHour, startTime, endTime, wrapsOvernight } = windowInfo;
  const fraction = nowFraction(now);

  if (wrapsOvernight && startHour !== null && endHour !== null) {
    const active = isTimeInGoalWindowFraction(goal, zmanim, fraction);
    const inAfterMidnightSegment = fraction < endHour;
    const adjustedStart = startTime
      ? (inAfterMidnightSegment ? shiftDays(startTime, -1) : startTime)
      : null;
    const adjustedEnd = endTime
      ? (inAfterMidnightSegment ? endTime : shiftDays(endTime, 1))
      : null;

    if (isDone) {
      if (adjustedEnd && now >= adjustedEnd) {
        return { label: "done before deadline", urgent: false };
      }
      return null;
    }

    if (active && adjustedEnd && now < adjustedEnd) {
      const diff = adjustedEnd.getTime() - now.getTime();
      return { label: `ends in ${formatDiffMs(diff)}`, urgent: diff < 30 * 60_000 };
    }

    if (!active && startTime && now < startTime) {
      const diff = startTime.getTime() - now.getTime();
      return { label: `starts in ${formatDiffMs(diff)}`, urgent: diff < 30 * 60_000 };
    }

    return null;
  }

  if (isDone) {
    if (endTime && now >= endTime) return { label: "done before deadline", urgent: false };
    return null;
  }

  if (startTime && now < startTime) {
    const diff = startTime.getTime() - now.getTime();
    return { label: `starts in ${formatDiffMs(diff)}`, urgent: diff < 30 * 60_000 };
  }
  if (endTime && now < endTime) {
    const diff = endTime.getTime() - now.getTime();
    return { label: `ends in ${formatDiffMs(diff)}`, urgent: diff < 30 * 60_000 };
  }
  if (endTime && now >= endTime) {
    return { label: "expired", urgent: true };
  }
  return null;
}
