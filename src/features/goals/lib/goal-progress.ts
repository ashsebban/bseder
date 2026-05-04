import { HebrewCalendar, HDate, months, flags } from "@hebcal/core";
import { parseIsoDate, toIsoDate, todayIso, startOfDay, startOfWeek, endOfWeek, startOfMonth, addDays } from "@/lib/date";
import type { Goal, GoalCadence } from "@/features/goals/types/goal";
import { computePeriodKey } from "@/features/planner/lib/period-key";
import type { DayAssignment } from "@/features/planner/lib/day-assignment-store";
import { DAY_KEYS, type DayKey, getApplicableGoalsForDate } from "@/features/goals/lib/goal-applicability";
import { getGoalProgramLabel } from "@/features/goals/lib/goal-programs";
import { getAssignmentOccurrenceDate, getGoalDayModel, getGoalOccurrenceDateForPlannerDate, todayJewishIso } from "@/features/calendar/lib/goal-day";

export { DAY_KEYS, getApplicableGoalsForDate };
export type { DayKey };

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

// ─── Behavior helpers (new fields with ifUnfinished fallback) ────────────────

export function effectiveOnMiss(goal: Goal): "ignore" | "track" {
  if (goal.onMiss) return goal.onMiss;
  if (goal.ifUnfinished === "track-failure" || goal.ifUnfinished === "backlog" || goal.ifUnfinished === "kill-streak") return "track";
  return "ignore";
}

export function effectiveKillOnMiss(goal: Goal): boolean {
  if (goal.killOnMiss !== undefined) return goal.killOnMiss;
  return goal.ifUnfinished === "kill-streak";
}

export function effectiveCarryover(goal: Goal): "drop" | "rollover" | "backlog" {
  if (goal.carryover) return goal.carryover;
  if (goal.ifUnfinished === "backlog") return "backlog";
  return "drop";
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
  const startDateLocal = goal.startDate ? parseIsoDate(goal.startDate) : null;
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
        const occurrenceDate = getAssignmentOccurrenceDate(a);
        if (a.goalId === goal.id && a.completed && occurrenceDate >= effectiveStartIso && occurrenceDate < periodEndIso) {
          doneSet.add(occurrenceDate);
        }
      }
    }
    done = doneSet.size;
  } else if (dayAssignments !== undefined) {
    const isJewish = getGoalDayModel(goal) === "jewish";
    if (isJewish) {
      // For Jewish-calendar goals, match assignments by occurrenceDate falling in the period
      // bounds instead of by Gregorian periodKey, since the period bounds are Hebrew-calendar-derived.
      const inPeriod = (a: DayAssignment) => {
        const occ = getAssignmentOccurrenceDate(a);
        return a.goalId === goal.id && occ >= effectiveStartIso && occ < periodEndIso;
      };
      const manualDone = dayAssignments
        .filter((a) => inPeriod(a) && a.completed)
        .reduce((sum, a) => sum + (a.targetAmount ?? 1), 0);
      const manualOccurrences = new Set(
        dayAssignments.filter(inPeriod).map((a) => getAssignmentOccurrenceDate(a)),
      );
      const autoShowDone = (goal.completedDates ?? []).filter(
        (d) => d >= effectiveStartIso && d < periodEndIso && !manualOccurrences.has(d),
      ).length;
      done = manualDone + autoShowDone;
    } else {
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
    }
  } else {
    done = Math.min(goal.current ?? 0, total);
  }

  let missed = 0;
  if (effectiveOnMiss(goal) === "track") {
    missed = Math.max(0, elapsed - done);
  }

  return { done, missed, total, elapsed };
}

/**
 * Compute unit-based rollup for quantified daily goals.
 *
 * Unlike computeRollupProgress (which is day-count based for daily goals),
 * this returns values in the goal's quantified units (e.g. pages, reps).
 * It preserves partial-day completion amounts from assignments.
 */
