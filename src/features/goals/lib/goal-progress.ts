import { HebrewCalendar, HDate, flags } from "@hebcal/core";
import { toIsoDate, todayIso, startOfDay, startOfWeek, endOfWeek, startOfMonth, addDays } from "@/lib/date";
import type { Goal, GoalCadence } from "@/features/goals/types/goal";
import { computePeriodKey } from "@/features/planner/lib/period-key";
import type { DayAssignment } from "@/features/planner/lib/day-assignment-store";

export const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export type DayKey = typeof DAY_KEYS[number];

/** Map a category name to the @hebcal/core flag(s) it covers */
const CATEGORY_FLAGS: Record<string, number> = {
  "Yom Tov": flags.CHAG,
  "Erev Yom Tov": flags.EREV,
  "Chol HaMoed": flags.CHOL_HAMOED,
  "Rosh Chodesh": flags.ROSH_CHODESH,
  "Major Fasts": flags.MAJOR_FAST,
  "Minor Fasts": flags.MINOR_FAST,
  "Erev Fasts": flags.EREV | flags.MAJOR_FAST | flags.MINOR_FAST,
  Chanukah: flags.CHANUKAH_CANDLES,
};

export interface RollupProgress {
  done: number;
  missed: number;
  total: number;
  elapsed: number;
}

/**
 * Build a set of excluded ISO dates for the period using @hebcal/core.
 * Returns empty set if @hebcal/core is unavailable or fails.
 */
export function buildExcludedDates(
  periodStart: Date,
  periodEnd: Date,
  categoryExcludes: string[],
  individualExcludes: string[],
): Set<string> {
  const excludedDates = new Set<string>();
  if (categoryExcludes.length === 0 && individualExcludes.length === 0) return excludedDates;

  try {
    const start = new HDate(periodStart);
    const end = new HDate(periodEnd);
    const events = HebrewCalendar.calendar({
      start,
      end,
      isHebrewYear: false,
      sedrot: false,
      omer: false,
      shabbatMevarchim: false,
    });

    for (const ev of events) {
      const evDate = ev.getDate().greg();
      const dateStr = toIsoDate(evDate);
      const evFlags = ev.getFlags();

      for (const cat of categoryExcludes) {
        const flagMask = CATEGORY_FLAGS[cat];
        if (flagMask && evFlags & flagMask) {
          excludedDates.add(dateStr);
          break;
        }
      }

      if (!excludedDates.has(dateStr)) {
        const desc = ev.getDesc();
        for (const key of individualExcludes) {
          if (desc.replace(/\s+/g, "_").includes(key.replace(/\s+/g, "_"))) {
            excludedDates.add(dateStr);
            break;
          }
        }
      }
    }
  } catch {
    // @hebcal/core unavailable or failed — proceed without holiday exclusion
  }

  return excludedDates;
}

/**
 * Compute how many applicable days there are in [periodStart, periodEnd),
 * how many have elapsed, how many are done, and how many are missed.
 *
 * "Applicable" = activeDays match + not excluded by individual holiday keys.
 * Uses completedDates for binary daily goals when available; falls back to current.
 */
