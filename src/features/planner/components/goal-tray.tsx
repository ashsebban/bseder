"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/cn";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, toIsoDate } from "@/features/calendar/lib/date";
import type { Goal, GoalCadence } from "@/features/goals/types/goal";
import type { DayAssignment } from "@/features/planner/lib/day-assignment-store";
import { computePeriodKey } from "@/features/planner/lib/period-key";
import { computeRollupProgress, computeCrossperiodProgress } from "@/features/goals/lib/goal-progress";

type TrayFilter = "all" | "hide-done" | "hide-allocated";
type TrayView = "week" | "month";

interface GoalTrayProps {
  goals: Goal[];
  dayAssignments: DayAssignment[];
  selectedDate: Date;
  view: TrayView;
  weekStartsOn?: 0 | 1;
}

const COLUMNS: { cadence: GoalCadence; label: string }[] = [
  { cadence: "daily", label: "Daily" },
  { cadence: "weekly", label: "Weekly" },
  { cadence: "monthly", label: "Monthly" },
  { cadence: "yearly", label: "Yearly" },
  { cadence: "one-time", label: "One-time" },
];

const PAGE_SIZE = 2;

/** Returns only the assignments that belong to the goal's current period.
 *  Prefers periodKey-based filtering (accurate after moves) with date-range fallback for legacy data. */
function getAssignmentsForPeriod(
  assignments: DayAssignment[],
  goalId: string,
  cadence: GoalCadence,
  selectedDate: Date,
  weekStartsOn: 0 | 1 = 0,
): DayAssignment[] {
  const relevant = assignments.filter((a) => a.goalId === goalId);
  const periodKey = computePeriodKey(cadence, selectedDate);

  if (periodKey && relevant.some((a) => a.periodKey !== undefined)) {
    return relevant.filter((a) => a.periodKey === periodKey || a.periodKey === undefined);
  }

  switch (cadence) {
    case "weekly": {
      const start = toIsoDate(startOfWeek(selectedDate, weekStartsOn));
      const end = toIsoDate(endOfWeek(selectedDate, weekStartsOn));
      return relevant.filter((a) => a.date >= start && a.date <= end);
    }
    case "monthly": {
      const start = toIsoDate(startOfMonth(selectedDate));
      const end = toIsoDate(endOfMonth(selectedDate));
      return relevant.filter((a) => a.date >= start && a.date <= end);
    }
    case "yearly": {
      const year = selectedDate.getFullYear().toString();
      return relevant.filter((a) => a.date.startsWith(`${year}-`));
    }
    default:
      return relevant;
  }
}