export function computeDailyQuantifiedUnitsRollup(
  goal: Goal,
  periodStart: Date,
  periodEnd: Date,
  today: Date,
  dayAssignments?: DayAssignment[],
): RollupProgress {
  const dailyTarget = goal.target ?? 0;
  const dayRollup = computeRollupProgress(goal, periodStart, periodEnd, today, dayAssignments);
  if (dailyTarget <= 0) {
    return { done: 0, missed: 0, total: 0, elapsed: 0 };
  }

  const periodStartIso = toIsoDate(periodStart);
  const periodEndIso = toIsoDate(periodEnd);
  const effectiveStartIso = goal.startDate && goal.startDate > periodStartIso
    ? goal.startDate
    : periodStartIso;

  const completedUnitsByDate = new Map<string, number>();
  if (dayAssignments) {
    for (const assignment of dayAssignments) {
      if (assignment.goalId !== goal.id || !assignment.completed) continue;
      const occurrenceDate = getAssignmentOccurrenceDate(assignment);
      if (occurrenceDate < effectiveStartIso || occurrenceDate >= periodEndIso) continue;
      completedUnitsByDate.set(
        occurrenceDate,
        (completedUnitsByDate.get(occurrenceDate) ?? 0) + (assignment.targetAmount ?? dailyTarget),
      );
    }
  }

  let doneUnits = [...completedUnitsByDate.values()].reduce((sum, amount) => sum + amount, 0);
  for (const dateIso of (goal.completedDates ?? [])) {
    if (dateIso < effectiveStartIso || dateIso >= periodEndIso) continue;
    if (completedUnitsByDate.has(dateIso)) continue;
    doneUnits += dailyTarget;
  }

  // Fallback for legacy quantified daily goals that tracked only `current`.
  if (doneUnits === 0 && !dayAssignments && (goal.completedDates?.length ?? 0) === 0) {
    doneUnits = Math.min(goal.current ?? 0, dayRollup.total * dailyTarget);
  }

  const missedUnits = effectiveOnMiss(goal) === "track"
    ? Math.max(0, dayRollup.elapsed * dailyTarget - doneUnits)
    : dayRollup.missed * dailyTarget;

  return {
    done: doneUnits,
    missed: missedUnits,
    total: dayRollup.total * dailyTarget,
    elapsed: dayRollup.elapsed * dailyTarget,
  };
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
    const doneViaAssignment = dayAssignments?.some((a) => (
      a.goalId === goal.id &&
      getAssignmentOccurrenceDate(a) === dateIso &&
      a.completed
    )) ?? false;
    if (doneViaCompletedDates || doneViaAssignment) {
      completed++;
    } else if (isPast && effectiveOnMiss(goal) === "track") {
      missed++;
    }
  }

  return total > 0 ? { completed, total, missed } : null;
}

// ─── Period Bounds ──────────────────────────────────────────────────────────

/**
 * Start and end of the Hebrew month containing `ref` (end exclusive).
 * Uses HDate to compute the Gregorian dates of 1st and last day of the Hebrew month.
 */
export function hebrewMonthBounds(ref: Date): { start: Date; end: Date } {
  const hdate = new HDate(ref);
  const year = hdate.getFullYear();
  const month = hdate.getMonth();
  const start = startOfDay(new HDate(1, month, year).greg());
  const lastDay = HDate.daysInMonth(month, year);
  const end = addDays(startOfDay(new HDate(lastDay, month, year).greg()), 1);
  return { start, end };
}

/**
 * Start and end of the Hebrew year containing `ref` (end exclusive).
 * Hebrew years run from 1 Tishrei to 29 Elul.
 */
export function hebrewYearBounds(ref: Date): { start: Date; end: Date } {
  const year = new HDate(ref).getFullYear();
  const start = startOfDay(new HDate(1, months.TISHREI, year).greg());
  const end = startOfDay(new HDate(1, months.TISHREI, year + 1).greg());
  return { start, end };
}

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

/**
 * Map a cadence to its current period bounds.
 * Pass `goal` to get Hebrew calendar bounds for Jewish-calendar goals.
 */
export function getPeriodBoundsForCadence(
  cadence: GoalCadence,
  goal?: Pick<Goal, "id" | "programKey" | "dayModel">,
): { start: Date; end: Date } {
  if (goal && getGoalDayModel(goal) === "jewish") {
    const today = new Date();
    if (cadence === "monthly") return hebrewMonthBounds(today);
    if (cadence === "yearly") return hebrewYearBounds(today);
  }
  switch (cadence) {
    case "daily":   return currentDayBounds();
    case "weekly":  return currentWeekBounds();
    case "monthly": return currentMonthBounds();
    case "yearly":  return currentYearBounds();
    default:        return currentMonthBounds();
  }
}

