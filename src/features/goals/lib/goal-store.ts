import { z } from "zod";
import type { Goal } from "@/features/goals/types/goal";
import { PREBUILT_GOALS } from "@/features/goals/lib/prebuilt-goals";
import {
  clearScopedJson,
  dispatchScopedStorageEvent,
  loadScopedJsonArray,
  saveScopedJson,
} from "../../../lib/scoped-storage-store";

export const GOALS_STORAGE_UPDATED_EVENT = "goals-storage-updated";

export interface GoalsStorageUpdatedDetail {
  storageScope: string;
  goals: Goal[];
}

function dispatchGoalsStorageUpdated(storageScope: string, goals: Goal[]) {
  dispatchScopedStorageEvent<GoalsStorageUpdatedDetail>(
    GOALS_STORAGE_UPDATED_EVENT,
    { storageScope, goals },
  );
}

// ─── Storage key versioning ──────────────────────────────────────────────────
// v1 key — bump to v2 if the schema changes in a breaking way and add a migration below.
const KEY_V1 = "steinberg_goals.v1";
const LEGACY_FIXED_GOAL_IDS = new Set(["__omer__"]);
const DEFAULT_FIXED_GOAL_IDS = new Set([
  ...LEGACY_FIXED_GOAL_IDS,
  ...PREBUILT_GOALS
    .filter((def) => def.buildGoal?.(new Date()).lockInDays)
    .map((def) => def.id),
]);

// ─── Zod schema (mirrors Goal interface) ────────────────────────────────────
// Required fields must be present and well-typed. Optional fields fall back to
// undefined if missing, so old records with new optional fields load safely.

const MilestoneSchema = z.object({
  id: z.string(),
  label: z.string(),
  markerAmount: z.number().optional(),
  completedDate: z.string().optional(),
});

const GoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  cadence: z.enum(["one-time", "project", "seasonal", "yearly", "monthly", "weekly", "daily"]),
  status: z.enum(["ongoing", "done", "paused", "archived", "killed"]),
  type: z.enum(["binary", "quantified"]),
  measure: z.enum(["binary", "numeric"]).optional(),
  target: z.number().optional(),
  targetUnit: z.string().optional(),
  current: z.number().optional(),
  dayModel: z.enum(["civil", "jewish"]).optional(),
  completedDates: z.array(z.string()).optional(),

  activeDays: z.array(z.string()).optional(),
  excludes: z
    .object({
      categories: z.array(z.string()).optional(),
      individual: z.array(z.string()).optional(),
    })
    .optional(),
  ifUnfinished: z.enum(["forgive", "backlog", "track-failure", "kill-streak"]).optional(),
  onMiss: z.enum(["ignore", "track"]).optional(),
  carryover: z.enum(["drop", "rollover", "backlog"]).optional(),
  killOnMiss: z.boolean().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  endAfterPeriods: z.number().optional(),
  dueDate: z.string().optional(),
  backlog: z.number().optional(),
  noGettingAhead: z.boolean().optional(),
  preferredMonthDay: z.union([z.literal("first"), z.literal("last"), z.number()]).optional(),
  startsAt: z.string().optional(),
  expiresAt: z.string().optional(),
  programKey: z.enum(["daf-yomi", "omer"]).optional(),
  source: z.enum(["preset", "preset_modified", "custom", "one_off"]).optional(),
  presetId: z.string().optional(),
  lockInDays: z.boolean().optional(),
  adhoc: z.boolean().optional(),
  parentGoalId: z.string().optional(),
  milestones: z.array(MilestoneSchema).optional(),
});

const GoalsArraySchema = z.array(GoalSchema);

function normalizeStarterPackGoal(goal: Goal): Goal {
  if (!DEFAULT_FIXED_GOAL_IDS.has(goal.id) || goal.lockInDays !== undefined) return goal;
  return { ...goal, lockInDays: true };
}

// Migrate legacy ifUnfinished → onMiss + carryover + killOnMiss for goals that predate the refactor.
function migrateGoalBehavior(goal: Goal): Goal {
  if (goal.onMiss !== undefined || goal.carryover !== undefined || goal.killOnMiss !== undefined) return goal;
  switch (goal.ifUnfinished) {
    case "track-failure": return { ...goal, onMiss: "track",  carryover: "drop" };
    case "backlog":       return { ...goal, onMiss: "track",  carryover: "backlog" };
    case "kill-streak":   return { ...goal, onMiss: "track",  carryover: "drop", killOnMiss: true };
    case "forgive":       return { ...goal, onMiss: "ignore", carryover: "drop" };
    default:              return goal;
  }
}

function normalizeGoals(goals: Goal[]): Goal[] {
  return goals.map(normalizeStarterPackGoal).map(migrateGoalBehavior);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function saveGoals(storageScope: string, goals: Goal[]): void {
  const normalizedGoals = normalizeGoals(goals);
  if (saveScopedJson({ baseKey: KEY_V1, storageScope, value: normalizedGoals })) {
    dispatchGoalsStorageUpdated(storageScope, normalizedGoals);
  }
}

export function loadGoals(storageScope: string): Goal[] {
  return loadScopedJsonArray({
    baseKey: KEY_V1,
    storageScope,
    arraySchema: GoalsArraySchema,
    itemSchema: GoalSchema,
    normalize: (goals) => normalizeGoals(goals as Goal[]),
  }) as Goal[];
}

export function clearGoalsStorage(storageScope: string): void {
  if (clearScopedJson({ baseKey: KEY_V1, storageScope })) {
    dispatchGoalsStorageUpdated(storageScope, []);
  }
}
