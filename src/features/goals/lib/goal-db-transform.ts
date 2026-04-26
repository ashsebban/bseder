/**
 * Transforms between the TypeScript Goal/DayAssignment types (used throughout
 * the app) and the Prisma DB record shapes (GoalRecord, AssignmentRecord).
 *
 * This is the single place where field name mapping, date conversions,
 * and relation flattening/expansion happen.
 */

import type { Prisma } from "@prisma/client";
import type { Goal, GoalProgramKey } from "@/features/goals/types/goal";
import type { DayAssignment } from "@/features/planner/lib/day-assignment-store";
import { DAY_KEYS, type DayKey } from "@/features/goals/lib/goal-applicability";
import { isoAndHHMMToUtcDateTime, isoToUtcDate } from "@/lib/date";

// ─── Day-of-week mapping ─────────────────────────────────────────────────────
function dayKeyToIndex(key: string): number {
  const i = DAY_KEYS.indexOf(key as DayKey);
  return i === -1 ? 0 : i;
}

function indexToDayKey(i: number): string {
  return DAY_KEYS[i] ?? "Sun";
}

// ─── Date helpers ────────────────────────────────────────────────────────────

/** Convert a Date (from Prisma @db.Date) to an ISO string "YYYY-MM-DD" */
function dateToIso(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse an ISO date string to a UTC midnight Date for Prisma @db.Date */
function isoToDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  return isoToUtcDate(iso);
}

/** Convert a DB datetime to "HH:MM" time string */
function dateTimeToHHMM(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Combine an ISO date + "HH:MM" time string into a UTC DateTime */
function isoAndHHMMToDateTime(isoDate: string, hhmm: string): Date {
  return isoAndHHMMToUtcDateTime(isoDate, hhmm);
}

function parseCategoryExcludes(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    // Legacy fallback: tolerate comma-separated text values.
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
}

// ─── Goal → DB ───────────────────────────────────────────────────────────────

type GoalRecordCreate = Prisma.GoalRecordCreateInput;

export function goalToDbCreate(goal: Goal, userId: string): GoalRecordCreate {
  return {
    id: goal.id,
    user: { connect: { id: userId } },
    title: goal.title,
    cadence: goal.cadence,
    status: goal.status,
    type: goal.type,
    target: goal.target ?? null,
    targetUnit: goal.targetUnit ?? null,
    backlog: goal.backlog ?? 0,
    noGettingAhead: goal.noGettingAhead ?? false,
    ifUnfinished: goal.ifUnfinished ?? null,
    preferredMonthDay: goal.preferredMonthDay !== undefined ? String(goal.preferredMonthDay) : null,
    lockInDays: goal.lockInDays ?? false,
    adhoc: goal.adhoc ?? false,
    startsAt: goal.startsAt ?? null,
    expiresAt: goal.expiresAt ?? null,
    startDate: isoToDate(goal.startDate) ?? null,
    endDate: isoToDate(goal.endDate) ?? null,
    dueDate: isoToDate(goal.dueDate) ?? null,
    endAfterPeriods: goal.endAfterPeriods ?? null,
    programKey: goal.programKey ?? null,
    excludesCategories: goal.excludes?.categories?.length
      ? JSON.stringify(goal.excludes.categories)
      : null,
  };
}

// ─── DB → Goal ───────────────────────────────────────────────────────────────

type GoalRecordWithRelations = Prisma.GoalRecordGetPayload<{
  include: {
    activeDays: true;
    exclusions: true;
    milestones: { where: { deletedAt: null } };
    assignments: { where: { completed: true; deletedAt: null } };
  };
}>;

export function dbRecordToGoal(record: GoalRecordWithRelations): Goal {
  const activeDays = record.activeDays.map((r) => indexToDayKey(r.dayOfWeek));

  const individualExcludes = record.exclusions.map((r) => r.holidayKey);
  const categoryExcludes = parseCategoryExcludes(record.excludesCategories);

  const completedDates = record.assignments
    .map((a) => dateToIso(a.date))
    .filter((d): d is string => d !== undefined)
    .sort();

  const milestones = record.milestones
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => ({
      id: m.id,
      label: m.label,
      markerAmount: m.markerAmount ?? undefined,
      completedDate: dateToIso(m.completedAt),
    }));

  const preferredMonthDay: Goal["preferredMonthDay"] = (() => {
    const v = record.preferredMonthDay;
    if (!v) return undefined;
    if (v === "first" || v === "last") return v;
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  })();

  return {
    id: record.id,
    title: record.title,
    cadence: record.cadence as Goal["cadence"],
    status: record.status as Goal["status"],
    type: record.type as Goal["type"],
    target: record.target ?? undefined,
    targetUnit: record.targetUnit ?? undefined,
    backlog: record.backlog ?? undefined,
    noGettingAhead: record.noGettingAhead || undefined,
    ifUnfinished: (record.ifUnfinished as Goal["ifUnfinished"]) ?? undefined,
    preferredMonthDay,
    lockInDays: record.lockInDays || undefined,
    adhoc: record.adhoc || undefined,
    startsAt: record.startsAt ?? undefined,
    expiresAt: record.expiresAt ?? undefined,
    startDate: dateToIso(record.startDate),
    endDate: dateToIso(record.endDate),
    dueDate: dateToIso(record.dueDate),
    endAfterPeriods: record.endAfterPeriods ?? undefined,
    programKey: (record.programKey as GoalProgramKey) ?? undefined,
    activeDays: activeDays.length > 0 ? activeDays : undefined,
    excludes:
      individualExcludes.length > 0 || categoryExcludes.length > 0
        ? {
            individual: individualExcludes.length > 0 ? individualExcludes : undefined,
            categories: categoryExcludes.length > 0 ? categoryExcludes : undefined,
          }
        : undefined,
    completedDates: record.cadence === "daily" && record.type === "binary" ? completedDates : undefined,
    milestones: milestones.length > 0 ? milestones : undefined,
    parentGoalId: record.parentGoalId ?? undefined,
  };
}

