import { z } from "zod";
import type { Goal } from "@/features/goals/types/goal";
import { clearScopedJson, loadScopedJsonArray, saveScopedJson } from "../../../lib/scoped-storage-store";

export const GOALS_STORAGE_UPDATED_EVENT = "goals-storage-updated";

export interface GoalsStorageUpdatedDetail {
  storageScope: string;
  goals: Goal[];
}

function dispatchGoalsStorageUpdated(storageScope: string, goals: Goal[]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GoalsStorageUpdatedDetail>(GOALS_STORAGE_UPDATED_EVENT, {
    detail: { storageScope, goals },
  }));
}

// ─── Storage key versioning ──────────────────────────────────────────────────
// v1 key — bump to v2 if the schema changes in a breaking way and add a migration below.
const KEY_V1 = "steinberg_goals.v1";
const DEFAULT_FIXED_GOAL_IDS = new Set([
  // Legacy pack IDs (keep for existing users)
  "__omer__",
  "__pack_tefillin__",
  "__pack_daf_yomi__",
  "__pack_chanukah__",
  "__pack_shacharis__",
  "__pack_mincha__",
  "__pack_maariv__",
  "__pack_shema_morning__",
  "__pack_shema_night__",
  "__pack_elul_selichot__",
  "__pack_kotel__",
  // New prebuilt goal IDs
  "__pre_bentching__",
  "__pre_netilat_yadayim__",
  "__pre_mishnah_yomit__",
  "__pre_halacha_yomit__",
  "__pre_parasha__",
  "__pre_chitas__",
  "__pre_tehillim__",
  "__pre_nach_yomi__",
  "__pre_elul_shofar__",
  "__pre_arba_minim__",
  "__pre_mishloach_manot__",
  "__pre_tashlich__",
  "__pre_candles__",
  "__pre_kiddush__",
  "__pre_havdalah__",
  "__pre_parshat_hashavua__",
  "__pre_seudat_shabbos__",
  "__pre_maaser__",
  "__pre_tzedakah_daily__",
  "__pre_volunteer__",
  "__pre_bikur_cholim__",
  "__pre_hachnasas_orchim__",
  "__pre_mezuzot__",
  "__pre_lulav_esrog__",
  "__pre_high_holiday_seats__",
  "__pre_tevilat_keilim__",
  "__pre_mussar__",
  "__pre_cheshbon_nefesh__",
  "__pre_gratitude__",
  "__pre_shmiras_halashon__",
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
  cadence: z.enum(["one-time", "yearly", "monthly", "weekly", "daily"]),
  status: z.enum(["ongoing", "done", "paused"]),
  type: z.enum(["binary", "quantified"]),
  target: z.number().optional(),
  targetUnit: z.string().optional(),
  current: z.number().optional(),
  completedDates: z.array(z.string()).optional(),

  activeDays: z.array(z.string()).optional(),
  excludes: z
    .object({
      categories: z.array(z.string()).optional(),
      individual: z.array(z.string()).optional(),
    })
    .optional(),
  ifUnfinished: z.enum(["forgive", "backlog", "track-failure", "kill-streak"]).optional(),
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

function normalizeGoals(goals: Goal[]): Goal[] {
  return goals.map(normalizeStarterPackGoal);
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
