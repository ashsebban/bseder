"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/cn";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, toIsoDate } from "@/lib/date";
import { DailyBacklogBadge } from "@/features/planner/components/daily-backlog-badge";
import { EditableGoalTitle, GoalRowGripIcon } from "@/features/calendar/components/goal-list-row";
import type { Goal, GoalCadence } from "@/features/goals/types/goal";
import type { DayAssignment } from "@/features/planner/lib/day-assignment-store";
import { computePeriodKey } from "@/features/planner/lib/period-key";
import { computeRollupProgress, computeCrossperiodProgress, computeDailyQuantifiedUnitsRollup } from "@/features/goals/lib/goal-progress";
import { isPrebuiltGoal } from "@/features/goals/lib/prebuilt-goals";
import { SegmentedProgressBar } from "@/features/planner/components/segmented-progress-bar";
import { getDailyBacklogEntries } from "@/features/goals/lib/daily-backlog";
import { getGoalProgramLabel } from "@/features/goals/lib/goal-programs";
import { DAY_KEYS } from "@/features/goals/lib/goal-applicability";
import { getAssignmentOccurrenceDate } from "@/features/calendar/lib/goal-day";

type TrayFilter = "all" | "hide-done" | "hide-allocated";
type TrayView = "week" | "month";

interface GoalTrayProps {
  goals: Goal[];
  dayAssignments: DayAssignment[];
  selectedDate: Date;
  view: TrayView;
  weekStartsOn?: 0 | 1;
  filter?: TrayFilter;
  pageSize?: number;
  onRenameGoal: (goalId: string, nextTitle: string) => void;
  onToggleDate: (goalId: string, isoDate: string) => void;
}

const COLUMNS: { cadence: GoalCadence; label: string }[] = [
  { cadence: "daily", label: "Daily" },
  { cadence: "weekly", label: "Weekly" },
  { cadence: "monthly", label: "Monthly" },
  { cadence: "yearly", label: "Yearly" },
  { cadence: "one-time", label: "One-time" },
];

function isGoalVisibleInCalendarMenu(goal: Goal, selectedIso: string, todayIsoStr = toIsoDate(new Date())): boolean {
  if (goal.adhoc || goal.status === "paused" || goal.status === "done") return false;
  if (!goal.endDate) return true;
  if (goal.startDate && todayIsoStr < goal.startDate) return false;
  if (todayIsoStr > goal.endDate) return false;
  if (goal.startDate && selectedIso < goal.startDate) return false;
  if (selectedIso > goal.endDate) return false;
  return true;
}


function computeGoalStatusLabel({
  plannedCount,
  completedCount,
  missedCount,
  target,
  unit,
}: {
  plannedCount: number;
  completedCount: number;
  missedCount: number;
  target: number;
  unit: string;
}): string {
  const hasTarget = target > 0;
  const targetLabel = hasTarget ? target : "?";

  if (hasTarget && completedCount >= target) {
    return `${completedCount}/${target}${unit} · all done`;
  }
  if (missedCount > 0 && completedCount === 0) {
    return `${missedCount} missed · 0/${targetLabel}${unit}`;
  }
  if (missedCount > 0) {
    return `${completedCount} done · ${missedCount} missed`;
  }
  if (completedCount > 0) {
    return plannedCount >= target
      ? `${completedCount}/${target}${unit}`
      : `${completedCount} done · ${plannedCount}/${targetLabel}${unit}`;
  }
  if (plannedCount > 0) {
    const suffix = hasTarget && plannedCount > target ? ` · +${plannedCount - target} ahead` : "";
    return `${plannedCount}/${targetLabel}${unit} planned${suffix}`;
  }
  if (hasTarget) {
    return `0/${target}${unit}`;
  }
  return "";
}

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
  const isInSelectedDateRange = (assignment: DayAssignment): boolean => {
    const occurrenceDate = getAssignmentOccurrenceDate(assignment);
    switch (cadence) {
      case "weekly": {
        const start = toIsoDate(startOfWeek(selectedDate, weekStartsOn));
        const end = toIsoDate(endOfWeek(selectedDate, weekStartsOn));
        return occurrenceDate >= start && occurrenceDate <= end;
      }
      case "monthly": {
        const start = toIsoDate(startOfMonth(selectedDate));
        const end = toIsoDate(endOfMonth(selectedDate));
        return occurrenceDate >= start && occurrenceDate <= end;
      }
      case "yearly": {
        const year = selectedDate.getFullYear().toString();
        return occurrenceDate.startsWith(`${year}-`);
      }
      default:
        return true;
    }
  };

  if (periodKey && relevant.some((a) => a.periodKey !== undefined)) {
    return relevant.filter(
      (a) => a.periodKey === periodKey || (a.periodKey === undefined && isInSelectedDateRange(a)),
    );
  }

  return relevant.filter(isInSelectedDateRange);
}

