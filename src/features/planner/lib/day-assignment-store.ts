import { z } from "zod";

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
  /** "HH:MM" — when the user actually checked it off */
  completedAt?: string;
}

// ─── Storage key versioning ──────────────────────────────────────────────────
const KEY_V1 = "steinberg_day_assignments.v1";
const KEY_LEGACY = "steinberg_day_assignments"; // pre-versioning key, migrated on first load

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
});

const DayAssignmentsArraySchema = z.array(DayAssignmentSchema);

// ─── ID generation ───────────────────────────────────────────────────────────
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function loadDayAssignments(): DayAssignment[] {
  if (typeof window === "undefined") return [];
  try {
    // Prefer v1 key; migrate from legacy key if not yet upgraded
    let raw = localStorage.getItem(KEY_V1);
    if (raw === null) {
      const legacy = localStorage.getItem(KEY_LEGACY);
      if (legacy !== null) {
        localStorage.setItem(KEY_V1, legacy);
        localStorage.removeItem(KEY_LEGACY);
        raw = legacy;
      }
    }
    if (!raw) return [];

    const parsed = DayAssignmentsArraySchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      // Partial recovery: keep items that individually pass validation
      const items: unknown[] = JSON.parse(raw);
      return items
        .map((item) => DayAssignmentSchema.safeParse(item))
        .filter((r) => r.success)
        .map((r) => r.data as DayAssignment);
    }
    return parsed.data as DayAssignment[];
  } catch {
    return [];
  }
}

export function saveDayAssignments(assignments: DayAssignment[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY_V1, JSON.stringify(assignments));
  } catch {
    // localStorage unavailable or quota exceeded
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
): DayAssignment {
  return { id: generateId(), goalId, date, completed: false, targetAmount, periodKey, replacedAutoDate, scheduledTime, durationMins };
}
