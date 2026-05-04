import { toIsoDate } from "../../../lib/date";
import type { Goal, GoalCadence } from "../types/goal";

export interface ActiveGoalCadenceSummary {
  cadence: GoalCadence;
  label: string;
  count: number;
}

export interface ActiveGoalsSummary {
  active: number;
  paused: number;
  queued: number;
  cadenceBreakdown: ActiveGoalCadenceSummary[];
}

const CADENCE_LABELS: Record<GoalCadence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  seasonal: "Seasonal",
  project: "Projects",
  "one-time": "Projects",
};

const CADENCE_ORDER: GoalCadence[] = [
  "daily",
  "weekly",
  "monthly",
  "seasonal",
  "yearly",
  "project",
  "one-time",
];

export function isActiveGoalToday(goal: Goal, todayIso: string): boolean {
  if (goal.status !== "ongoing" || goal.adhoc) return false;
  if (goal.startDate && goal.startDate > todayIso) return false;
  if (goal.endDate && goal.endDate < todayIso) return false;
  return true;
}

export function buildActiveGoalsSummary(goals: Goal[], today: Date): ActiveGoalsSummary {
  const todayIso = toIsoDate(today);
  const activeGoals = goals.filter((goal) => isActiveGoalToday(goal, todayIso));
  const cadenceCounts = new Map<GoalCadence, number>();

  for (const goal of activeGoals) {
    cadenceCounts.set(goal.cadence, (cadenceCounts.get(goal.cadence) ?? 0) + 1);
  }

  const cadenceBreakdown = CADENCE_ORDER
    .map((cadence) => ({
      cadence,
      label: CADENCE_LABELS[cadence],
      count: cadenceCounts.get(cadence) ?? 0,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return CADENCE_ORDER.indexOf(a.cadence) - CADENCE_ORDER.indexOf(b.cadence);
    });

  return {
    active: activeGoals.length,
    paused: goals.filter((goal) => goal.status === "paused" && !goal.adhoc).length,
    queued: goals.filter((goal) => (
      goal.status === "ongoing" &&
      !goal.adhoc &&
      goal.startDate !== undefined &&
      goal.startDate > todayIso
    )).length,
    cadenceBreakdown,
  };
}