export function computeGoalCountsForPill(
  goal: Goal,
  dayAssignments: DayAssignment[],
  selectedDate: Date,
  view: TrayView,
  weekStartsOn: 0 | 1 = 0,
): {
  planned: number;
  completed: number;
  missed: number;
  overrideTarget?: number;
  overrideUnit?: string;
  dailyBacklogCount?: number;
} {
  const cadence = goal.cadence;

  if (cadence === "daily") {
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
    if (goal.type === "quantified" && goal.target) {
      const units = computeDailyQuantifiedUnitsRollup(goal, periodStart, periodEnd, today, dayAssignments);
      return {
        planned: units.total, completed: units.done, missed: units.missed,
        overrideTarget: units.total,
        overrideUnit: goal.targetUnit ? ` ${goal.targetUnit}` : "",
        dailyBacklogCount: getDailyBacklogEntries(goal, today).length,
      };
    }
    return {
      planned: rollup.total, completed: rollup.done, missed: rollup.missed,
      overrideTarget: rollup.total, overrideUnit: " days",
      dailyBacklogCount: getDailyBacklogEntries(goal, today).length,
    };
  }

  if (cadence === "weekly" && view === "month") {
    const result = computeCrossperiodProgress(goal, "monthly", new Date(), dayAssignments, selectedDate);
    return { planned: result.total, completed: result.done, missed: 0, overrideTarget: result.total };
  }

  const isAutoScheduled = cadence === "weekly" && goal.activeDays && goal.activeDays.length > 0;
  if (isAutoScheduled) {
    const perDayTarget = goal.type === "quantified" && goal.target && goal.activeDays!.length
      ? Math.ceil(goal.target / goal.activeDays!.length) : 1;
    const assigned = getAssignmentsForPeriod(dayAssignments, goal.id, cadence, selectedDate, weekStartsOn);
    const nonSkipped = assigned.filter((a) => !a.skipped);
    const replacedPreferredDays = new Set(assigned.filter((a) => a.replacedAutoDate).map((a) => a.replacedAutoDate!));
    const manualPlanned = nonSkipped.reduce((s, a) => s + (a.targetAmount ?? 1), 0);
    const manualCompleted = nonSkipped.filter((a) => a.completed).reduce((s, a) => s + (a.targetAmount ?? 1), 0);
    const weekStart = startOfWeek(selectedDate, weekStartsOn);
    let autoPlanned = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const iso = toIsoDate(d);
      const dayKey = DAY_KEYS[d.getDay()];
      if (goal.activeDays!.includes(dayKey) && (!goal.startDate || iso >= goal.startDate) &&
          !replacedPreferredDays.has(iso) && !assigned.some((a) => a.date === iso)) {
        autoPlanned += perDayTarget;
      }
    }
    const manualDates = new Set(nonSkipped.map((a) => getAssignmentOccurrenceDate(a)));
    const weekStartIso = toIsoDate(startOfWeek(selectedDate, weekStartsOn));
    const weekEndIso = toIsoDate(endOfWeek(selectedDate, weekStartsOn));
    const autoCompleted = (goal.completedDates ?? []).filter((d) => {
      if (d < weekStartIso || d > weekEndIso) return false;
      const dayObj = new Date(d + "T00:00:00");
      const dayKey = DAY_KEYS[dayObj.getDay()];
      return goal.activeDays!.includes(dayKey) && (!goal.startDate || d >= goal.startDate) &&
        !replacedPreferredDays.has(d) && !manualDates.has(d);
    }).length * perDayTarget;
    return { planned: manualPlanned + autoPlanned, completed: manualCompleted + autoCompleted, missed: 0 };
  }

  const assigned = getAssignmentsForPeriod(dayAssignments, goal.id, cadence, selectedDate, weekStartsOn);
  return {
    planned: assigned.reduce((s, a) => s + (a.targetAmount ?? 1), 0),
    completed: assigned.filter((a) => a.completed).reduce((s, a) => s + (a.targetAmount ?? 1), 0),
    missed: 0,
  };
}

