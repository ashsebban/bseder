/**
 * Boundary between the v2 Prisma schema and the still-v1-shaped UI.
 *
 * The database stores clean rule/occurrence records:
 *   Goal.measure, Goal.failureMode, Goal.carryover, Assignment.status, etc.
 *
 * Some UI code still reads older names:
 *   goal.type, goal.ifUnfinished, goal.completedDates, DayAssignment.skipped.
 *
 * Keep that compatibility here so schema cleanup does not leak across every
 * component at once.
 */

import type { Prisma } from "@prisma/client";
import type {
  Assignment,
  Goal,
  GoalCarryover,
  GoalFailureMode,
  GoalMeasure,
  GoalProgramKey,
  GoalSource,
  GoalType,
  IfUnfinished,
} from "@/features/goals/types/goal";
import type { DayAssignment } from "@/features/planner/lib/day-assignment-store";
import { DAY_KEYS, type DayKey } from "@/features/goals/lib/goal-applicability";
import { isoAndHHMMToUtcDateTime, isoToUtcDate } from "@/lib/date";

function dayKeyToIndex(key: string): number {
  const i = DAY_KEYS.indexOf(key as DayKey);
  return i === -1 ? 0 : i;
}

function indexToDayKey(i: number): DayKey {
  return (DAY_KEYS[i] ?? "Sun") as DayKey;
}

function dateToIso(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoToDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  return isoToUtcDate(iso);
}

function dateTimeToHHMM(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function normalizeMeasure(goal: Goal): GoalMeasure {
  if (goal.measure) return goal.measure;
  return goal.type === "quantified" ? "numeric" : "binary";
}

function measureToLegacyType(measure: string): GoalType {
  return measure === "numeric" ? "quantified" : "binary";
}

function normalizeFailureMode(goal: Goal): GoalFailureMode {
  if (goal.failureMode) return goal.failureMode;
  if (goal.ifUnfinished === "kill-streak" || goal.killOnMiss) return "kill_streak";
  if (goal.ifUnfinished === "track-failure") return "punishing";
  return "forgiving";
}

function normalizeCarryover(goal: Goal): GoalCarryover {
  if (goal.carryover) return goal.carryover;
  if (goal.ifUnfinished === "backlog") return "backlog";
  return "drop";
}

function legacyIfUnfinished(failureMode: string, carryover: string): IfUnfinished {
  if (failureMode === "kill_streak") return "kill-streak";
  if (carryover === "backlog") return "backlog";
  if (failureMode === "punishing") return "track-failure";
  return "forgive";
}

function normalizeSource(goal: Goal): GoalSource {
  if (goal.source) return goal.source;
  if (goal.adhoc) return "one_off";
  if (goal.presetId) return "preset";
  return "custom";
}

type GoalDbCreate = Prisma.GoalUncheckedCreateInput;

export function goalToDbCreate(goal: Goal, userId: string): GoalDbCreate {
  return {
    id: goal.id,
    userId,
    parentGoalId: goal.parentGoalId ?? null,
    title: goal.title,
    description: goal.description ?? null,
    emoji: goal.emoji ?? null,
    cadence: goal.cadence,
    measure: normalizeMeasure(goal),
    status: goal.status,
    source: normalizeSource(goal),
    presetId: goal.presetId ?? null,
    dayModel: goal.dayModel ?? null,
    target: goal.target ?? null,
    targetUnit: goal.targetUnit ?? null,
    totalTarget: goal.totalTarget ?? null,
    failureMode: normalizeFailureMode(goal),
    carryover: normalizeCarryover(goal),
    noGettingAhead: goal.noGettingAhead ?? false,
    startsAt: goal.startsAt ?? null,
    expiresAt: goal.expiresAt ?? null,
    preferredMonthDay: goal.preferredMonthDay !== undefined ? String(goal.preferredMonthDay) : null,
    lockInDays: goal.lockInDays ?? false,
    startDate: isoToDate(goal.startDate) ?? null,
    endDate: isoToDate(goal.endDate) ?? null,
    dueDate: isoToDate(goal.dueDate) ?? null,
    endAfterPeriods: goal.endAfterPeriods ?? null,
    programKey: goal.programKey ?? null,
    completedAt: goal.completedAt ? new Date(goal.completedAt) : null,
    pausedAt: goal.pausedAt ? new Date(goal.pausedAt) : null,
    deletedAt: goal.deletedAt ? new Date(goal.deletedAt) : null,
  };
}

type GoalWithRelations = Prisma.GoalGetPayload<{
  include: {
    activeDays: true;
    exclusions: true;
    milestones: { where: { deletedAt: null } };
    assignments: { where: { completed: true; deletedAt: null } };
  };
}>;

export function dbRecordToGoal(record: GoalWithRelations): Goal {
  const activeDays = record.activeDays.map((r) => indexToDayKey(r.dayOfWeek));
  const individualExcludes = record.exclusions.map((r) => r.holidayKey);
  const completedDates = record.assignments
    .map((a) => dateToIso(a.occurrenceDate ?? a.date))
    .filter((d): d is string => d !== undefined)
    .sort();

  const milestones = record.milestones
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => {
      const completedAt = m.completedAt?.toISOString();
      return {
        id: m.id,
        label: m.label,
        markerAmount: m.markerAmount ?? undefined,
        completedDate: dateToIso(m.completedAt),
        completedAt,
      };
    });

  const preferredMonthDay: Goal["preferredMonthDay"] = (() => {
    const v = record.preferredMonthDay;
    if (!v) return undefined;
    if (v === "first" || v === "last") return v;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  })();

  const measure = record.measure as GoalMeasure;
  const failureMode = record.failureMode as GoalFailureMode;
  const carryover = record.carryover as GoalCarryover;
  const source = record.source as GoalSource;

  return {
    id: record.id,
    userId: record.userId,
    parentGoalId: record.parentGoalId ?? undefined,
    title: record.title,
    description: record.description ?? undefined,
    emoji: record.emoji ?? undefined,
    cadence: record.cadence as Goal["cadence"],
    measure,
    type: measureToLegacyType(measure),
    status: record.status as Goal["status"],
    source,
    presetId: record.presetId ?? undefined,
    dayModel: (record.dayModel as Goal["dayModel"]) ?? undefined,
    target: record.target ?? undefined,
    targetUnit: record.targetUnit ?? undefined,
    totalTarget: record.totalTarget ?? undefined,
    current: undefined,
    failureMode,
    carryover,
    ifUnfinished: legacyIfUnfinished(record.failureMode, record.carryover),
    killOnMiss: record.failureMode === "kill_streak" || undefined,
    backlog: 0,
    noGettingAhead: record.noGettingAhead || undefined,
    preferredMonthDay,
    lockInDays: record.lockInDays || undefined,
    adhoc: source === "one_off" || undefined,
    startsAt: record.startsAt ?? undefined,
    expiresAt: record.expiresAt ?? undefined,
    startDate: dateToIso(record.startDate),
    endDate: dateToIso(record.endDate),
    dueDate: dateToIso(record.dueDate),
    endAfterPeriods: record.endAfterPeriods ?? undefined,
    programKey: (record.programKey as GoalProgramKey) ?? undefined,
    activeDays: activeDays.length > 0 ? activeDays : undefined,
    exclusions: individualExcludes.length > 0 ? individualExcludes : undefined,
    excludes:
      individualExcludes.length > 0
        ? { individual: individualExcludes }
        : undefined,
    completedDates,
    milestones: milestones.length > 0 ? milestones : undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt?.toISOString(),
    completedAt: record.completedAt?.toISOString(),
    pausedAt: record.pausedAt?.toISOString(),
  };
}