/**
 * Same as getPeriodBoundsForCadence but resolves relative to an arbitrary reference date.
 * Pass `goal` to get Hebrew calendar bounds for Jewish-calendar goals.
 */
export function getPeriodBoundsForCadenceAndDate(
  cadence: GoalCadence,
  ref: Date,
  goal?: Pick<Goal, "id" | "programKey" | "dayModel">,
): { start: Date; end: Date } {
  if (goal && getGoalDayModel(goal) === "jewish") {
    if (cadence === "monthly") return hebrewMonthBounds(ref);
    if (cadence === "yearly") return hebrewYearBounds(ref);
  }
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
 * (e.g., weekly goals shown inside the monthly view). Counts the actual goal periods
 * touched by the view window, then aggregates progress across those periods.
 *
 * For daily goals:
 * - binary goals use day-count rollup
 * - quantified goals use unit-level rollup (preserving partial assignment amounts)
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
    if (goal.type === "quantified" && goal.target) {
      return computeDailyQuantifiedUnitsRollup(goal, start, end, today, dayAssignments);
    }
    return computeRollupProgress(goal, start, end, today, dayAssignments);
  }

  const { start: vStart, end: vEnd } = getPeriodBoundsForCadenceAndDate(viewCadence, ref);
  const periods = new Map<string, { startIso: string; endIso: string }>();
  const cursor = new Date(vStart);
  while (cursor < vEnd) {
    const iso = toIsoDate(cursor);
    if (goal.startDate && iso < goal.startDate) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }
    if (goal.endDate && iso > goal.endDate) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }
    const pk = computePeriodKey(goal.cadence, cursor);
    if (pk && !periods.has(pk)) {
      const { start, end } = getPeriodBoundsForCadenceAndDate(goal.cadence, cursor);
      periods.set(pk, { startIso: toIsoDate(start), endIso: toIsoDate(end) });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  const periodCount = periods.size;

  let done = 0;
  if (dayAssignments !== undefined) {
    // Aggregate completions across each goal period touched by the view.
    // Includes legacy assignments that predate periodKey by falling back to date bounds.
    for (const [pk, bounds] of periods) {
      const pkAssignments = dayAssignments.filter(
        (assignment) =>
          assignment.goalId === goal.id &&
          (
            assignment.periodKey === pk ||
            (assignment.periodKey === undefined &&
              getAssignmentOccurrenceDate(assignment) >= bounds.startIso &&
              getAssignmentOccurrenceDate(assignment) < bounds.endIso)
          ),
      );
      const manualDone = pkAssignments
        .filter((assignment) => assignment.completed)
        .reduce((sum, assignment) => sum + (assignment.targetAmount ?? 1), 0);
      const manualDates = new Set(pkAssignments.map((assignment) => getAssignmentOccurrenceDate(assignment)));
      const autoShowDone = (goal.completedDates ?? []).filter(
        (dateIso) => dateIso >= bounds.startIso && dateIso < bounds.endIso && !manualDates.has(dateIso),
      ).length;
      done += manualDone + autoShowDone;
    }
  } else {
    done = goal.current ?? 0;
  }

  if (goal.type === "quantified") {
    return { done, total: (goal.target ?? 0) * periodCount, missed: 0, elapsed: 0 };
  }
  // Binary non-daily: expected completions in the view period
  return { done, total: periodCount, missed: 0, elapsed: 0 };
}

/**
 * Compute the current streak for a daily binary goal — how many consecutive
 * applicable days (before today) have been completed.
 * Returns 0 for non-daily or non-binary goals.
 */
