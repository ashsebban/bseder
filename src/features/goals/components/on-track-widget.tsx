"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveLocation } from "@/features/calendar/lib/locations";
import { computeDayZmanim } from "@/features/calendar/lib/zmanim";
import { buildExcludedDates } from "@/features/goals/lib/goal-progress";
import {
  buildOnTrackSummary,
  type OnTrackItem,
  type OnTrackSummary,
} from "@/features/goals/lib/on-track-summary";
import {
  GOALS_STORAGE_UPDATED_EVENT,
  loadGoals,
  type GoalsStorageUpdatedDetail,
} from "@/features/goals/lib/goal-store";
import type { Goal } from "@/features/goals/types/goal";
import {
  DAY_ASSIGNMENTS_STORAGE_UPDATED_EVENT,
  loadDayAssignments,
  type DayAssignment,
  type DayAssignmentsStorageUpdatedDetail,
} from "@/features/planner/lib/day-assignment-store";
import { useCalendarPreferences } from "@/features/settings/hooks/use-calendar-preferences";
import { addDays, startOfDay, startOfWeek } from "@/lib/date";
import { cn } from "@/lib/cn";

function useOnTrackStorage(storageScope: string) {
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
      if (!detail || detail.storageScope !== storageScope) return;
      setGoals(detail.goals);
    }

    function handleAssignmentsUpdated(event: Event) {
      const detail = (event as CustomEvent<DayAssignmentsStorageUpdatedDetail>).detail;
      if (!detail || detail.storageScope !== storageScope) return;
      setAssignments(detail.assignments);
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-24 items-center justify-center px-5">
      <p className="text-center text-[11px] font-medium text-slate-300">{message}</p>
    </div>
  );
}

function healthLabel(summary: OnTrackSummary): string {
  if (summary.total === 0) return "No live goals";
  if (summary.offTrack > 0) return `${summary.offTrack} off track`;
  if (summary.attention > 0) return `${summary.attention} need a look`;
  return "All on pace";
}

function healthClass(summary: OnTrackSummary): string {
  if (summary.offTrack > 0) return "text-red-500";
  if (summary.attention > 0) return "text-amber-500";
  return "text-emerald-600";
}

function TrackBar({ summary }: { summary: OnTrackSummary }) {
  if (summary.total === 0) {
    return <div className="h-2 rounded-full bg-slate-100" />;
  }

  const onTrackPct = (summary.onTrack / summary.total) * 100;
  const attentionPct = (summary.attention / summary.total) * 100;
  const offTrackPct = (summary.offTrack / summary.total) * 100;

  return (
    <div
      className="flex h-2 overflow-hidden rounded-full bg-slate-100"
      title={`${summary.onTrack} on pace · ${summary.attention} watch · ${summary.offTrack} off track`}
    >
      {onTrackPct > 0 ? <div className="bg-emerald-500" style={{ width: `${onTrackPct}%` }} /> : null}
      {attentionPct > 0 ? <div className="bg-amber-400" style={{ width: `${attentionPct}%` }} /> : null}
      {offTrackPct > 0 ? <div className="bg-red-400" style={{ width: `${offTrackPct}%` }} /> : null}
    </div>
  );
}

function CountChip({
  value,
  label,
  className,
  title,
}: {
  value: number;
  label: string;
  className: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn("inline-flex min-w-0 items-center rounded-full px-2 py-0.5 text-[9.5px] font-bold", className)}
    >
      <span className="truncate">{value} {label}</span>
    </span>
  );
}

function detailTitle(items: OnTrackItem[], empty: string): string {
  if (items.length === 0) return empty;
  return items.map((item) => `${item.title}: ${item.reason}`).join("\n");
}

export function OnTrackWidget({ storageScope }: { storageScope: string }) {
  const { goals, assignments, loaded } = useOnTrackStorage(storageScope);
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
    () => buildOnTrackSummary({
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

  const percent = Math.round(summary.percent * 100);
  const attentionItems = summary.items.filter((item) => item.status === "attention");
  const offTrackItems = summary.items.filter((item) => item.status === "off-track");

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-[13px] font-semibold text-slate-700">On Track</p>
      </div>

      {!loaded ? (
        <EmptyState message="Checking pace..." />
      ) : summary.total === 0 ? (
        <EmptyState message="No live goals yet" />
      ) : (
        <div className="flex h-24 flex-col justify-between px-5 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-end gap-1.5">
              <p className="text-3xl font-black leading-none tracking-tight text-slate-900">{summary.onTrack}</p>
              <p className="pb-0.5 text-[11px] font-bold text-slate-400">/{summary.total}</p>
              <p className="pb-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">on pace</p>
            </div>
            <div className="min-w-0 text-right">
              <p className={cn("truncate text-[12px] font-bold", healthClass(summary))}>{healthLabel(summary)}</p>
              <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">{percent}% pace score</p>
            </div>
          </div>

          <TrackBar summary={summary} />

          <div className="flex min-w-0 gap-1.5 overflow-hidden">
            <CountChip
              value={summary.onTrack}
              label="on pace"
              className="bg-emerald-50 text-emerald-600"
              title={detailTitle(summary.items.filter((item) => item.status === "on-track"), "No goals on pace yet")}
            />
            {summary.attention > 0 ? (
              <CountChip
                value={summary.attention}
                label="watch"
                className="bg-amber-50 text-amber-600"
                title={detailTitle(attentionItems, "Nothing needs attention")}
              />
            ) : null}
            {summary.offTrack > 0 ? (
              <CountChip
                value={summary.offTrack}
                label="off"
                className="bg-red-50 text-red-600"
                title={detailTitle(offTrackItems, "Nothing off track")}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
