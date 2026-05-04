import type { Goal } from "../../goals/types/goal";
import type { DayZmanim } from "./zmanim";

export type GoalTimeState = "active" | "not-yet" | "expired";
export type GoalTimePlacementKind = "allowed" | "allowed-with-caveat" | "blocked";

export const MAARIV_GOAL_ID = "__pack_maariv__";
export const NIGHT_SHEMA_GOAL_ID = "__pack_shema_night__";

export type GoalTimeCaveat = {
  kind: "repeat-night-shema";
  followupGoalId: typeof NIGHT_SHEMA_GOAL_ID;
  title: string;
  description: string;
};

export type GoalTimePlacement = {
  kind: GoalTimePlacementKind;
  caveat?: GoalTimeCaveat;
};

export type GoalTimeWindowBand = {
  kind: "ideal" | "caveat";
  startHour: number | null;
  endHour: number | null;
  label: string;
  caveat?: GoalTimeCaveat;
};

type GoalWindowInfo = {
  startHour: number | null;
  endHour: number | null;
  startTime: Date | null;
  endTime: Date | null;
  wrapsOvernight: boolean;
};

const REPEAT_NIGHT_SHEMA_CAVEAT: GoalTimeCaveat = {
  kind: "repeat-night-shema",
  followupGoalId: NIGHT_SHEMA_GOAL_ID,
  title: "Repeat Shema after nightfall",
  description: "Ma'ariv before definite nightfall does not cover nighttime Shema.",
};

function nowFraction(now: Date): number {
  return now.getHours() + now.getMinutes() / 60;
}

function isMaarivGoal(goal: Pick<Goal, "id">): boolean {
  return goal.id === MAARIV_GOAL_ID;
}

function getBoundaryHour(zmanim: DayZmanim | undefined, name: string): number | null {
  return zmanim?.periods.find((period) => period.name === name)?.startHour ?? null;
}

function isFractionInWindow(fraction: number, startHour: number | null, endHour: number | null): boolean {
  if (startHour !== null && endHour !== null) {
    return startHour > endHour
      ? fraction >= startHour || fraction < endHour
      : fraction >= startHour && fraction < endHour;
  }
  if (startHour !== null) return fraction >= startHour;
  if (endHour !== null) return fraction < endHour;
  return true;
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
  return isFractionInWindow(fraction, windowInfo.startHour, windowInfo.endHour);
}

export function getGoalTimeWindowBands(
  goal: Pick<Goal, "id" | "startsAt" | "expiresAt">,
  zmanim: DayZmanim | undefined,
): GoalTimeWindowBand[] {
  const windowInfo = getGoalWindowInfo(goal, zmanim);
  if (!windowInfo) return [];

  const bands: GoalTimeWindowBand[] = [];
  if (isMaarivGoal(goal)) {
    const shkiyah = getBoundaryHour(zmanim, "Shkiyah");
    const tzeit = getBoundaryHour(zmanim, "Tzais HaKochavim");
    if (shkiyah !== null && tzeit !== null) {
      bands.push({
        kind: "caveat",
        startHour: shkiyah,
        endHour: tzeit,
        label: "Early Ma'ariv",
        caveat: REPEAT_NIGHT_SHEMA_CAVEAT,
      });
    }
  }

  bands.push({
    kind: "ideal",
    startHour: windowInfo.startHour,
    endHour: windowInfo.endHour,
    label: "Ideal window",
  });

  return bands;
}

export function getGoalTimePlacementForFraction(
  goal: Pick<Goal, "id" | "startsAt" | "expiresAt">,
  zmanim: DayZmanim | undefined,
  fraction: number,
): GoalTimePlacement {
  const bands = getGoalTimeWindowBands(goal, zmanim);
  if (bands.length === 0) return { kind: "allowed" };

  const idealBand = bands.find((band) => band.kind === "ideal");
  if (idealBand && isFractionInWindow(fraction, idealBand.startHour, idealBand.endHour)) {
    return { kind: "allowed" };
  }

  const caveatBand = bands.find((band) =>
    band.kind === "caveat" &&
    band.caveat &&
    isFractionInWindow(fraction, band.startHour, band.endHour),
  );
  if (caveatBand?.caveat) return { kind: "allowed-with-caveat", caveat: caveatBand.caveat };

  return { kind: "blocked" };
}

export function getGoalTimePlacementForTime(
  goal: Pick<Goal, "id" | "startsAt" | "expiresAt">,
  zmanim: DayZmanim | undefined,
  hhmm: string,
): GoalTimePlacement {
  const [hh, mm] = hhmm.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return { kind: "blocked" };
  return getGoalTimePlacementForFraction(goal, zmanim, hh + mm / 60);
}

export function getGoalTimePlacementForNow(
  goal: Pick<Goal, "id" | "startsAt" | "expiresAt">,
  zmanim: DayZmanim | undefined,
  isToday: boolean,
  now: Date = new Date(),
): GoalTimePlacement {
  if (!isToday) return { kind: "allowed" };
  return getGoalTimePlacementForFraction(goal, zmanim, nowFraction(now));
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

/**
 * True when the goal has a time window and the current moment is outside it
 * (either "not-yet" = too early, or "expired" = too late).
 * Used as the single source-of-truth guard before marking a goal complete.
 */
export function isGoalOutsideTimeWindow(
  goal: Pick<Goal, "startsAt" | "expiresAt">,
  zmanim: DayZmanim | undefined,
  isToday: boolean,
  now: Date = new Date(),
): boolean {
  if (!goal.startsAt && !goal.expiresAt) return false;
  const state = getGoalTimeStateForNow(goal, zmanim, isToday, now);
  return state === "not-yet" || state === "expired";
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