export function GoalPill({
  goal,
  plannedCount,
  completedCount,
  missedCount = 0,
  periodLabel,
  draggable = true,
  overrideTarget,
  overrideUnit,
  parentTitle,
  onRenameGoal,
  programLabel,
  dailyBacklogCount = 0,
  onResolveBacklogDate,
}: {
  goal: Goal;
  plannedCount: number;
  completedCount: number;
  missedCount?: number;
  periodLabel?: string;
  draggable?: boolean;
  overrideTarget?: number;
  overrideUnit?: string;
  parentTitle?: string;
  onRenameGoal: (goalId: string, nextTitle: string) => void;
  programLabel?: string | null;
  dailyBacklogCount?: number;
  onResolveBacklogDate?: (isoDate: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: goal.id,
    disabled: !draggable,
  });

  const effectiveTarget = overrideTarget ?? (goal.target ?? (goal.type === "binary" ? 1 : 0));
  const hasTarget = effectiveTarget > 0;
  const target = effectiveTarget;
  const unit = overrideUnit ?? (goal.targetUnit ? ` ${goal.targetUnit}` : "");

  const allDone = hasTarget && completedCount >= target;

  const completedPct = hasTarget ? Math.min(100, (completedCount / target) * 100) : 0;
  const missedPct = hasTarget ? Math.min(100 - completedPct, (missedCount / target) * 100) : 0;
  const pendingPct = hasTarget
    ? Math.min(100 - completedPct - missedPct, (Math.max(0, plannedCount - completedCount - missedCount) / target) * 100)
    : plannedCount > 0 ? 100 : 0;

  const line2 = computeGoalStatusLabel({ plannedCount, completedCount, missedCount, target, unit });

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
      className={cn(
        "group flex select-none touch-none overflow-hidden rounded-lg border border-slate-200 bg-white transition-shadow",
        draggable
          ? "cursor-grab active:cursor-grabbing hover:shadow-md hover:border-brand/30"
          : "cursor-default",
        isDragging ? "opacity-60 ring-1 ring-brand/20" : "shadow-sm",
      )}
    >
      <div className={cn("w-1 shrink-0 transition-colors duration-300", stripeClass)} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-2.5 pt-1.5 pb-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <EditableGoalTitle
            title={goal.title}
            onRename={isPrebuiltGoal(goal.id) ? undefined : (nextTitle) => onRenameGoal(goal.id, nextTitle)}
            className="truncate text-[12px] font-semibold leading-snug text-slate-800"
            inputClassName="text-[12px] font-semibold"
            suffix={periodLabel ? (
              <span className="ml-1 font-normal text-slate-400">({periodLabel})</span>
            ) : undefined}
          />
          {dailyBacklogCount > 0 ? (
            <DailyBacklogBadge
              goalTitle={goal.title}
              entries={getDailyBacklogEntries(goal, new Date())}
              onResolveDate={onResolveBacklogDate}
              compact
            />
          ) : null}
        </div>
        <p className="truncate text-[10px] font-medium leading-tight text-slate-500">
          {parentTitle && (
            <span className="mr-1 text-brand/60">↑ {parentTitle} ·</span>
          )}
          {[programLabel, line2].filter(Boolean).join(" · ") || "\u00A0"}
        </p>
        <SegmentedProgressBar
          className="mt-0.5"
          heightClassName="h-[5px]"
          segments={[
            { key: "done", widthPct: completedPct, className: allDone ? "bg-success" : "bg-brand" },
            { key: "missed", widthPct: missedPct, className: "bg-penalty" },
            { key: "pending", widthPct: pendingPct, className: "bg-planned" },
          ]}
        />
      </div>
      {draggable && (
        <div className="flex shrink-0 items-center px-1.5 text-slate-300 group-hover:text-slate-400 transition-colors">
          <GoalRowGripIcon />
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
  pageSize,
  onRenameGoal,
  onToggleDate,
}: {
  cadence: GoalCadence;
  label: string;
  goals: Goal[];
  dayAssignments: DayAssignment[];
  selectedDate: Date;
  filter: TrayFilter;
  view: TrayView;
  weekStartsOn?: 0 | 1;
  pageSize: number;
  onRenameGoal: (goalId: string, nextTitle: string) => void;
  onToggleDate: (goalId: string, isoDate: string) => void;
}) {
  const [offset, setOffset] = useState(0);

  function getGoalCounts(goal: Goal) {
    return computeGoalCountsForPill(goal, dayAssignments, selectedDate, view, weekStartsOn);
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
    .filter((g) => !g.endDate || g.endDate >= toIsoDate(selectedDate))
    .filter((g) => {
      if (filter === "all") return true;
      const counts = getGoalCounts(g);
      const resolvedTarget = counts.overrideTarget ?? (g.target ?? (g.type === "binary" ? 1 : 0));
      // Daily goals are always "allocated" by schedule — skip hide-allocated for them
      if (filter === "hide-allocated" && g.cadence === "daily") return true;
      if (filter === "hide-done" && counts.dailyBacklogCount && counts.dailyBacklogCount > 0) return true;
      if (filter === "hide-done" && resolvedTarget > 0 && counts.completed >= resolvedTarget) return false;
      if (filter === "hide-allocated" && resolvedTarget > 0 && counts.planned >= resolvedTarget) return false;
      return true;
    });

  const visibleGoals = colGoals.slice(offset, offset + pageSize);
  const canUp = offset > 0;
  const canDown = offset + pageSize < colGoals.length;
  const isPaginated = colGoals.length > pageSize;
  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.ceil(colGoals.length / pageSize);

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
          {label}
          {colGoals.length > 0 && (
            <span className="rounded-full bg-slate-100 px-1.5 py-[1px] text-[9px] font-bold tabular-nums text-slate-400">
              {colGoals.length}
            </span>
          )}
        </p>
        {isPaginated && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOffset((o) => Math.max(0, o - pageSize))}
              disabled={!canUp}
              className="flex items-center justify-center text-slate-500 transition-colors hover:text-slate-800 disabled:pointer-events-none disabled:opacity-25"
            >
              <svg width="12" height="7" viewBox="0 0 10 6" fill="none">
                <path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className="text-[10px] font-semibold tabular-nums text-slate-500">
              {currentPage}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => setOffset((o) => o + pageSize)}
              disabled={!canDown}
              className="flex items-center justify-center text-slate-500 transition-colors hover:text-slate-800 disabled:pointer-events-none disabled:opacity-25"
            >
              <svg width="12" height="7" viewBox="0 0 10 6" fill="none">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}
      </div>
      {colGoals.length === 0 ? (
        <p className="text-[11px] text-slate-300">—</p>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleGoals.map((goal) => {
            const counts = getGoalCounts(goal);
            const parentTitle = goal.parentGoalId
              ? goals.find((g) => g.id === goal.parentGoalId)?.title
              : undefined;
            return (
              <GoalPill
                key={goal.id}
                goal={goal}
                plannedCount={counts.planned}
                completedCount={counts.completed}
                missedCount={counts.missed}
                periodLabel={getPeriodLabel(goal)}
                draggable
                overrideTarget={counts.overrideTarget}
                overrideUnit={counts.overrideUnit}
                parentTitle={parentTitle}
                onRenameGoal={onRenameGoal}
                programLabel={getGoalProgramLabel(goal, selectedDate)}
                dailyBacklogCount={counts.dailyBacklogCount}
                onResolveBacklogDate={(isoDate) => onToggleDate(goal.id, isoDate)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}


export function GoalTray({ goals, dayAssignments, selectedDate, view, weekStartsOn = 0, filter = "all", pageSize: pageSizeProp, onRenameGoal, onToggleDate }: GoalTrayProps) {
  const selectedIso = toIsoDate(selectedDate);

  const allLibraryGoals = goals.filter(
    (g) => !g.adhoc && g.status !== "paused" && g.status !== "done",
  );
  const libraryGoals = goals.filter((g) => isGoalVisibleInCalendarMenu(g, selectedIso));

  if (libraryGoals.length === 0) {
    if (allLibraryGoals.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-line/60 bg-surface-muted/50 px-4 py-3">
          <p className="text-[12px] text-text-muted">
            No goals yet.{" "}
            <a href="/goals" className="font-semibold text-brand underline-offset-2 hover:underline">
              Add goals
            </a>{" "}
            to plan your week.
          </p>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-dashed border-line/60 bg-surface-muted/50 px-4 py-3">
        <p className="text-[12px] text-text-muted">No active goals for this date.</p>
      </div>
    );
  }

  const activeColumns = COLUMNS.filter(({ cadence }) =>
    libraryGoals.some((g) => g.cadence === cadence),
  );

  const pageSize = pageSizeProp ?? 3;

  return (
    <div>
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
            pageSize={pageSize}
            onRenameGoal={onRenameGoal}
            onToggleDate={onToggleDate}
          />
        ))}
      </div>
    </div>
  );
}

// ── Side-drawer goal tray ─────────────────────────────────────────────────────

const DRAWER_FILTERS = [
  { id: "all",      label: "All" },
  { id: "daily",    label: "Daily" },
  { id: "weekly",   label: "Weekly" },
  { id: "monthly",  label: "Monthly" },
  { id: "yearly",   label: "Yearly" },
  { id: "seasonal", label: "Seasonal" },
  { id: "projects", label: "Projects" },
] as const;

type DrawerFilter = typeof DRAWER_FILTERS[number]["id"];

const CADENCE_SECTIONS: { cadence: GoalCadence; label: string }[] = [
  { cadence: "daily",    label: "Daily" },
  { cadence: "weekly",   label: "Weekly" },
  { cadence: "monthly",  label: "Monthly" },
  { cadence: "yearly",   label: "Yearly" },
  { cadence: "one-time", label: "Projects" },
];

export function DrawerGoalTray({
  goals,
  dayAssignments,
  selectedDate,
  view,
  weekStartsOn = 0,
  onRenameGoal,
}: {
  goals: Goal[];
  dayAssignments: DayAssignment[];
  selectedDate: Date;
  view: TrayView;
  weekStartsOn?: 0 | 1;
  onRenameGoal: (goalId: string, nextTitle: string) => void;
}) {
  const [activeFilter, setActiveFilter] = useState<DrawerFilter>("all");
  const selectedIso = toIsoDate(selectedDate);

  const activeGoals = goals.filter((g) => isGoalVisibleInCalendarMenu(g, selectedIso));

  const counts: Record<DrawerFilter, number> = {
    all:      activeGoals.length,
    daily:    activeGoals.filter((g) => g.cadence === "daily").length,
    weekly:   activeGoals.filter((g) => g.cadence === "weekly").length,
    monthly:  activeGoals.filter((g) => g.cadence === "monthly").length,
    yearly:   activeGoals.filter((g) => g.cadence === "yearly").length,
    seasonal: activeGoals.filter((g) => !!g.endDate).length,
    projects: activeGoals.filter((g) => g.cadence === "one-time").length,
  };

  const filteredGoals = (() => {
    switch (activeFilter) {
      case "daily":    return activeGoals.filter((g) => g.cadence === "daily");
      case "weekly":   return activeGoals.filter((g) => g.cadence === "weekly");
      case "monthly":  return activeGoals.filter((g) => g.cadence === "monthly");
      case "yearly":   return activeGoals.filter((g) => g.cadence === "yearly");
      case "seasonal": return activeGoals.filter((g) => !!g.endDate);
      case "projects": return activeGoals.filter((g) => g.cadence === "one-time");
      default:         return activeGoals;
    }
  })();

  const currentIndex = DRAWER_FILTERS.findIndex((f) => f.id === activeFilter);
  const nextFilter = DRAWER_FILTERS[(currentIndex + 1) % DRAWER_FILTERS.length];

  function renderPill(g: Goal) {
    const c = computeGoalCountsForPill(g, dayAssignments, selectedDate, view, weekStartsOn);
    return (
      <GoalPill
        key={g.id}
        goal={g}
        plannedCount={c.planned}
        completedCount={c.completed}
        missedCount={c.missed}
        overrideTarget={c.overrideTarget}
        overrideUnit={c.overrideUnit}
        parentTitle={g.parentGoalId ? goals.find((p) => p.id === g.parentGoalId)?.title : undefined}
        draggable
        onRenameGoal={onRenameGoal}
        programLabel={getGoalProgramLabel(g, selectedDate)}
        dailyBacklogCount={c.dailyBacklogCount}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Cycle filter button */}
      <button
        type="button"
        onClick={() => setActiveFilter(nextFilter.id)}
        className="flex w-full items-center justify-between rounded-lg bg-slate-100 px-3 py-1.5 text-left transition-colors hover:bg-slate-200"
      >
        <span className="text-[12px] font-semibold text-slate-700">
          {DRAWER_FILTERS.find((f) => f.id === activeFilter)?.label}
          {counts[activeFilter] > 0 && (
            <span className="ml-1.5 text-[11px] font-normal text-slate-400">{counts[activeFilter]}</span>
          )}
        </span>
        <span className="text-[10px] text-slate-400">{nextFilter.label} →</span>
      </button>

      {/* Goal list */}
      {activeFilter === "all" ? (
        <div className="flex flex-col gap-4">
          {CADENCE_SECTIONS.filter((s) => activeGoals.some((g) => g.cadence === s.cadence)).map((s) => (
            <div key={s.cadence}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.label}</p>
              <div className="flex flex-col gap-2">
                {activeGoals.filter((g) => g.cadence === s.cadence).map(renderPill)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredGoals.length === 0
            ? <p className="text-[12px] text-slate-300">No {activeFilter} goals.</p>
            : filteredGoals.map(renderPill)
          }
        </div>
      )}

      {/* Contextual action */}
      <a
        href={activeFilter === "all"
          ? "/goals"
          : activeFilter === "projects"
            ? "/goals?new=one-time"
            : `/goals?new=${activeFilter}`
        }
        className="mt-1 block text-center text-[11px] font-medium text-slate-400 transition-colors hover:text-brand"
      >
        {activeFilter === "all" ? "Manage goals →" : `+ New ${activeFilter === "projects" ? "project" : activeFilter + " goal"}`}
      </a>
    </div>
  );
}