export function computeCurrentStreak(goal: Goal, today: Date): number {
  if (goal.type !== "binary" || goal.cadence !== "daily") return 0;
  const completed = new Set(goal.completedDates ?? []);
  const activeDayKeys: string[] = goal.activeDays ?? [...DAY_KEYS];

  // For Jewish-calendar goals, "today" is the current Hebrew day.
  // After nightfall the Hebrew day has already turned over, so we advance today by 1.
  const effectiveToday = getGoalDayModel(goal) === "jewish"
    ? (parseIsoDate(todayJewishIso()) ?? today)
    : today;

  // Build a 2-year exclusion window to cover long streaks
  const rangeStart = new Date(effectiveToday.getFullYear() - 2, 0, 1);
  const excluded = buildExcludedDates(
    rangeStart,
    effectiveToday,
    goal.excludes?.categories ?? [],
    goal.excludes?.individual ?? [],
  );

  let streak = 0;
  const cursor = new Date(effectiveToday);
  cursor.setDate(cursor.getDate() - 1);

  for (let i = 0; i < 730; i++) {
    const dayKey = DAY_KEYS[cursor.getDay()];
    const dateStr = toIsoDate(cursor);
    if (goal.startDate && dateStr < goal.startDate) break;
    if (!activeDayKeys.includes(dayKey) || excluded.has(dateStr)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (completed.has(dateStr)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export interface GoalStreakSummary {
  goalId: string;
  title: string;
  currentStreak: number;
  lastCompletedDate?: string;
}

function latestCompletedDate(goal: Goal): string | undefined {
  const dates = goal.completedDates ?? [];
  let latest: string | undefined;
  for (const date of dates) {
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

export function computeActiveGoalStreaks(goals: Goal[], today: Date): GoalStreakSummary[] {
  const todayIso = toIsoDate(today);

  return goals
    .filter((goal) =>
      goal.status === "ongoing" &&
      goal.type === "binary" &&
      goal.cadence === "daily" &&
      (!goal.startDate || goal.startDate <= todayIso) &&
      (!goal.endDate || goal.endDate >= todayIso),
    )
    .map((goal) => ({
      goalId: goal.id,
      title: goal.title,
      currentStreak: computeCurrentStreak(goal, today),
      lastCompletedDate: latestCompletedDate(goal),
    }))
    .filter((summary) => summary.currentStreak > 0)
    .sort((a, b) => {
      if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
      if ((b.lastCompletedDate ?? "") !== (a.lastCompletedDate ?? "")) {
        return (b.lastCompletedDate ?? "").localeCompare(a.lastCompletedDate ?? "");
      }
      return a.title.localeCompare(b.title);
    });
}

export function computeBestStreak(goals: Goal[], today: Date): GoalStreakSummary | null {
  return computeActiveGoalStreaks(goals, today)[0] ?? null;
}

/**
 * Returns true if a kill-streak daily binary goal's streak was already broken
 * before the given date — i.e., the most recent applicable day before `date`
 * was not completed. Used to suppress new planner slots when the streak is gone.
 *
 * Returns false for goals that are not daily binary kill-streak goals, or when
 * no previous applicable day exists (first day of the goal).
 */
export function wasStreakBrokenBefore(goal: Goal, date: Date): boolean {
  if (!effectiveKillOnMiss(goal) || goal.type !== "binary" || goal.cadence !== "daily") {
    return false;
  }
  const completed = new Set(goal.completedDates ?? []);
  const activeDayKeys: string[] = goal.activeDays ?? [...DAY_KEYS];
  const rangeStart = new Date(date.getFullYear() - 1, 0, 1);
  const excluded = buildExcludedDates(
    rangeStart,
    date,
    goal.excludes?.categories ?? [],
    goal.excludes?.individual ?? [],
  );

  const cursor = new Date(date);
  cursor.setDate(cursor.getDate() - 1);
  for (let i = 0; i < 60; i++) {
    const dayKey = DAY_KEYS[cursor.getDay()];
    const dateStr = toIsoDate(cursor);
    if (goal.startDate && dateStr < goal.startDate) return false;
    if (!activeDayKeys.includes(dayKey) || excluded.has(dateStr)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    return !completed.has(dateStr);
  }
  return false;
}

/** Percentage progress for quantified goals with a target. Returns 0 if no target. */
export function computeSimpleProgressPercent(goal: Goal): number {
  if (goal.current === undefined || goal.target === undefined || goal.target === 0) return 0;
  return Math.round((goal.current / goal.target) * 100);
}

/** Build the subtitle/detail string displayed next to a goal's title in GoalRow. */
export function buildGoalDetailText(goal: Goal, referenceDate: Date = new Date()): string {
  const parts: string[] = [];
  const programLabel = getGoalProgramLabel(goal, referenceDate);

  if (programLabel) {
    parts.push(programLabel);
  }

  if (goal.type === "binary") {
    if (goal.cadence === "daily" && goal.completedDates !== undefined) {
      const today = getGoalOccurrenceDateForPlannerDate(goal, todayIso(), { now: new Date() });
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
