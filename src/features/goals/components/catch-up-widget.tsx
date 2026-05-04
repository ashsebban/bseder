"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CircleCheck, Clock3 } from "lucide-react";
import { computeDayZmanim, type DayZmanim } from "@/features/calendar/lib/zmanim";
import { getGoalTimeStateForNow, getGoalWindowInfo, computeGoalCountdown } from "@/features/calendar/lib/goal-time-window";
import { getAssignmentOccurrenceDate, getGoalOccurrenceDateForPlannerDate } from "@/features/calendar/lib/goal-day";
import { resolveLocation } from "@/features/calendar/lib/locations";
import {
  computeCrossperiodProgress,
  buildExcludedDates,
} from "@/features/goals/lib/goal-progress";
import { getDailyBacklogEntries } from "@/features/goals/lib/daily-backlog";
import { isGoalApplicableOnDate } from "@/features/goals/lib/goal-applicability";
import type { Goal, GoalCadence } from "@/features/goals/types/goal";
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
import { addDays, endOfWeek, startOfDay, startOfMonth, startOfWeek, toIsoDate } from "@/lib/date";
import { cn } from "@/lib/cn";

type PressureLevel = "missed" | "soon" | "behind";

interface PressureItem {
  goalId: string;
  title: string;
  level: PressureLevel;
  score: number;
  label: string;
  detail: string;
}

interface BacklogItem {
  goalId: string;
  title: string;
  amount: number;
  detail: string;
}