export function computeRollupProgress(
  goal: Goal,
  periodStart: Date,
  periodEnd: Date,
  today: Date,
  dayAssignments?: DayAssignment[],
): RollupProgress {
  const activeDays: string[] = goal.activeDays ?? [...DAY_KEYS];
  const categoryExcludes = goal.excludes?.categories ?? [];
  const individualExcludes = goal.excludes?.individual ?? [];

  const excludedDates = buildExcludedDates(periodStart, periodEnd, categoryExcludes, individualExcludes);

  let total = 0;
  let elapsed = 0;
  const periodStartIso = toIsoDate(periodStart);
  const periodEndIso = toIsoDate(periodEnd);

  // Respect startDate: don't count days before the goal began
  const effectiveStartIso = goal.startDate && goal.startDate > periodStartIso ? goal.startDate : periodStartIso;
  const cursor = new Date(Math.max(periodStart.getTime(), goal.startDate ? new Date(goal.startDate).getTime() : 0));

  while (cursor < periodEnd) {
    const dayKey = DAY_KEYS[cursor.getDay()];
    const dateStr = toIsoDate(cursor);

    if (activeDays.includes(dayKey) && !excludedDates.has(dateStr)) {
      total++;
      if (dateStr < toIsoDate(today)) elapsed++;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  // Determine done count:
  // - Binary daily goals: use completedDates for per-day tracking
  // - Assignment-tracked non-daily goals: combine manual assignment completions + auto-show completedDates
  // - Fallback: global goal.current (used when dayAssignments not provided)
  let done: number;
  if (goal.completedDates && goal.cadence === "daily") {
    done = goal.completedDates.filter((d) => d >= effectiveStartIso && d < periodEndIso).length;
  } else if (dayAssignments !== undefined) {
    const periodKey = computePeriodKey(goal.cadence, periodStart);
    const manualDone = dayAssignments
      .filter((a) => a.goalId === goal.id && a.periodKey === periodKey && a.completed)
      .reduce((sum, a) => sum + (a.targetAmount ?? 1), 0);
    // Also count completedDates entries for auto-show preferred days not covered by a manual assignment
    const manualDates = new Set(
      dayAssignments.filter((a) => a.goalId === goal.id && a.periodKey === periodKey).map((a) => a.date),
    );
    const autoShowDone = (goal.completedDates ?? []).filter(
      (d) => d >= effectiveStartIso && d < periodEndIso && !manualDates.has(d),
    ).length;
    done = manualDone + autoShowDone;
  } else {
    done = Math.min(goal.current ?? 0, total);
  }

  let missed = 0;
  if (goal.ifUnfinished === "track-failure") {
    missed = Math.max(0, elapsed - done);
  }

  return { done, missed, total, elapsed };
}

/**
 * Return the list of goals that apply to a specific date for the week grid.
 * Includes:
 *   - Daily goals that match the date's day key and are not excluded
 *   - Binary weekly goals with activeDays set — auto-scheduled, appear on preferred days without dragging
 */
export function getApplicableGoalsForDate(
  goals: Goal[],
  date: Date,
  excludedByGoal?: Map<string, Set<string>>,
): Goal[] {
  const dayKey = DAY_KEYS[date.getDay()];
  const dateIso = toIsoDate(date);
  return goals.filter((goal) => {
    // Auto-scheduled weekly goals — appear on preferred days (binary and quantified)
    if (
      goal.cadence === "weekly" &&
      goal.activeDays && goal.activeDays.length > 0 &&
      goal.status !== "paused"
    ) {
      if (goal.startDate && dateIso < goal.startDate) return false;
      return goal.activeDays.includes(dayKey);
    }
    // Daily goal logic
    if (goal.cadence !== "daily" || goal.status === "paused") return false;
    if (goal.startDate && dateIso < goal.startDate) return false;
    const activeDays: string[] = goal.activeDays ?? [...DAY_KEYS];
    if (!activeDays.includes(dayKey)) return false;
    if (excludedByGoal?.get(goal.id)?.has(dateIso)) return false;
    return true;
  });
}

/**
 * Compute progress for a single calendar day across all daily goals.
 * Pass `excludedByGoal` (pre-computed per-goal excluded date sets) to apply holiday exclusions.
 * Returns null if no daily goals apply to this day.
 */
export function computeDayProgress(
  goals: Goal[],
  date: Date,
  excludedByGoal?: Map<string, Set<string>>,
): { completed: number; total: number; missed: number } | null {
  const dayKey = DAY_KEYS[date.getDay()];
  const dateIso = toIsoDate(date);
  const isPast = dateIso < todayIso();

  const dailyGoals = goals.filter((g) => g.cadence === "daily" && g.status !== "paused");

  let total = 0;
  let completed = 0;
  let missed = 0;

  for (const goal of dailyGoals) {
    if (goal.startDate && dateIso < goal.startDate) continue;
    const activeDays: string[] = goal.activeDays ?? [...DAY_KEYS];
    if (!activeDays.includes(dayKey)) continue;

    // Apply pre-computed holiday exclusions
    if (excludedByGoal?.get(goal.id)?.has(dateIso)) continue;

    total++;
    if (goal.completedDates?.includes(dateIso)) {
      completed++;
    } else if (isPast && goal.ifUnfinished === "track-failure") {
      missed++;
    }
  }

  return total > 0 ? { completed, total, missed } : null;
}

// ─── Period Bounds ──────────────────────────────────────────────────────────

/** Start and end of today (end is exclusive midnight of next day) */
export function currentDayBounds(): { start: Date; end: Date } {
  const start = startOfDay(new Date());
  return { start, end: addDays(start, 1) };
}

/** Start and end of the current week (Sun–Sat, end is exclusive) */
export function currentWeekBounds(): { start: Date; end: Date } {
  const start = startOfWeek(new Date());
  return { start, end: addDays(start, 7) };
}

/** Start and end of the current month (end is exclusive 1st of next month) */
export function currentMonthBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = startOfMonth(now);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

/** Start and end of the current calendar year (end is exclusive Jan 1 next year) */
export function currentYearBounds(): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), 0, 1),
    end: new Date(now.getFullYear() + 1, 0, 1),
  };
}

