import { startOfWeek, toIsoDate } from "@/lib/date";
import type { GoalCadence } from "@/features/goals/types/goal";

/**
 * Canonical function for computing a period key string from a cadence and date.
 * This is the single source of truth for period key format across the app.
 *
 * Monthly: "YYYY-MM"
 * Weekly:  "YYYY-MM-DD" (ISO date of the Sunday that starts the week)
 * Yearly:  "YYYY"
 * Daily / one-time: undefined (no period scoping needed)
 */
export function computePeriodKey(cadence: GoalCadence, date: Date): string | undefined {
  switch (cadence) {
    case "monthly":
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    case "weekly":
      return toIsoDate(startOfWeek(date));
    case "yearly":
      return String(date.getFullYear());
    default:
      return undefined;
  }
}