const PRESSURE_LEVEL_RANK: Record<PressureLevel, number> = {
  missed: 3,
  soon: 2,
  behind: 1,
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function getCurrentPeriodBounds(cadence: GoalCadence, today: Date, weekStartsOn: 0 | 1) {
  if (cadence === "weekly") {
    const start = startOfWeek(today, weekStartsOn);
    return { start, end: addDays(start, 7) };
  }
  if (cadence === "monthly") {
    const start = startOfMonth(today);
    return { start, end: new Date(today.getFullYear(), today.getMonth() + 1, 1) };
  }
  if (cadence === "yearly") {
    return { start: new Date(today.getFullYear(), 0, 1), end: new Date(today.getFullYear() + 1, 0, 1) };
  }
  return { start: today, end: addDays(today, 1) };
}

function formatPercent(value: number): string {
  return `${Math.round(clamp01(value) * 100)}%`;
}

function timeLeftLabel(timeRemaining: number, cadence: GoalCadence): string {
  const pct = Math.round(clamp01(timeRemaining) * 100);
  if (cadence === "weekly") return `${pct}% of week left`;
  if (cadence === "monthly") return `${pct}% of month left`;
  return `${pct}% of year left`;
}

function getWindowElapsed(goal: Goal, zmanim: DayZmanim | null, now: Date): number | null {
  const windowInfo = getGoalWindowInfo(goal, zmanim ?? undefined);
  if (!windowInfo) return null;
  let { startTime, endTime } = windowInfo;
  if (!startTime || !endTime) return null;

  startTime = new Date(startTime);
  endTime = new Date(endTime);
  if (windowInfo.wrapsOvernight && endTime <= startTime) {
    if (now < endTime) startTime = shiftDateTime(startTime, -1);
    else endTime = shiftDateTime(endTime, 1);
  }

  const total = endTime.getTime() - startTime.getTime();
  if (total <= 0) return null;
  return clamp01((now.getTime() - startTime.getTime()) / total);
}

function shiftDateTime(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getCompletedAmount(goal: Goal, rollupDone: number): number {
  if (goal.type === "quantified") {
    return Math.max(rollupDone, goal.current ?? 0);
  }
  return Math.max(rollupDone, goal.current && goal.current > 0 ? 1 : 0);
}

function buildDailyPressureItem({
  goal,
  today,
  todayIso,
  assignments,
  excludedByGoal,
  zmanim,
  now,
}: {
  goal: Goal;
  today: Date;
  todayIso: string;
  assignments: DayAssignment[];
  excludedByGoal: Map<string, Set<string>>;
  zmanim: DayZmanim | null;
  now: Date;
}): PressureItem | null {
  const occurrenceIso = getGoalOccurrenceDateForPlannerDate(goal, todayIso, { now, zmanim });
  if (!isGoalApplicableOnDate(goal, occurrenceIso, { excludedByGoal })) return null;
  const doneViaGoal = goal.completedDates?.includes(occurrenceIso) ?? false;
  const doneViaAssignment = assignments.some((entry) => (
    entry.goalId === goal.id &&
    getAssignmentOccurrenceDate(entry) === occurrenceIso &&
    entry.completed
  ));
  if (doneViaGoal || doneViaAssignment) return null;

  const state = getGoalTimeStateForNow(goal, zmanim ?? undefined, true, now);
  const countdown = computeGoalCountdown(goal, zmanim ?? undefined, now, false);
  if (state === "not-yet") return null;

  const windowElapsed = getWindowElapsed(goal, zmanim, now);
  const dayElapsed = (now.getTime() - startOfDay(now).getTime()) / (24 * 60 * 60 * 1000);
  const elapsed = windowElapsed ?? clamp01(dayElapsed);

  if (state === "expired") {
    return {
      goalId: goal.id,
      title: goal.title,
      level: "missed",
      score: 3,
      label: "Missed window",
      detail: countdown?.label ?? "time window expired",
    };
  }

  if (elapsed < 0.7) return null;
  const score = (elapsed - 0.55) / Math.max(1 - elapsed, 0.08);
  return {
    goalId: goal.id,
    title: goal.title,
    level: "soon",
    score,
    label: "Due soon",
    detail: countdown?.label ?? `${formatPercent(elapsed)} of today elapsed`,
  };
}

function buildPeriodPressureItem({
  goal,
  today,
  assignments,
  weekStartsOn,
}: {
  goal: Goal;
  today: Date;
  assignments: DayAssignment[];
  weekStartsOn: 0 | 1;
}): PressureItem | null {
  if (!["weekly", "monthly", "yearly"].includes(goal.cadence)) return null;
  if (goal.status !== "ongoing") return null;
  const todayIso = toIsoDate(today);
  if (goal.startDate && todayIso < goal.startDate) return null;
  if (goal.endDate && todayIso > goal.endDate) return null;

  const { start, end } = getCurrentPeriodBounds(goal.cadence, today, weekStartsOn);
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return null;

  const timeElapsed = clamp01((today.getTime() - start.getTime()) / totalMs);
  if (timeElapsed < 0.12) return null;

  const rollup = computeCrossperiodProgress(goal, goal.cadence, today, assignments, today);
  const target = goal.type === "quantified" ? (goal.target ?? rollup.total) : 1;
  if (!target || target <= 0) return null;

  const completed = getCompletedAmount(goal, rollup.done);
  const progressDone = clamp01(completed / target);
  if (progressDone >= 1) return null;

  const paceGap = timeElapsed - progressDone;
  if (paceGap <= 0.08) return null;

  const timeRemaining = 1 - timeElapsed;
  const pressureScore = paceGap / Math.max(timeRemaining, 0.05);
  if (pressureScore < 0.35 && paceGap < 0.18) return null;

  const level: PressureLevel = "behind";
  return {
    goalId: goal.id,
    title: goal.title,
    level,
    score: pressureScore,
    label: "Behind pace",
    detail: `${formatPercent(progressDone)} done · ${timeLeftLabel(timeRemaining, goal.cadence)}`,
  };
}

function buildBacklogItem(goal: Goal, today: Date): BacklogItem | null {
  if (goal.status !== "ongoing") return null;
  const dailyEntries = getDailyBacklogEntries(goal, today);
  if (dailyEntries.length > 0) {
    return {
      goalId: goal.id,
      title: goal.title,
      amount: dailyEntries.length,
      detail: `${dailyEntries.length} missed ${dailyEntries.length === 1 ? "day" : "days"} to catch up`,
    };
  }
  if (goal.ifUnfinished === "backlog" && goal.backlog && goal.backlog > 0) {
    const unit = goal.targetUnit ?? "units";
    return {
      goalId: goal.id,
      title: goal.title,
      amount: goal.backlog,
      detail: `${goal.backlog} ${unit} carried over`,
    };
  }
  return null;
}

function compareMostAtRisk(a: PressureItem, b: PressureItem): number {
  const levelDiff = PRESSURE_LEVEL_RANK[b.level] - PRESSURE_LEVEL_RANK[a.level];
  if (levelDiff !== 0) return levelDiff;

  const scoreDiff = b.score - a.score;
  if (scoreDiff !== 0) return scoreDiff;

  return a.title.localeCompare(b.title);
}

function usePressureStorage(storageScope: string) {
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

function PressureBadge({ item }: { item: PressureItem }) {
  return (
    <span
      title={item.detail}
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
        item.level === "missed" && "bg-red-50 text-red-600",
        item.level === "soon" && "bg-amber-50 text-amber-700",
        item.level === "behind" && "bg-slate-100 text-slate-500",
      )}
    >
      {item.label}
    </span>
  );
}

function pressureActionLabel(item: PressureItem): string {
  if (item.level === "soon") return "Do next";
  if (item.level === "behind") return "Plan catch-up";
  return "Review";
}

function ClearState({
  unit,
  title,
  detail,
}: {
  unit: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex h-48 flex-col justify-between px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-end gap-1.5">
          <p className="text-3xl font-black leading-none tracking-tight text-slate-900">0</p>
          <p className="pb-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-600">{unit}</p>
        </div>
        <CircleCheck className="h-5 w-5 text-emerald-500" />
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-emerald-50">
        <div className="h-full w-full rounded-full bg-emerald-500" />
      </div>

      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-bold text-emerald-600">
          <span className="truncate">{title}</span>
        </span>
        <p className="truncate text-right text-[10px] font-semibold text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

function CatchUpOverview({ total, firstTitle }: { total: number; firstTitle?: string }) {
  return (
    <div
      className="mb-3 rounded-2xl border border-blue-100 bg-blue-50/45 px-3 py-2"
      title={firstTitle ? `Start with ${firstTitle}` : `${total} carried over`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-end gap-1.5">
          <p className="text-2xl font-black leading-none tracking-tight text-slate-900">{total}</p>
          <p className="pb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-600">owed</p>
        </div>
        <span className="inline-flex max-w-[9rem] items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[9.5px] font-bold text-blue-700">
          <span className="truncate">{firstTitle ? `start: ${firstTitle}` : "catch up"}</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
        </span>
      </div>
    </div>
  );
}

function RiskOverview({
  soonCount,
  behindCount,
  topItem,
}: {
  soonCount: number;
  behindCount: number;
  topItem?: PressureItem | null;
}) {
  const total = soonCount + behindCount;
  const soonPct = total > 0 ? (soonCount / total) * 100 : 0;
  const behindPct = Math.max(0, 100 - soonPct);

  return (
    <div
      className="mb-3 rounded-2xl border border-amber-100 bg-amber-50/35 px-3 py-2"
      title={topItem ? `${topItem.title}: ${topItem.detail}` : `${total} items need attention`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-end gap-1.5">
          <p className="text-2xl font-black leading-none tracking-tight text-slate-900">{total}</p>
          <p className="pb-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-600">watch</p>
        </div>
        <div className="flex gap-1.5">
          {soonCount > 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9.5px] font-bold text-amber-700">
              {soonCount} soon
            </span>
          ) : null}
          {behindCount > 0 ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9.5px] font-bold text-slate-500">
              {behindCount} behind
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-100">
        {soonPct > 0 ? <div className="bg-amber-400" style={{ width: `${soonPct}%` }} /> : null}
        {behindPct > 0 ? <div className="bg-slate-300" style={{ width: `${behindPct}%` }} /> : null}
      </div>
      {topItem ? (
        <p className="mt-1.5 truncate text-[10px] font-semibold text-amber-700">
          First up: {topItem.title}
        </p>
      ) : null}
    </div>
  );
}

export function CatchUpWidget({ storageScope }: { storageScope: string }) {
  const { goals, loaded } = usePressureStorage(storageScope);
  const today = startOfDay(new Date());

  const backlogItems = useMemo(() => {
    return goals
      .map((goal) => buildBacklogItem(goal, today))
      .filter((item): item is BacklogItem => item !== null)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [goals, today]);
  const totalBacklog = backlogItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-slate-700">Catch Up</p>
          {backlogItems.length > 0 ? (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
              {totalBacklog}
            </span>
          ) : null}
        </div>
      </div>

      {!loaded ? (
        <div className="flex h-48 items-center justify-center px-5">
          <p className="text-center text-[11px] font-medium text-slate-300">Checking pace…</p>
        </div>
      ) : backlogItems.length === 0 ? (
        <ClearState unit="owed" title="All caught up" detail="Nothing carried over" />
      ) : (
        <div className="h-48 overflow-y-auto px-4 py-3">
          <CatchUpOverview total={totalBacklog} firstTitle={backlogItems[0]?.title} />
          <div className="space-y-2">
            {backlogItems.map((item) => (
              <div
                key={item.goalId}
                title={item.detail}
                className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/40 px-3 py-2.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100/80">
                  <Clock3 className="h-4 w-4 text-blue-600" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                    <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      {item.amount} owed
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AtRiskWidget({ storageScope }: { storageScope: string }) {
  const { goals, assignments, loaded } = usePressureStorage(storageScope);
  const { preferences } = useCalendarPreferences(undefined, storageScope);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const today = startOfDay(now);
  const todayIso = toIsoDate(today);

  const todayZmanim = useMemo(() => {
    const location = resolveLocation(preferences);
    if (!location) return null;
    return computeDayZmanim(today, location, preferences.timeFormat);
  }, [preferences, today]);

  const excludedByGoal = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const rangeStart = startOfWeek(today, preferences.weekStartsOn);
    const rangeEnd = endOfWeek(today, preferences.weekStartsOn);
    for (const goal of goals) {
      if (!goal.excludes?.categories?.length && !goal.excludes?.individual?.length) continue;
      map.set(
        goal.id,
        buildExcludedDates(rangeStart, rangeEnd, goal.excludes?.categories ?? [], goal.excludes?.individual ?? []),
      );
    }
    return map;
  }, [goals, preferences.weekStartsOn, today]);

  const pressureItems = useMemo(() => {
    return goals
      .filter((goal) => !goal.adhoc && goal.status === "ongoing")
      .map((goal) =>
        goal.cadence === "daily"
          ? buildDailyPressureItem({ goal, today, todayIso, assignments, excludedByGoal, zmanim: todayZmanim, now })
          : buildPeriodPressureItem({ goal, today, assignments, weekStartsOn: preferences.weekStartsOn }),
      )
      .filter((item): item is PressureItem => item !== null && item.level !== "missed")
      .sort(compareMostAtRisk)
      .slice(0, 5);
  }, [assignments, excludedByGoal, goals, now, preferences.weekStartsOn, today, todayIso, todayZmanim]);
  const soonCount = pressureItems.filter((item) => item.level === "soon").length;
  const behindCount = pressureItems.filter((item) => item.level === "behind").length;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-slate-700">At Risk</p>
          {pressureItems.length > 0 ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {pressureItems.length}
            </span>
          ) : null}
        </div>
      </div>

      {!loaded ? (
        <div className="flex h-48 items-center justify-center px-5">
          <p className="text-center text-[11px] font-medium text-slate-300">Checking pace…</p>
        </div>
      ) : pressureItems.length === 0 ? (
        <ClearState unit="watch" title="All steady" detail="Nothing at risk right now" />
      ) : (
        <div className="h-48 overflow-y-auto px-4 py-3">
          <RiskOverview soonCount={soonCount} behindCount={behindCount} topItem={pressureItems[0] ?? null} />
          <div className="space-y-2">
            {pressureItems.map((item) => (
              <div
                key={item.goalId}
                title={`${item.title}: ${item.detail}`}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-3 py-2.5",
                  item.level === "soon"
                    ? "border-amber-100 bg-amber-50/25"
                    : "border-slate-100 bg-slate-50/70",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    item.level === "soon" ? "bg-amber-100/80" : "bg-slate-100",
                  )}
                >
                  <AlertTriangle
                    className={cn(
                      "h-4 w-4",
                      item.level === "soon" ? "text-amber-600" : "text-slate-400",
                    )}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                    <PressureBadge item={item} />
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">{item.detail}</p>
                </div>
                <span
                  className={cn(
                    "hidden shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold sm:inline-flex",
                    item.level === "soon" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {pressureActionLabel(item)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
