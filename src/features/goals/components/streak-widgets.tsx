"use client";

import { useEffect, useState, type ReactNode } from "react";
import { parseIsoDate, startOfDay } from "@/lib/date";
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
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-[13px] font-semibold text-slate-700">{title}</p>
      </div>
      {children}
    </div>
  );
}

function StreakChip({ streak }: { streak: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-600">
      🔥 {streak}
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

export function BestStreakWidget({ storageScope }: { storageScope: string }) {
  const { goals, loaded } = useGoalsSnapshot(storageScope);
  const today = startOfDay(new Date());
  const bestStreak = computeBestStreak(goals, today);

  return (
    <WidgetFrame title="Best Streak">
      {!loaded ? (
        <EmptyState message="Loading streaks…" height="h-24" />
      ) : !bestStreak ? (
        <EmptyState message="No active streaks yet" height="h-24" />
      ) : (
        <div className="flex h-24 items-center justify-between gap-4 px-5">
          <div className="flex items-end gap-2">
            <p className="text-4xl font-bold tracking-tight text-slate-900">{bestStreak.currentStreak}</p>
            <p className="pb-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-600">days</p>
          </div>
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-semibold text-slate-900">{bestStreak.title}</p>
            <StreakMeta streak={bestStreak} />
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

  return (
    <WidgetFrame title="Streaks">
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
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{streak.title}</p>
                  <StreakMeta streak={streak} />
                </div>
                <StreakChip streak={streak.currentStreak} />
              </div>
            ))}
          </div>
        </div>
      )}
    </WidgetFrame>
  );
}