// ─── Domain Pure Functions (moved from UI components) ───────────────────────

/** Map a cadence to its current period bounds. Used for roll-up progress computation. */
export function getPeriodBoundsForCadence(cadence: GoalCadence): { start: Date; end: Date } {
  switch (cadence) {
    case "daily":   return currentDayBounds();
    case "weekly":  return currentWeekBounds();
    case "monthly": return currentMonthBounds();
    case "yearly":  return currentYearBounds();
    default:        return currentMonthBounds();
  }
}

/**
 * Same as getPeriodBoundsForCadence but resolves relative to an arbitrary reference date
 * instead of always using today. Used for navigation-aware cross-period rollup.
 */
export function getPeriodBoundsForCadenceAndDate(
  cadence: GoalCadence,
  ref: Date,
): { start: Date; end: Date } {
  switch (cadence) {
    case "daily": {
      const s = startOfDay(ref);
      return { start: s, end: addDays(s, 1) };
    }
    case "weekly": {
      const s = startOfWeek(ref);
      return { start: s, end: addDays(s, 7) };
    }
    case "monthly": {
      const s = startOfMonth(ref);
      return { start: s, end: new Date(ref.getFullYear(), ref.getMonth() + 1, 1) };
    }
    case "yearly":
      return {
        start: new Date(ref.getFullYear(), 0, 1),
        end: new Date(ref.getFullYear() + 1, 0, 1),
      };
    default: {
      const s = startOfMonth(ref);
      return { start: s, end: new Date(ref.getFullYear(), ref.getMonth() + 1, 1) };
    }
  }
}

/**
 * Compute a roll-up RollupProgress for a goal when viewed through a different cadence lens.
 *
 * Used in GoalsWorkspace when showing lower-cadence goals inside a higher-cadence view
 * (e.g., weekly goals shown inside the monthly view). Scales the target proportionally
 * by how many goal periods fit inside the view period.
 *
 * For daily goals: delegates to computeRollupProgress with the view-period bounds directly.
 * For non-daily goals: sums completions across ALL goal-periods within the view period.
 *
 * Pass referenceDate to resolve period bounds relative to a specific date (e.g. selectedDate
 * in the GoalTray). Defaults to today when omitted — Goals page behavior is unchanged.
 *
 * This is the single canonical implementation — do not re-implement this scaling elsewhere.
 */
