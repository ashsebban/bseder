import { z } from "zod";
import type { Goal } from "@/features/goals/types/goal";

// ─── Storage key versioning ──────────────────────────────────────────────────
// v1 key — bump to v2 if the schema changes in a breaking way and add a migration below.
const KEY_V1 = "steinberg_goals.v1";
const KEY_LEGACY = "steinberg_goals"; // pre-versioning key, migrated on first load

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
  lockInDays: z.boolean().optional(),
  adhoc: z.boolean().optional(),
  parentGoalId: z.string().optional(),
  milestones: z.array(MilestoneSchema).optional(),
});

const GoalsArraySchema = z.array(GoalSchema);

// ─── Public API ──────────────────────────────────────────────────────────────

export function saveGoals(goals: Goal[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY_V1, JSON.stringify(goals));
  } catch {
    // localStorage unavailable or quota exceeded
  }
}

export function loadGoals(): Goal[] {
  if (typeof window === "undefined") return [];
  try {
    // Prefer v1 key; migrate from legacy key if not yet upgraded
    let raw = localStorage.getItem(KEY_V1);
    if (raw === null) {
      const legacy = localStorage.getItem(KEY_LEGACY);
      if (legacy !== null) {
        // Migrate: write to new key, remove old
        localStorage.setItem(KEY_V1, legacy);
        localStorage.removeItem(KEY_LEGACY);
        raw = legacy;
      }
    }
    if (!raw) return [];

    const parsed = GoalsArraySchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      // Partial recovery: keep items that individually pass validation
      const items: unknown[] = JSON.parse(raw);
      return items
        .map((item) => GoalSchema.safeParse(item))
        .filter((r) => r.success)
        .map((r) => r.data as Goal);
    }
    return parsed.data as Goal[];
  } catch {
    return [];
  }
}
