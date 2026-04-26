"use client";

import { HDate, months } from "@hebcal/core";
import { toIsoDate } from "@/lib/date";
import type { Goal } from "@/features/goals/types/goal";

export const OMER_GOAL_ID = "__omer__";
export const LEGACY_OMER_COMPLETIONS_KEY = "steinberg.omer_completions.v1";
export const LEGACY_OMER_TITLE_KEY = "steinberg.omer_title.v1";

const OMER_ACTIVE_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type LegacyOmerState = {
  title?: string;
  completedDates?: string[];
};

export function getOmerDateRange(referenceDate: Date): { startDate: string; endDate: string } {
  const hdate = new HDate(referenceDate);
  const hebrewYear = hdate.getFullYear();

  // 16 Nisan (day 1) → 5 Sivan (day 49)
  const startGreg = new HDate(16, months.NISAN, hebrewYear).greg();
  const endGreg = new HDate(5, months.SIVAN, hebrewYear).greg();

  return {
    startDate: toIsoDate(startGreg),
    endDate: toIsoDate(endGreg),
  };
}

function uniqueSortedDates(dates: string[]): string[] {
  return [...new Set(dates)].sort();
}

export function readLegacyOmerState(): LegacyOmerState {
  if (typeof window === "undefined") return {};

  try {
    const rawDates = localStorage.getItem(LEGACY_OMER_COMPLETIONS_KEY);
    const rawTitle = localStorage.getItem(LEGACY_OMER_TITLE_KEY);
    const completedDates = rawDates ? (JSON.parse(rawDates) as string[]) : undefined;
    const title = rawTitle ?? undefined;
    return { title, completedDates };
  } catch {
    return {};
  }
}

export function clearLegacyOmerState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_OMER_COMPLETIONS_KEY);
    localStorage.removeItem(LEGACY_OMER_TITLE_KEY);
  } catch {}
}

export function buildPersistedOmerGoal(
  referenceDate: Date,
  existingGoal?: Goal,
  legacyState?: LegacyOmerState,
): Goal {
  const { startDate, endDate } = getOmerDateRange(referenceDate);
  const mergedCompletedDates = uniqueSortedDates([
    ...(existingGoal?.completedDates ?? []),
    ...(legacyState?.completedDates ?? []),
  ]).filter((date) => date >= startDate && date <= endDate);

  return {
    id: OMER_GOAL_ID,
    title: existingGoal?.title?.trim() || legacyState?.title?.trim() || "Sefirat HaOmer",
    cadence: "daily",
    status: existingGoal?.status ?? "ongoing",
    type: "binary",
    current: existingGoal?.current,
    completedDates: mergedCompletedDates,
    activeDays: OMER_ACTIVE_DAYS,
    excludes: existingGoal?.excludes,
    startsAt: existingGoal?.startsAt ?? "Tzais HaKochavim",
    expiresAt: existingGoal?.expiresAt ?? "Alot HaShachar",
    programKey: "omer",
    ifUnfinished: existingGoal?.ifUnfinished ?? "forgive",
    startDate,
    endDate,
    lockInDays: existingGoal?.lockInDays ?? true,
  };
}

export function syncOmerGoalInList(
  goals: Goal[],
  enabled: boolean,
  referenceDate: Date,
  legacyState?: LegacyOmerState,
): Goal[] {
  const existingIndex = goals.findIndex((goal) => goal.id === OMER_GOAL_ID);

  if (!enabled) {
    return existingIndex === -1 ? goals : goals.filter((goal) => goal.id !== OMER_GOAL_ID);
  }

  const existingGoal = existingIndex === -1 ? undefined : goals[existingIndex];
  const nextGoal = buildPersistedOmerGoal(referenceDate, existingGoal, legacyState);

  if (!existingGoal) {
    return [nextGoal, ...goals];
  }

  if (JSON.stringify(existingGoal) === JSON.stringify(nextGoal)) {
    return goals;
  }

  return goals.map((goal) => (goal.id === OMER_GOAL_ID ? nextGoal : goal));
}
