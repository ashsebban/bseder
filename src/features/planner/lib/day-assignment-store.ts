import { z } from "zod";
import { clearScopedJson, loadScopedJsonArray, saveScopedJson } from "../../../lib/scoped-storage-store";

export const DAY_ASSIGNMENTS_STORAGE_UPDATED_EVENT = "day-assignments-storage-updated";

export interface DayAssignment {
  id: string;
  date: string;     // ISO date "2026-03-19"
  goalId: string;
  completed: boolean;
  targetAmount?: number; // for quantified goals: how many units to do this session
  /**
   * The period this assignment belongs to, regardless of its physical date.
   * Monthly: "2026-03" | Weekly: "2026-03-22" (week's Sunday) | Yearly: "2026"
   * Preserved when moving an assignment so it always counts for its origin period.
   */
  periodKey?: string;
  /**
   * Set when this assignment was created by dragging an auto-scheduled weekly goal
   * from its preferred day to another day. Stores the ISO date of the preferred day
   * that was replaced (e.g. if Sat was dragged to Thu, this is "2026-03-21").
   *
   * Used for per-source-day auto-show suppression: the WeekGrid suppresses the
   * auto-show on this specific date, not globally for the entire week.
   */
  replacedAutoDate?: string;
  /** "HH:MM" — when the user scheduled this on the daily timeline */
  scheduledTime?: string;
  /** Duration in minutes for the daily timeline */
  durationMins?: number;
  /** "HH:MM" — completion marker; mirrors scheduledTime when the item lives on the calendar */
  completedAt?: string;
  /** Shared by split quantified session fragments that originated from one planned session */
  sessionGroupId?: string;
  /** True when this occurrence was materialized from a recurring goal rule for the current planner period */
  generated?: boolean;
  /**
   * When true, this is a "skip record" — no rendered goal item.
   * Created when deleting an assignment that had replacedAutoDate, to keep
   * the preferred day suppressed.
   */
  skipped?: boolean;
}

export interface DayAssignmentsStorageUpdatedDetail {
  storageScope: string;
  assignments: DayAssignment[];
}

function dispatchDayAssignmentsStorageUpdated(storageScope: string, assignments: DayAssignment[]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<DayAssignmentsStorageUpdatedDetail>(DAY_ASSIGNMENTS_STORAGE_UPDATED_EVENT, {
    detail: { storageScope, assignments },
  }));
}

type PersistableAssignmentLike = Pick<
  Partial<DayAssignment>,
  "generated" | "replacedAutoDate" | "scheduledTime" | "durationMins" | "sessionGroupId" | "skipped"
>;

export function isEphemeralGeneratedAssignment(assignment: PersistableAssignmentLike): boolean {
  return (
    assignment.generated === true &&
    assignment.replacedAutoDate === undefined &&
    assignment.scheduledTime === undefined &&
    assignment.durationMins === undefined &&
    assignment.sessionGroupId === undefined &&
    assignment.skipped !== true
  );
}

export function getPersistableDayAssignments(assignments: DayAssignment[]): DayAssignment[] {
  return assignments.filter((assignment) => !isEphemeralGeneratedAssignment(assignment));
}

// ─── Storage key versioning ──────────────────────────────────────────────────
const KEY_V1 = "steinberg_day_assignments.v1";

// ─── Zod schema ──────────────────────────────────────────────────────────────
const DayAssignmentSchema = z.object({
  id: z.string(),
  date: z.string(),
  goalId: z.string(),
  completed: z.boolean(),
  targetAmount: z.number().optional(),
  periodKey: z.string().optional(),
  replacedAutoDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  durationMins: z.number().optional(),
  completedAt: z.string().optional(),
  sessionGroupId: z.string().optional(),
  generated: z.boolean().optional(),
  skipped: z.boolean().optional(),
});

const DayAssignmentsArraySchema = z.array(DayAssignmentSchema);

// ─── ID generation ───────────────────────────────────────────────────────────
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function loadDayAssignments(storageScope: string): DayAssignment[] {
  return loadScopedJsonArray({
    baseKey: KEY_V1,
    storageScope,
    arraySchema: DayAssignmentsArraySchema,
    itemSchema: DayAssignmentSchema,
  }) as DayAssignment[];
}

export function saveDayAssignments(storageScope: string, assignments: DayAssignment[]): void {
  const persistableAssignments = getPersistableDayAssignments(assignments);
  if (saveScopedJson({ baseKey: KEY_V1, storageScope, value: persistableAssignments })) {
    dispatchDayAssignmentsStorageUpdated(storageScope, persistableAssignments);
  }
}

export function clearDayAssignmentsStorage(storageScope: string): void {
  if (clearScopedJson({ baseKey: KEY_V1, storageScope })) {
    dispatchDayAssignmentsStorageUpdated(storageScope, []);
  }
}

export function createAssignment(
  goalId: string,
  date: string,
  targetAmount?: number,
  periodKey?: string,
  replacedAutoDate?: string,
  scheduledTime?: string,
  durationMins?: number,
  sessionGroupId?: string,
  generated?: boolean,
): DayAssignment {
  return {
    id: generateId(),
    goalId,
    date,
    completed: false,
    targetAmount,
    periodKey,
    replacedAutoDate,
    scheduledTime,
    durationMins,
    sessionGroupId,
    generated,
  };
}

export function createDayAssignmentId(): string {
  return generateId();
}
