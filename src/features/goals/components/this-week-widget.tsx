"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { resolveLocation } from "@/features/calendar/lib/locations";
import { computeDayZmanim } from "@/features/calendar/lib/zmanim";
import { buildExcludedDates } from "@/features/goals/lib/goal-progress";
import {
  buildWeeklyGoalsSummary,
  type WeeklyGoalsSummary,
} from "@/features/goals/lib/weekly-summary";
import type { Goal } from "@/features/goals/types/goal";
import {
  GOALS_STORAGE_UPDATED_EVENT,
  loadGoals,
  type GoalsStorageUpdatedDetail,
} from "@/features/goals/lib/goal-store";
import {
  DAY_ASSIGNMENTS_STORAGE_UPDATED_EVENT,
  loadDayAssignments,
  type DayAssignment,
  type DayAssignmentsStorageUpdatedDetail,
} from "@/features/planner/lib/day-assignment-store";
import { useCalendarPreferences } from "@/features/settings/hooks/use-calendar-preferences";
import { addDays, startOfDay, startOfWeek, toIsoDate } from "@/lib/date";
import { cn } from "@/lib/cn";

function useWeeklyGoalsStorage(storageScope: string) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [assignments, setAssignments] = useState<DayAssignment[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!storageScope) {
      setGoals([]);
      setAssignments([]);
      setLoaded(true);
      return;
    }

    setGoals(loadGoals(storageScope));
    setAssignments(loadDayAssignments(storageScope));
    setLoaded(true);

    function handleGoalsUpdated(event: Event) {
      const detail = (event as CustomEvent<GoalsStorageUpdatedDetail>).detail;
      if (detail?.storageScope === storageScope) setGoals(detail.goals);
    }

    function handleAssignmentsUpdated(event: Event) {
      const detail = (event as CustomEvent<DayAssignmentsStorageUpdatedDetail>).detail;
      if (detail?.storageScope === storageScope) setAssignments(detail.assignments);
    }

    function handleStorage() {
      setGoals(loadGoals(storageScope));
      setAssignments(loadDayAssignments(storageScope));
    }

    window.addEventListener(GOALS_STORAGE_UPDATED_EVENT, handleGoalsUpdated as EventListener);
    window.addEventListener(DAY_ASSIGNMENTS_STORAGE_UPDATED_EVENT, handleAssignmentsUpdated as EventListener);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(GOALS_STORAGE_UPDATED_EVENT, handleGoalsUpdated as EventListener);
      window.removeEventListener(DAY_ASSIGNMENTS_STORAGE_UPDATED_EVENT, handleAssignmentsUpdated as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, [storageScope]);

  return { goals, assignments, loaded };
}

function SummaryStat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="min-w-0">
      <p className={cn("text-[13px] font-bold tabular-nums", className)}>{value}</p>
      <p className="mt-0.5 truncate text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
    </div>
  );
}

function WeekProgressBar({ summary }: { summary: WeeklyGoalsSummary }) {
  const completedPct = summary.total > 0 ? (summary.completed / summary.total) * 100 : 0;
  const missedPct = summary.total > 0 ? (summary.missed / summary.total) * 100 : 0;
  const remainingPct = Math.max(0, 100 - completedPct - missedPct);

  return (
    <div
      className="flex h-2 overflow-hidden rounded-full bg-slate-100"
      title={`${summary.completed} done · ${summary.missed} missed · ${summary.remaining} left`}
    >
      {completedPct > 0 ? <div className="bg-emerald-500" style={{ width: `${completedPct}%` }} /> : null}
      {missedPct > 0 ? <div className="bg-red-400" style={{ width: `${missedPct}%` }} /> : null}
      {remainingPct > 0 ? <div className="bg-slate-200" style={{ width: `${remainingPct}%` }} /> : null}
    </div>
  );
}

export function ThisWeekWidget({ storageScope }: { storageScope: string }) {
  const { goals, assignments, loaded } = useWeeklyGoalsStorage(storageScope);
  const { preferences } = useCalendarPreferences(undefined, storageScope);
  const [now, setNow] = useState(() => new Date());
  const today = useMemo(() => startOfDay(now), [now]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const excludedByGoal = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const weekStart = startOfWeek(today, preferences.weekStartsOn);
    const weekEnd = addDays(weekStart, 6);
    for (const goal of goals) {
      if (!goal.excludes?.categories?.length && !goal.excludes?.individual?.length) continue;
      map.set(
        goal.id,
        buildExcludedDates(weekStart, weekEnd, goal.excludes?.categories ?? [], goal.excludes?.individual ?? []),
      );
    }
    return map;
  }, [goals, preferences.weekStartsOn, today]);

  const todayZmanim = useMemo(() => {
    const location = resolveLocation(preferences);
    if (!location) return null;
    return computeDayZmanim(today, location, preferences.timeFormat);
  }, [preferences, today]);

  const summary = useMemo(
    () => buildWeeklyGoalsSummary({
      goals,
      assignments,
      today,
      now,
      todayZmanim,
      weekStartsOn: preferences.weekStartsOn,
      excludedByGoal,
    }),
    [assignments, excludedByGoal, goals, now, preferences.weekStartsOn, today, todayZmanim],
  );

  const percent = Math.round(summary.completionRate * 100);
  const todayLabel = summary.dueToday > 0 ? `${summary.dueToday} left today` : "Today clear";
  const todayIso = toIsoDate(today);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-slate-700">This Week</p>
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{summary.label}</span>
        </div>
      </div>

      {!loaded ? (
        <div className="flex h-24 items-center justify-center px-5">
          <p className="text-center text-[11px] font-medium text-slate-300">Reading the week…</p>
        </div>
      ) : summary.total === 0 ? (
        <div className="flex h-24 items-center justify-center px-5">
          <p className="text-center text-[11px] font-medium text-slate-300">Nothing scheduled this week.</p>
        </div>
      ) : (
        <div className="flex h-24 flex-col justify-between px-5 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-end gap-1.5">
              <p className="text-3xl font-black leading-none tracking-tight text-slate-900">{summary.completed}</p>
              <p className="pb-0.5 text-[11px] font-bold text-slate-400">/{summary.total}</p>
            </div>
            <div className="text-right">
              <p className="text-[13px] font-bold text-emerald-600">{percent}%</p>
              {summary.dueToday > 0 ? (
                <Link
                  href={`/planner?view=day&date=${todayIso}`}
                  className="mt-0.5 inline-flex rounded-full bg-brand/[0.08] px-2 py-0.5 text-[10px] font-semibold text-brand transition hover:bg-brand/10"
                  title="Open today's planner"
                >
                  {todayLabel}
                </Link>
              ) : (
                <p className="mt-0.5 text-[10px] font-semibold text-emerald-600">{todayLabel}</p>
              )}
            </div>
          </div>

          <WeekProgressBar summary={summary} />

          <div className="grid grid-cols-3 gap-2">
            <SummaryStat label="Done" value={summary.completed} className="text-emerald-600" />
            <SummaryStat label="Missed" value={summary.missed} className="text-red-500" />
            <SummaryStat label="Left" value={summary.remaining} className="text-slate-600" />
          </div>
        </div>
      )}
    </div>
  );
}
