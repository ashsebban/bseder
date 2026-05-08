import type { Goal } from "@/features/goals/types/goal";
import type { DayAssignment } from "@/features/planner/lib/day-assignment-store";
import { loadGoals, saveGoals } from "@/features/goals/lib/goal-store";
import { loadDayAssignments, saveDayAssignments } from "@/features/planner/lib/day-assignment-store";
import { findPrayerGoal } from "@/features/shuls/lib/prayer-completion";
import type { Prayer } from "@/features/shuls/types/minyan";
import { getPrayerLabel } from "@/features/shuls/lib/prayer-detector";
import { toIsoDate } from "@/lib/date";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface AddMinyanParams {
  storageScope: string;
  prayer: Prayer;
  shulName: string;
  address: string;
  time: string;       // "HH:MM"
  durationMins?: number;
  date?: string;
}

export type AddMinyanResult = {
  kind: "created" | "replaced" | "adhoc";
  goalTitle: string;
  prayer: Prayer;
  time: string;
  shulName: string;
};

export function addMinyanToCalendar({
  storageScope,
  prayer,
  shulName,
  address,
  time,
  durationMins = 30,
  date,
}: AddMinyanParams): AddMinyanResult {
  const isoDate = date ?? toIsoDate(new Date());
  const goals = loadGoals(storageScope);
  const assignments = loadDayAssignments(storageScope);
  const locationLabel = [shulName, address].filter(Boolean).join(" · ");

  // Prefer the user's existing prayer goal (prebuilt or user-created) over creating a new adhoc one.
  // This way "Daven Maariv" in the calendar reflects the same goal as always — just with a scheduled
  // time and location set from the shul they picked.
  const existingGoal = findPrayerGoal(goals, prayer);

  if (existingGoal) {
    // Check if there's already a scheduled assignment for this goal today — update it rather than duplicate
    const existingAssignment = assignments.find(
      (a) => a.goalId === existingGoal.id && a.date === isoDate && !a.skipped,
    );

    if (existingAssignment) {
      const updated = assignments.map((a) =>
        a.id === existingAssignment.id
          ? { ...a, scheduledTime: time, durationMins, location: locationLabel }
          : a,
      );
      saveDayAssignments(storageScope, updated);
      return {
        kind: "replaced",
        goalTitle: existingGoal.title,
        prayer,
        time,
        shulName,
      };
    } else {
      const newAssignment: DayAssignment = {
        id: generateId(),
        goalId: existingGoal.id,
        date: isoDate,
        completed: false,
        scheduledTime: time,
        durationMins,
        location: locationLabel,
      };
      saveDayAssignments(storageScope, [...assignments, newAssignment]);
      return {
        kind: "created",
        goalTitle: existingGoal.title,
        prayer,
        time,
        shulName,
      };
    }
  }

  // Fallback: no prayer goal found — create an adhoc one
  const goalId = generateId();
  const newGoal: Goal = {
    id: goalId,
    title: `${getPrayerLabel(prayer)} · ${shulName}`,
    cadence: "one-time",
    type: "binary",
    status: "ongoing",
    adhoc: true,
  };
  const newAssignment: DayAssignment = {
    id: generateId(),
    goalId,
    date: isoDate,
    completed: false,
    scheduledTime: time,
    durationMins,
    location: locationLabel,
  };
  saveGoals(storageScope, [...goals, newGoal]);
  saveDayAssignments(storageScope, [...assignments, newAssignment]);
  return {
    kind: "adhoc",
    goalTitle: newGoal.title,
    prayer,
    time,
    shulName,
  };
}
