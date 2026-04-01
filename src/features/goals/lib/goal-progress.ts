import { HebrewCalendar, HDate, flags } from "@hebcal/core";
import { toIsoDate, todayIso, startOfDay, startOfWeek, endOfWeek, startOfMonth, addDays } from "@/lib/date";
import type { Goal, GoalCadence } from "@/features/goals/types/goal";
import { computePeriodKey } from "@/features/planner/lib/period-key";
import type { DayAssignment } from "@/features/planner/lib/day-assignment-store";

export const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export type DayKey = typeof DAY_KEYS[number];

/**
 * Category flag definitions for holiday exclusion matching.
 *
 * `mask`        — the event must have at least one of these bits set
 * `forbids`     — if set, the event must NOT have any of these bits
 * `requiresAny` — if set, the event must ALSO have at least one of these bits
 *
 * Why forbids matters:
 *   In @hebcal/core, Erev Yom Tov events (e.g. "Erev Pesach") carry BOTH flags.CHAG
 *   and flags.EREV — because Yom Tov halachically begins at nightfall of that Gregorian day.
 *   Without `forbids: flags.EREV`, the "Yom Tov" category would match Erev Pesach and exclude
 *   the full Gregorian day, even though the daytime hours are still Erev (pre-holiday).
 *
 * Why requiresAny matters for "Erev Fasts":
 *   The previous definition used `flags.EREV | flags.MAJOR_FAST | flags.MINOR_FAST` as a single
 *   mask, which matches any event with ANY of those bits — so regular fast days (Yom Kippur,
 *   17 Tammuz) would incorrectly match "Erev Fasts". The correct intent is events that have
 *   EREV AND one of the fast flags (e.g. "Erev Tisha B'Av" = EREV + MAJOR_FAST).
 */
interface CategoryFlagDef {
  mask: number;
  forbids?: number;
  requiresAny?: number;
}

const CATEGORY_FLAGS: Record<string, CategoryFlagDef> = {
  "Yom Tov":      { mask: flags.CHAG,             forbids: flags.EREV },
  "Erev Yom Tov": { mask: flags.EREV },
  "Chol HaMoed":  { mask: flags.CHOL_HAMOED },
  "Rosh Chodesh": { mask: flags.ROSH_CHODESH },
  "Major Fasts":  { mask: flags.MAJOR_FAST },
  "Minor Fasts":  { mask: flags.MINOR_FAST },
  // Erev of a fast: must have EREV flag AND at least one fast flag
  "Erev Fasts":   { mask: flags.EREV, requiresAny: flags.MAJOR_FAST | flags.MINOR_FAST },
  Chanukah:       { mask: flags.CHANUKAH_CANDLES },
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
        const def = CATEGORY_FLAGS[cat];
        if (!def) continue;
        const matches = (evFlags & def.mask) !== 0;
        const forbidden = def.forbids ? (evFlags & def.forbids) !== 0 : false;
        const extraReq = def.requiresAny ? (evFlags & def.requiresAny) !== 0 : true;
        if (matches && !forbidden && extraReq) {
          excludedDates.add(dateStr);
          break;
        }
      }

      if (!excludedDates.has(dateStr)) {
        const desc = ev.getDesc();
        const normalizedDesc = desc.replace(/\s+/g, "_");
        for (const key of individualExcludes) {
          const normalizedKey = key.replace(/\s+/g, "_");
          // Don't let "Erev Pesach" match the "Pesach" individual key.
          // Erev events must only match against Erev-prefixed keys.
          if (normalizedDesc.startsWith("Erev_") && !normalizedKey.startsWith("Erev_")) continue;
          if (normalizedDesc.includes(normalizedKey)) {
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
  // Parse startDate as LOCAL midnight to avoid UTC-offset shifting the date by a day in UTC+ timezones
  const startDateLocal = goal.startDate
    ? (() => { const [y, m, d] = goal.startDate.split("-").map(Number); return new Date(y, m - 1, d); })()
    : null;
  const cursor = new Date(Math.max(periodStart.getTime(), startDateLocal ? startDateLocal.getTime() : 0));

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
  // - Daily goals: union of completedDates AND completed assignments (either mechanism counts)
  // - Assignment-tracked non-daily goals: combine manual assignment completions + auto-show completedDates
  // - Fallback: global goal.current (used when dayAssignments not provided)
  let done: number;
  if (goal.cadence === "daily") {
    // Both completedDates and assignment.completed are valid completion signals for daily goals.
    // They can diverge when a goal was completed via assignment toggle vs direct daily toggle.
    const doneSet = new Set<string>(
      (goal.completedDates ?? []).filter((d) => d >= effectiveStartIso && d < periodEndIso),
    );
    if (dayAssignments) {
      for (const a of dayAssignments) {
        if (a.goalId === goal.id && a.completed && a.date >= effectiveStartIso && a.date < periodEndIso) {
          doneSet.add(a.date);
        }
      }
    }
    done = doneSet.size;
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
  dayAssignments?: DayAssignment[],
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
    // A daily goal is done if either completedDates has the entry OR a completed assignment exists.
    // Both are valid completion signals — they can diverge when completion was recorded via
    // assignment toggle (which updates assignment.completed) vs the daily checklist toggle
    // (which updates completedDates directly).
    const doneViaCompletedDates = goal.completedDates?.includes(dateIso) ?? false;
    const doneViaAssignment = dayAssignments?.some((a) => a.goalId === goal.id && a.date === dateIso && a.completed) ?? false;
    if (doneViaCompletedDates || doneViaAssignment) {
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
    // Aggregate completions across ALL goal-periods that fall within the view period.
    // Mirrors computeRollupProgress: counts both explicit DayAssignments (with periodKey)
    // AND completedDates entries for auto-show preferred days not covered by an assignment.
    const cursor = new Date(vStart);
    const seenPeriodKeys = new Set<string>();
    while (cursor < vEnd) {
      const pk = computePeriodKey(goal.cadence, cursor);
      if (pk && !seenPeriodKeys.has(pk)) {
        seenPeriodKeys.add(pk);
        const pkAssignments = dayAssignments.filter((a) => a.goalId === goal.id && a.periodKey === pk);
        const manualDone = pkAssignments
          .filter((a) => a.completed)
          .reduce((sum, a) => sum + (a.targetAmount ?? 1), 0);
        const manualDates = new Set(pkAssignments.map((a) => a.date));
        const { start: gPStart, end: gPEnd } = getPeriodBoundsForCadenceAndDate(goal.cadence, cursor);
        const gPStartIso = toIsoDate(gPStart);
        const gPEndIso = toIsoDate(gPEnd);
        const autoShowDone = (goal.completedDates ?? []).filter(
          (d) => d >= gPStartIso && d < gPEndIso && !manualDates.has(d),
        ).length;
        done += manualDone + autoShowDone;
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