// ─── DayAssignment → DB ──────────────────────────────────────────────────────

type AssignmentRecordCreate = Prisma.AssignmentRecordCreateInput;

export function dayAssignmentToDbCreate(da: DayAssignment, userId: string, goalId: string): AssignmentRecordCreate {
  return {
    id: da.id,
    goal: { connect: { id: goalId } },
    user: { connect: { id: userId } },
    date: isoToDate(da.date)!,
    periodKey: da.periodKey ?? null,
    targetAmount: da.targetAmount ?? null,
    scheduledTime: da.scheduledTime ?? null,
    durationMins: da.durationMins ?? null,
    completed: da.completed,
    completedAt: da.completedAt && da.date
      ? isoAndHHMMToDateTime(da.date, da.completedAt)
      : null,
    replacedAutoDate: da.replacedAutoDate ? isoToDate(da.replacedAutoDate) ?? null : null,
    skipped: da.skipped ?? false,
  };
}

// ─── DB → DayAssignment ──────────────────────────────────────────────────────

type AssignmentRecordRow = Prisma.AssignmentRecordGetPayload<Record<string, never>>;

export function dbRecordToDayAssignment(record: AssignmentRecordRow): DayAssignment {
  return {
    id: record.id,
    goalId: record.goalId,
    date: dateToIso(record.date)!,
    periodKey: record.periodKey ?? undefined,
    targetAmount: record.targetAmount ?? undefined,
    scheduledTime: record.scheduledTime ?? undefined,
    durationMins: record.durationMins ?? undefined,
    completed: record.completed,
    completedAt: dateTimeToHHMM(record.completedAt),
    replacedAutoDate: dateToIso(record.replacedAutoDate),
    skipped: record.skipped || undefined,
  };
}

// ─── Active-days helpers (for upsert) ────────────────────────────────────────

export function activeDayIndices(goal: Goal): number[] {
  return (goal.activeDays ?? []).map(dayKeyToIndex);
}

export function individualExclusionKeys(goal: Goal): string[] {
  return goal.excludes?.individual ?? [];
}