function GoalPill({
  goal,
  plannedCount,
  completedCount,
  missedCount = 0,
  periodLabel,
  draggable = true,
  overrideTarget,
  overrideUnit,
}: {
  goal: Goal;
  plannedCount: number;
  completedCount: number;
  missedCount?: number;
  periodLabel?: string;
  draggable?: boolean;
  overrideTarget?: number;
  overrideUnit?: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: goal.id,
    disabled: !draggable,
  });

  const dragStyle = transform && draggable
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(1.5deg) scale(1.04)`,
        zIndex: 999,
      }
    : undefined;

  const effectiveTarget = overrideTarget ?? (goal.target ?? (goal.type === "binary" ? 1 : 0));
  const hasTarget = effectiveTarget > 0;
  const target = effectiveTarget;
  const unit = overrideUnit ?? (goal.targetUnit ? ` ${goal.targetUnit}` : "");

  const allDone = hasTarget && completedCount >= target;
  const overagePlanned = hasTarget && plannedCount > target;

  const completedPct = hasTarget ? Math.min(100, (completedCount / target) * 100) : 0;
  const missedPct = hasTarget ? Math.min(100 - completedPct, (missedCount / target) * 100) : 0;
  const pendingPct = hasTarget
    ? Math.min(100 - completedPct - missedPct, (Math.max(0, plannedCount - completedCount - missedCount) / target) * 100)
    : plannedCount > 0 ? 100 : 0;

  let line2 = "";
  if (allDone) {
    line2 = `${completedCount}/${target}${unit} · all done`;
  } else if (missedCount > 0 && completedCount === 0) {
    line2 = `${missedCount} missed · 0/${hasTarget ? target : "?"}${unit}`;
  } else if (missedCount > 0) {
    line2 = `${completedCount} done · ${missedCount} missed`;
  } else if (completedCount > 0) {
    // When planned = target (fully scheduled), the X/X fraction is redundant — show done/total directly
    line2 = plannedCount >= target
      ? `${completedCount}/${target}${unit}`
      : `${completedCount} done · ${plannedCount}/${hasTarget ? target : "?"}${unit}`;
  } else if (plannedCount > 0) {
    const suffix = overagePlanned ? ` · +${plannedCount - target} ahead` : "";
    line2 = `${plannedCount}/${hasTarget ? target : "?"}${unit} planned${suffix}`;
  } else if (hasTarget) {
    line2 = `0/${target}${unit}`;
  }

  const stripeClass = allDone
    ? "bg-success"
    : missedCount > 0
    ? "bg-penalty"
    : completedCount > 0
    ? "bg-brand"
    : plannedCount > 0
    ? "bg-planned"
    : "bg-slate-200";

  return (
    <div
      ref={draggable ? setNodeRef : undefined}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      style={dragStyle}
      className={cn(
        "group flex select-none touch-none overflow-hidden rounded-lg border border-slate-200 bg-white transition-shadow",
        draggable
          ? "cursor-grab active:cursor-grabbing hover:shadow-md hover:border-brand/30"
          : "cursor-default",
        isDragging ? "shadow-2xl ring-1 ring-slate-900/[0.08]" : "shadow-sm",
      )}
    >
      <div className={cn("w-1 shrink-0 transition-colors duration-300", stripeClass)} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-2.5 pt-1.5 pb-1.5">
        <p className="truncate text-[12px] font-semibold leading-snug text-slate-800">
          {goal.title}
          {periodLabel && (
            <span className="ml-1 font-normal text-slate-400">({periodLabel})</span>
          )}
        </p>
        <p className="truncate text-[10px] font-medium leading-tight text-slate-500">
          {line2 || "\u00A0"}
        </p>
        <div className="mt-0.5 h-[5px] w-full overflow-hidden rounded-full bg-slate-100">
          <div className="flex h-full">
            <div className={cn("h-full transition-all duration-300", allDone ? "bg-success" : "bg-brand")} style={{ width: `${completedPct}%` }} />
            {missedPct > 0 && (
              <div className="h-full bg-penalty transition-all duration-300" style={{ width: `${missedPct}%` }} />
            )}
            <div className="h-full bg-planned transition-all duration-300" style={{ width: `${pendingPct}%` }} />
          </div>
        </div>
      </div>
      {draggable && (
        <div className="flex shrink-0 items-center px-1.5 text-slate-300 group-hover:text-slate-400 transition-colors">
          <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
            <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
            <circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/>
            <circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/>
          </svg>
        </div>
      )}
    </div>
  );
}

function GoalColumn({
  cadence,
  label,
  goals,
  dayAssignments,
  selectedDate,
  filter,
  view,
  weekStartsOn = 0,
}: {
  cadence: GoalCadence;
  label: string;
  goals: Goal[];
  dayAssignments: DayAssignment[];
  selectedDate: Date;
  filter: TrayFilter;
  view: TrayView;
  weekStartsOn?: 0 | 1;
}) {
  const [offset, setOffset] = useState(0);

  const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function getGoalCounts(goal: Goal): {
    planned: number;
    completed: number;
    missed: number;
    overrideTarget?: number;
    overrideUnit?: string;
  } {
    // ── Daily: use computeRollupProgress for the relevant period ──
    if (goal.cadence === "daily") {
      const today = new Date();
      let periodStart: Date;
      let periodEnd: Date;
      if (view === "month") {
        periodStart = startOfMonth(selectedDate);
        periodEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1);
      } else {
        periodStart = startOfWeek(selectedDate, weekStartsOn);
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodStart.getDate() + 7);
      }
      const rollup = computeRollupProgress(goal, periodStart, periodEnd, today, dayAssignments);
      return {
        planned: rollup.total,
        completed: rollup.done,
        missed: rollup.missed,
        overrideTarget: rollup.total,
        overrideUnit: " days",
      };
    }

    // ── Weekly goals in monthly view: use canonical cross-period computation ──
    if (goal.cadence === "weekly" && view === "month") {
      const result = computeCrossperiodProgress(goal, "monthly", new Date(), dayAssignments, selectedDate);
      return {
        planned: result.total,
        completed: result.done,
        missed: 0,
        overrideTarget: result.total,
      };
    }

    // ── Auto-scheduled weekly goals in weekly view ──
    const isAutoScheduled = goal.cadence === "weekly" && goal.activeDays && goal.activeDays.length > 0;

    if (isAutoScheduled) {
      const assigned = getAssignmentsForPeriod(dayAssignments, goal.id, cadence, selectedDate, weekStartsOn);
      const replacedPreferredDays = new Set(
        assigned.filter((a) => a.replacedAutoDate).map((a) => a.replacedAutoDate!),
      );
      const manualPlanned = assigned.reduce((s, a) => s + (a.targetAmount ?? 1), 0);
      const manualCompleted = assigned.filter((a) => a.completed).reduce((s, a) => s + (a.targetAmount ?? 1), 0);

      const weekStart = startOfWeek(selectedDate, weekStartsOn);
      let autoPlanned = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const iso = toIsoDate(d);
        const dayKey = DAY_KEYS[d.getDay()];
        if (
          goal.activeDays!.includes(dayKey) &&
          (!goal.startDate || iso >= goal.startDate) &&
          !replacedPreferredDays.has(iso) &&
          !assigned.some((a) => a.date === iso)
        ) {
          autoPlanned++;
        }
      }

      const manualDates = new Set(assigned.map((a) => a.date));
      const weekStartIso = toIsoDate(startOfWeek(selectedDate, weekStartsOn));
      const weekEndIso = toIsoDate(endOfWeek(selectedDate, weekStartsOn));
      const autoCompleted = (goal.completedDates ?? []).filter((d) => {
        if (d < weekStartIso || d > weekEndIso) return false;
        const dayObj = new Date(d + "T00:00:00");
        const dayKey = DAY_KEYS[dayObj.getDay()];
        return (
          goal.activeDays!.includes(dayKey) &&
          (!goal.startDate || d >= goal.startDate) &&
          !replacedPreferredDays.has(d) &&
          !manualDates.has(d)
        );
      }).length;

      return { planned: manualPlanned + autoPlanned, completed: manualCompleted + autoCompleted, missed: 0 };
    }

    // ── All other goals: period-scoped assignments ──
    const assigned = getAssignmentsForPeriod(dayAssignments, goal.id, cadence, selectedDate, weekStartsOn);
    return {
      planned: assigned.reduce((s, a) => s + (a.targetAmount ?? 1), 0),
      completed: assigned.filter((a) => a.completed).reduce((s, a) => s + (a.targetAmount ?? 1), 0),
      missed: 0,
    };
  }

  function getPeriodLabel(goal: Goal): string | undefined {
    if (goal.cadence === "monthly") {
      return selectedDate.toLocaleString("en-US", { month: "long" });
    }
    if ((goal.cadence === "weekly" || goal.cadence === "daily") && view === "month") {
      return selectedDate.toLocaleString("en-US", { month: "long" });
    }
    return undefined;
  }

  const periodEnd = view === "month" ? toIsoDate(endOfMonth(selectedDate)) : toIsoDate(endOfWeek(selectedDate, weekStartsOn));

  const colGoals = goals
    .filter((g) => g.cadence === cadence)
    .filter((g) => !g.startDate || g.startDate <= periodEnd)
    .filter((g) => {
      if (filter === "all") return true;
      const counts = getGoalCounts(g);
      const resolvedTarget = counts.overrideTarget ?? (g.target ?? (g.type === "binary" ? 1 : 0));
      // Daily goals are always "allocated" by schedule — skip hide-allocated for them
      if (filter === "hide-allocated" && g.cadence === "daily") return true;
      if (filter === "hide-done" && resolvedTarget > 0 && counts.completed >= resolvedTarget) return false;
      if (filter === "hide-allocated" && resolvedTarget > 0 && counts.planned >= resolvedTarget) return false;
      return true;
    });

  const visibleGoals = colGoals.slice(offset, offset + PAGE_SIZE);
  const canUp = offset > 0;
  const canDown = offset + PAGE_SIZE < colGoals.length;

  return (
    <div className="flex flex-col">
      <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
        {label}
        {colGoals.length > 0 && (
          <span className="rounded-full bg-slate-100 px-1.5 py-[1px] text-[9px] font-bold tabular-nums text-slate-400">
            {colGoals.length}
          </span>
        )}
      </p>
      {colGoals.length === 0 ? (
        <p className="text-[11px] text-slate-300">—</p>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            className={cn(
              "flex w-full justify-center text-slate-400 hover:text-slate-600 transition-colors",
              !canUp && "invisible pointer-events-none",
            )}
          >
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {visibleGoals.map((goal) => {
            const counts = getGoalCounts(goal);
            return (
              <GoalPill
                key={goal.id}
                goal={goal}
                plannedCount={counts.planned}
                completedCount={counts.completed}
                missedCount={counts.missed}
                periodLabel={getPeriodLabel(goal)}
                draggable={goal.cadence !== "daily"}
                overrideTarget={counts.overrideTarget}
                overrideUnit={counts.overrideUnit}
              />
            );
          })}

          <button
            type="button"
            onClick={() => setOffset((o) => o + 1)}
            className={cn(
              "flex w-full justify-center text-slate-400 hover:text-slate-600 transition-colors",
              !canDown && "invisible pointer-events-none",
            )}
          >
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

const FILTER_OPTIONS: { value: TrayFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "hide-done", label: "Hide done" },
  { value: "hide-allocated", label: "Hide allocated" },
];

export function GoalTray({ goals, dayAssignments, selectedDate, view, weekStartsOn = 0 }: GoalTrayProps) {
  const [filter, setFilter] = useState<TrayFilter>("all");

  const libraryGoals = goals.filter(
    (g) => !g.adhoc && g.status !== "paused" && g.status !== "done",
  );

  if (libraryGoals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3">
        <p className="text-[12px] text-slate-400">
          No goals yet.{" "}
          <a href="/goals" className="text-brand/70 underline-offset-2 hover:underline">
            Add goals
          </a>{" "}
          to plan your week.
        </p>
      </div>
    );
  }

  const activeColumns = COLUMNS.filter(({ cadence }) =>
    libraryGoals.some((g) => g.cadence === cadence),
  );

  return (
    <div>
      {/* Header row: filter chips flush right */}
      <div className="mb-2.5 flex items-center gap-1.5">
        <span className="mr-auto text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Show
        </span>
        {FILTER_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors",
              filter === value
                ? "bg-brand text-white"
                : "border border-slate-200 bg-white text-slate-400 hover:text-slate-600",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${activeColumns.length}, minmax(0, 1fr))` }}
      >
        {activeColumns.map(({ cadence, label }) => (
          <GoalColumn
            key={cadence}
            cadence={cadence}
            label={label}
            goals={libraryGoals}
            dayAssignments={dayAssignments}
            selectedDate={selectedDate}
            filter={filter}
            view={view}
            weekStartsOn={weekStartsOn}
          />
        ))}
      </div>
    </div>
  );
}