type AssignmentDbCreate = Prisma.AssignmentUncheckedCreateInput;

export function dayAssignmentToDbCreate(
  da: DayAssignment,
  userId: string,
  goalId: string,
): AssignmentDbCreate {
  return {
    id: da.id,
    goalId,
    userId,
    date: isoToDate(da.date)!,
    occurrenceDate: da.occurrenceDate ? isoToDate(da.occurrenceDate) ?? null : null,
    periodKey: da.periodKey ?? null,
    targetAmount: da.targetAmount ?? null,
    scheduledTime: da.scheduledTime ?? null,
    durationMins: da.durationMins ?? null,
    completed: da.completed,
    completedAt: da.completedAt ? isoAndHHMMToUtcDateTime(da.date, da.completedAt) : null,
    status: da.skipped ? "skipped" : da.completed ? "completed" : "planned",
    materializedReason: da.generated ? null : da.completed ? "user_completed" : "user_scheduled",
    originalDate: da.replacedAutoDate ? isoToDate(da.replacedAutoDate) ?? null : null,
  };
}

type AssignmentRow = Prisma.AssignmentGetPayload<Record<string, never>>;

export function dbRecordToAssignment(record: AssignmentRow): Assignment {
  return {
    id: record.id,
    goalId: record.goalId,
    userId: record.userId,
    date: dateToIso(record.date)!,
    occurrenceDate: dateToIso(record.occurrenceDate),
    hebrewYear: record.hebrewYear ?? undefined,
    hebrewMonth: record.hebrewMonth ?? undefined,
    hebrewDay: record.hebrewDay ?? undefined,
    seasonalIndex: record.seasonalIndex ?? undefined,
    periodKey: record.periodKey ?? undefined,
    windowStart: record.windowStart?.toISOString(),
    windowEnd: record.windowEnd?.toISOString(),
    targetAmount: record.targetAmount ?? undefined,
    scheduledTime: record.scheduledTime ?? undefined,
    durationMins: record.durationMins ?? undefined,
    completed: record.completed,
    completedAt: record.completedAt?.toISOString(),
    actualAmount: record.actualAmount ?? undefined,
    status: record.status as Assignment["status"],
    materializedReason: (record.materializedReason as Assignment["materializedReason"]) ?? undefined,
    originalDate: dateToIso(record.originalDate),
    note: record.note ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt?.toISOString(),
  };
}

export function dbRecordToDayAssignment(record: AssignmentRow): DayAssignment {
  return {
    id: record.id,
    goalId: record.goalId,
    date: dateToIso(record.date)!,
    occurrenceDate: dateToIso(record.occurrenceDate),
    periodKey: record.periodKey ?? undefined,
    targetAmount: record.targetAmount ?? undefined,
    scheduledTime: record.scheduledTime ?? undefined,
    durationMins: record.durationMins ?? undefined,
    completed: record.completed,
    completedAt: dateTimeToHHMM(record.completedAt),
    replacedAutoDate: dateToIso(record.originalDate),
    skipped: record.status === "skipped" || undefined,
  };
}

export function activeDayIndices(goal: Goal): number[] {
  return (goal.activeDays ?? []).map(dayKeyToIndex);
}

export function individualExclusionKeys(goal: Goal): string[] {
  return goal.exclusions ?? goal.excludes?.individual ?? [];
}