export function computeCrossperiodProgress(
  goal: Goal,
  viewCadence: GoalCadence,
  today: Date,
  dayAssignments?: DayAssignment[],
  referenceDate?: Date,
): RollupProgress {
  const ref = referenceDate ?? today;

  if (goal.cadence === "daily") {
    const { start, end } = getPeriodBoundsForCadenceAndDate(viewCadence, ref);
    return computeRollupProgress(goal, start, end, today, dayAssignments);
  }

  const { start: vStart, end: vEnd } = getPeriodBoundsForCadenceAndDate(viewCadence, ref);
  const { start: gStart, end: gEnd } = getPeriodBoundsForCadenceAndDate(goal.cadence, ref);
  const viewDays = Math.round((vEnd.getTime() - vStart.getTime()) / 864e5);
  const goalDays = Math.round((gEnd.getTime() - gStart.getTime()) / 864e5);
  const scale = Math.max(1, Math.round(viewDays / goalDays));

  let done = 0;
  if (dayAssignments !== undefined) {
    // Aggregate completions across ALL goal-periods that fall within the view period
    const cursor = new Date(vStart);
    const seenPeriodKeys = new Set<string>();
    while (cursor < vEnd) {
      const pk = computePeriodKey(goal.cadence, cursor);
      if (pk && !seenPeriodKeys.has(pk)) {
        seenPeriodKeys.add(pk);
        done += dayAssignments
          .filter((a) => a.goalId === goal.id && a.periodKey === pk && a.completed)
          .reduce((sum, a) => sum + (a.targetAmount ?? 1), 0);
      }
      if (goal.cadence === "weekly") cursor.setDate(cursor.getDate() + 7);
      else if (goal.cadence === "monthly") cursor.setMonth(cursor.getMonth() + 1);
      else cursor.setFullYear(cursor.getFullYear() + 1);
    }
  } else {
    done = goal.current ?? 0;
  }

  if (goal.type === "quantified") {
    return { done, total: (goal.target ?? 0) * scale, missed: 0, elapsed: 0 };
  }
  // Binary non-daily: expected completions in the view period
  return { done, total: scale, missed: 0, elapsed: 0 };
}

/** Percentage progress for quantified goals with a target. Returns 0 if no target. */
export function computeSimpleProgressPercent(goal: Goal): number {
  if (goal.current === undefined || goal.target === undefined || goal.target === 0) return 0;
  return Math.round((goal.current / goal.target) * 100);
}

/** Build the subtitle/detail string displayed next to a goal's title in GoalRow. */
export function buildGoalDetailText(goal: Goal): string {
  const parts: string[] = [];

  if (goal.type === "binary") {
    if (goal.cadence === "daily" && goal.completedDates !== undefined) {
      const today = todayIso(); // local time — no UTC shift
      parts.push(goal.completedDates.includes(today) ? "Done today" : "Not yet today");
    } else {
      const statusLabel = goal.current && goal.current > 0 ? "done" : "not done";
      parts.push(`Ongoing • ${statusLabel}`);
    }
  } else {
    if (goal.current !== undefined && goal.target !== undefined) {
      const unit = goal.targetUnit ?? "";
      parts.push(`${goal.current}/${goal.target}${unit ? ` ${unit}` : ""}`);
    } else {
      parts.push("Ongoing");
    }
  }

  if (goal.activeDays && goal.activeDays.length > 0 && goal.activeDays.length < 7) {
    const first = goal.activeDays[0];
    const last = goal.activeDays[goal.activeDays.length - 1];
    parts.push(`${first}–${last}`);
  }

  if (goal.excludes) {
    const all = [...(goal.excludes.categories ?? []), ...(goal.excludes.individual ?? [])];
    if (all.length > 0) {
      const preview = all.slice(0, 2).join(", ");
      const suffix = all.length > 2 ? " …" : "";
      parts.push(`excl. ${preview}${suffix}`);
    }
  }

  return parts.join(" • ");
}
