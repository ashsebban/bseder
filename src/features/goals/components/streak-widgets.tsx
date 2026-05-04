"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Flame } from "lucide-react";
import { addDays, parseIsoDate, startOfDay, toIsoDate } from "@/lib/date";
import { DAY_KEYS } from "@/features/goals/lib/goal-applicability";
import {
  GOALS_STORAGE_UPDATED_EVENT,
  loadGoals,
  type GoalsStorageUpdatedDetail,
} from "@/features/goals/lib/goal-store";
import {
  computeActiveGoalStreaks,
  computeBestStreak,
  type GoalStreakSummary,
} from "@/features/goals/lib/goal-progress";
import type { Goal } from "@/features/goals/types/goal";

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function formatShortDate(isoDate?: string): string | null {
  if (!isoDate) return null;
  const date = parseIsoDate(isoDate);
  return date ? shortDateFormatter.format(date) : null;
}

function useGoalsSnapshot(storageScope: string) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!storageScope) {
      setGoals([]);
      setLoaded(true);
      return;
    }

    setGoals(loadGoals(storageScope));
    setLoaded(true);

    function handleGoalsUpdated(event: Event) {
      const detail = (event as CustomEvent<GoalsStorageUpdatedDetail>).detail;
      if (!detail || detail.storageScope !== storageScope) return;
      setGoals(detail.goals);
    }

    function handleStorage() {
      setGoals(loadGoals(storageScope));
    }

    window.addEventListener(GOALS_STORAGE_UPDATED_EVENT, handleGoalsUpdated as EventListener);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(GOALS_STORAGE_UPDATED_EVENT, handleGoalsUpdated as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, [storageScope]);

  return { goals, loaded };
}

function WidgetFrame({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-semibold text-slate-700">{title}</p>
          {meta}
        </div>
      </div>
      {children}
    </div>
  );
}

function StreakChip({ streak }: { streak: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-sm font-bold text-orange-600"
      title={`${streak} day active streak`}
    >
      <Flame className="h-3.5 w-3.5 fill-orange-500/20 text-orange-500" />
      {streak}d
    </span>
  );
}

function EmptyState({
  message,
  height,
}: {
  message: string;
  height: string;
}) {
  return (
    <div className={`flex items-center justify-center px-5 ${height}`}>
      <p className="text-center text-[11px] font-medium text-slate-300">{message}</p>
    </div>
  );
}

function StreakMeta({ streak }: { streak: GoalStreakSummary }) {
  const lastCompletedLabel = formatShortDate(streak.lastCompletedDate);
  return (
    <p className="text-xs text-slate-500">
      {lastCompletedLabel ? `Last completed ${lastCompletedLabel}` : "Current run is still active"}
    </p>
  );
}

function StreakHistoryStrip({ goal, today }: { goal: Goal; today: Date }) {
  const completedDates = new Set(goal.completedDates ?? []);
  const activeDays = goal.activeDays ?? [...DAY_KEYS];
  const days = Array.from({ length: 14 }, (_, index) => addDays(today, index - 13));

  return (
    <div className="flex h-2 gap-1">
      {days.map((date) => {
        const isoDate = toIsoDate(date);
        const active = activeDays.includes(DAY_KEYS[date.getDay()]);
        const completed = completedDates.has(isoDate);
        const dateLabel = formatShortDate(isoDate) ?? isoDate;
        return (
          <div
            key={isoDate}
            title={`${dateLabel}: ${completed ? "completed" : active ? "scheduled" : "rest day"}`}
            className={
              completed
                ? "h-2 flex-1 rounded-full bg-orange-400"
                : active
                  ? "h-2 flex-1 rounded-full bg-slate-200"
                  : "h-2 flex-1 rounded-full bg-slate-100"
            }
          />
        );
      })}
    </div>
  );
}

function StreakStatChip({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span className={`inline-flex min-w-0 items-center rounded-full px-2 py-0.5 text-[9.5px] font-bold ${className}`}>
      <span className="truncate">{label}</span>
    </span>
  );
}

export function BestStreakWidget({ storageScope }: { storageScope: string }) {
  const { goals, loaded } = useGoalsSnapshot(storageScope);
  const today = startOfDay(new Date());
  const bestStreak = computeBestStreak(goals, today);
  const bestGoal = bestStreak ? goals.find((goal) => goal.id === bestStreak.goalId) ?? null : null;
  const lastCompletedLabel = bestStreak ? formatShortDate(bestStreak.lastCompletedDate) : null;

  return (
    <WidgetFrame title="Best Streak">
      {!loaded ? (
        <EmptyState message="Loading streaks…" height="h-24" />
      ) : !bestStreak ? (
        <EmptyState message="No active streaks yet" height="h-24" />
      ) : (
        <div className="flex h-24 flex-col justify-between px-5 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-end gap-1.5">
              <Flame className="mb-0.5 h-6 w-6 fill-orange-500/15 text-orange-500" />
              <p className="text-3xl font-black leading-none tracking-tight text-slate-900">{bestStreak.currentStreak}</p>
              <p className="pb-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-orange-600">days</p>
            </div>
            <div className="min-w-0 text-right">
              <p className="truncate text-[12px] font-bold text-slate-700">{bestStreak.title}</p>
              <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">
                {lastCompletedLabel ? `Last ${lastCompletedLabel}` : "Still active"}
              </p>
            </div>
          </div>

          {bestGoal ? <StreakHistoryStrip goal={bestGoal} today={today} /> : <div className="h-2 rounded-full bg-slate-100" />}

          <div className="flex min-w-0 gap-1.5 overflow-hidden">
            <StreakStatChip label="current run" className="bg-orange-50 text-orange-600" />
            {lastCompletedLabel ? (
              <StreakStatChip label={`last ${lastCompletedLabel}`} className="bg-slate-100 text-slate-500" />
            ) : null}
          </div>
        </div>
      )}
    </WidgetFrame>
  );
}

export function ActiveStreaksWidget({ storageScope }: { storageScope: string }) {
  const { goals, loaded } = useGoalsSnapshot(storageScope);
  const today = startOfDay(new Date());
  const streaks = computeActiveGoalStreaks(goals, today);
  const goalsById = new Map(goals.map((goal) => [goal.id, goal]));

  return (
    <WidgetFrame
      title="Streaks"
      meta={streaks.length > 0 ? (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold tabular-nums text-orange-700"
          title={`${streaks.length} active streak${streaks.length === 1 ? "" : "s"}`}
        >
          <Flame className="h-3 w-3 fill-orange-500/15 text-orange-500" />
          {streaks.length}
        </span>
      ) : undefined}
    >
      {!loaded ? (
        <EmptyState message="Loading streaks…" height="h-48" />
      ) : streaks.length === 0 ? (
        <EmptyState message="No active streaks yet" height="h-48" />
      ) : (
        <div className="h-48 overflow-y-auto px-4 py-3">
          <div className="space-y-2">
            {streaks.map((streak) => (
              <div
                key={streak.goalId}
                className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 transition hover:border-orange-100 hover:bg-orange-50/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{streak.title}</p>
                    <StreakMeta streak={streak} />
                  </div>
                  <StreakChip streak={streak.currentStreak} />
                </div>
                {goalsById.get(streak.goalId) ? (
                  <div className="mt-2">
                    <StreakHistoryStrip goal={goalsById.get(streak.goalId)!} today={today} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </WidgetFrame>
  );
}
