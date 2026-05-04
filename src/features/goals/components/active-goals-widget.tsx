"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildActiveGoalsSummary,
  type ActiveGoalCadenceSummary,
  type ActiveGoalsSummary,
} from "@/features/goals/lib/active-goals-summary";
import {
  GOALS_STORAGE_UPDATED_EVENT,
  loadGoals,
  type GoalsStorageUpdatedDetail,
} from "@/features/goals/lib/goal-store";
import type { Goal, GoalCadence } from "@/features/goals/types/goal";
import { startOfDay } from "@/lib/date";
import { cn } from "@/lib/cn";

const CADENCE_COLOR_CLASSES: Record<GoalCadence, { bar: string; chip: string; text: string }> = {
  daily: {
    bar: "bg-brand/70",
    chip: "bg-brand/[0.08]",
    text: "text-brand",
  },
  weekly: {
    bar: "bg-sky-300",
    chip: "bg-sky-50",
    text: "text-sky-700",
  },
  monthly: {
    bar: "bg-indigo-300",
    chip: "bg-indigo-50",
    text: "text-indigo-600",
  },
  yearly: {
    bar: "bg-violet-300",
    chip: "bg-violet-50",
    text: "text-violet-600",
  },
  seasonal: {
    bar: "bg-emerald-300",
    chip: "bg-emerald-50",
    text: "text-emerald-700",
  },
  project: {
    bar: "bg-slate-400",
    chip: "bg-slate-100",
    text: "text-slate-700",
  },
  "one-time": {
    bar: "bg-slate-300",
    chip: "bg-slate-100",
    text: "text-slate-600",
  },
};

const CADENCE_NOUNS: Record<GoalCadence, [string, string]> = {
  daily: ["daily", "daily"],
  weekly: ["weekly", "weekly"],
  monthly: ["monthly", "monthly"],
  yearly: ["yearly", "yearly"],
  seasonal: ["seasonal", "seasonal"],
  project: ["project", "projects"],
  "one-time": ["project", "projects"],
};

function useActiveGoalsStorage(storageScope: string) {
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-24 items-center justify-center px-5">
      <p className="text-center text-[11px] font-medium text-slate-300">{message}</p>
    </div>
  );
}

function formatCadenceCount(item: ActiveGoalCadenceSummary): string {
  const [singular, plural] = CADENCE_NOUNS[item.cadence];
  return `${item.count} ${item.count === 1 ? singular : plural}`;
}

function formatCadencePercent(item: ActiveGoalCadenceSummary, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((item.count / total) * 100)}%`;
}

function statusLabel(summary: ActiveGoalsSummary): string {
  const parts: string[] = [];
  if (summary.queued > 0) parts.push(`${summary.queued} queued`);
  if (summary.paused > 0) parts.push(`${summary.paused} paused`);
  return parts.length > 0 ? parts.join(", ") : "All current";
}

function CadenceBar({ summary }: { summary: ActiveGoalsSummary }) {
  if (summary.active === 0) {
    return <div className="h-2 rounded-full bg-slate-100" />;
  }

  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
      {summary.cadenceBreakdown
        .filter((item) => item.count > 0)
        .map((item) => (
          <div
            key={item.cadence}
            title={`${formatCadenceCount(item)} · ${formatCadencePercent(item, summary.active)} of live goals`}
            className={cn("transition-opacity hover:opacity-80", CADENCE_COLOR_CLASSES[item.cadence].bar)}
            style={{ width: `${(item.count / summary.active) * 100}%` }}
          />
        ))}
    </div>
  );
}

function CadenceChip({ item, total }: { item: ActiveGoalCadenceSummary; total: number }) {
  const colors = CADENCE_COLOR_CLASSES[item.cadence];
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center rounded-full px-2 py-0.5 text-[9.5px] font-bold transition ring-1 ring-transparent hover:ring-current/10",
        colors.chip,
        colors.text,
      )}
      title={`${formatCadenceCount(item)} · ${formatCadencePercent(item, total)} of live goals`}
    >
      <span className="truncate">{formatCadenceCount(item)}</span>
    </span>
  );
}

function StatusChip({
  label,
  className,
  title,
}: {
  label: string;
  className: string;
  title: string;
}) {
  return (
    <span
      title={title}
      className={cn("inline-flex min-w-0 items-center rounded-full px-2 py-0.5 text-[9.5px] font-bold", className)}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

export function ActiveGoalsWidget({ storageScope }: { storageScope: string }) {
  const { goals, loaded } = useActiveGoalsStorage(storageScope);
  const [now, setNow] = useState(() => new Date());
  const today = useMemo(() => startOfDay(now), [now]);
  const summary = useMemo(() => buildActiveGoalsSummary(goals, today), [goals, today]);
  const topCadences = summary.cadenceBreakdown.filter((item) => item.count > 0).slice(0, 3);
  const primaryCadence = topCadences[0] ?? null;

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-[13px] font-semibold text-slate-700">Active Goals</p>
      </div>

      {!loaded ? (
        <EmptyState message="Loading goals..." />
      ) : summary.active === 0 && summary.queued === 0 && summary.paused === 0 ? (
        <EmptyState message="No active goals yet" />
      ) : (
        <div className="flex h-24 flex-col justify-between px-5 py-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-end gap-1.5">
              <p className="text-3xl font-black leading-none tracking-tight text-slate-900">{summary.active}</p>
              <p className="pb-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">live</p>
            </div>
            <div className="min-w-0 text-right">
              <p className="truncate text-[12px] font-bold text-slate-700">
                {primaryCadence ? formatCadenceCount(primaryCadence) : "No live goals"}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400" title={statusLabel(summary)}>
                {statusLabel(summary)}
              </p>
            </div>
          </div>

          <CadenceBar summary={summary} />

          <div className="flex min-w-0 gap-1.5 overflow-hidden">
            {topCadences.length > 0 ? (
              topCadences.map((item) => <CadenceChip key={item.cadence} item={item} total={summary.active} />)
            ) : (
              <span className="truncate text-[10px] font-semibold text-slate-300">Nothing live today</span>
            )}
            {summary.queued > 0 ? (
              <StatusChip
                label={`${summary.queued} queued`}
                title={`${summary.queued} goal${summary.queued === 1 ? "" : "s"} scheduled to start later`}
                className="bg-slate-100 text-slate-500"
              />
            ) : null}
            {summary.paused > 0 ? (
              <StatusChip
                label={`${summary.paused} paused`}
                title={`${summary.paused} paused goal${summary.paused === 1 ? "" : "s"}`}
                className="bg-orange-50 text-orange-600"
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
