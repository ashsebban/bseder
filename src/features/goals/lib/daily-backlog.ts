import { addDays, parseIsoDate, startOfDay, toIsoDate } from "../../../lib/date";
import { DAY_KEYS } from "./goal-applicability";
import { getGoalProgramLabel } from "./goal-programs";
import type { Goal } from "../types/goal";

export interface DailyBacklogEntry {
  date: string;
  label?: string;
}

export function isDailyBinaryBacklogGoal(goal: Goal): boolean {
  return goal.cadence === "daily" && goal.type === "binary" && goal.ifUnfinished === "backlog";
}

export function getDailyBacklogEntries(goal: Goal, referenceDate: Date): DailyBacklogEntry[] {
  if (!isDailyBinaryBacklogGoal(goal)) return [];

  const completedDates = new Set(goal.completedDates ?? []);
  const activeDays = goal.activeDays ?? DAY_KEYS;
  const refDay = startOfDay(referenceDate);
  const start = goal.startDate ? parseIsoDate(goal.startDate) : refDay;
  if (!start) return [];

  const lastRelevantDate = goal.endDate
    ? parseIsoDate(goal.endDate) ?? addDays(refDay, -1)
    : addDays(refDay, -1);
  const end = startOfDay(lastRelevantDate);
  if (start > end) return [];

  const entries: DailyBacklogEntry[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const isoDate = toIsoDate(cursor);
    const dayKey = DAY_KEYS[cursor.getDay()];
    if (!activeDays.includes(dayKey) || completedDates.has(isoDate)) {
      continue;
    }
    entries.push({
      date: isoDate,
      label: getGoalProgramLabel(goal, cursor) ?? undefined,
    });
  }

  return entries;
}
