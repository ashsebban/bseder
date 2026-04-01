"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";
import { useCalendarRouterState } from "@/features/calendar/hooks/use-calendar-router-state";
import { getRelativeDayLabel, startOfDay } from "@/features/calendar/lib/date";
import { buildJewishTimesByDate, getHebrewYearLabel } from "@/features/calendar/lib/jewish-times";
import { computeDayZmanim } from "@/features/calendar/lib/zmanim";
import { Location } from "@hebcal/core";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, toIsoDate } from "@/features/calendar/lib/date";
import { getCalendarLocationByKey } from "@/features/calendar/lib/locations";
import { buildMonthView, buildWeekView, getViewTitle } from "@/features/calendar/lib/view-models";
import { CalendarHeader } from "@/features/calendar/components/calendar-header";
import { MonthGrid } from "@/features/calendar/components/month-grid";
import { WeekGrid } from "@/features/calendar/components/week-grid";
import { DayFocus } from "@/features/calendar/components/day-focus";
import { useCalendarPreferences } from "@/features/settings/hooks/use-calendar-preferences";
import { CalendarSettingsMenu } from "@/features/settings/components/calendar-settings-menu";
import { loadGoals, saveGoals } from "@/features/goals/lib/goal-store";
import { buildExcludedDates, computeDayProgress } from "@/features/goals/lib/goal-progress";
import {
  DndContext,
  DragOverlay,
  useSensor, useSensors, MouseSensor, TouchSensor,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { GoalTray } from "@/features/planner/components/goal-tray";
import {
  loadDayAssignments,
  saveDayAssignments,
  createAssignment,
  type DayAssignment,
} from "@/features/planner/lib/day-assignment-store";
import type { Goal } from "@/features/goals/types/goal";
import { computePeriodKey } from "@/features/planner/lib/period-key";
import { toggleGoalDate, updateParentProgress } from "@/features/goals/lib/goal-mutations";
import { loadGoalOrder, saveGoalOrder, reorderGlobal } from "@/features/planner/lib/goal-order-store";
import { computeRemainingCapacity } from "@/features/planner/lib/assignment-rules";
import { Drawer } from "@/components/ui/drawer";
import type { CalendarDayMetadata } from "@/features/calendar/types/calendar";
import { getApplicableGoalsForDate } from "@/features/goals/lib/goal-progress";


const TIMELINE_START_HOUR = 5;

function getPreferredMonthDate(droppedIsoDate: string, preferredMonthDay: "first" | "last" | number): string {
  const dropped = new Date(droppedIsoDate + "T00:00:00");
  if (preferredMonthDay === "first") return toIsoDate(startOfMonth(dropped));
  if (preferredMonthDay === "last") return toIsoDate(endOfMonth(dropped));
  const clamped = Math.min(preferredMonthDay as number, endOfMonth(dropped).getDate());
  return toIsoDate(new Date(dropped.getFullYear(), dropped.getMonth(), clamped));
}

function AmountPrompt({
  goal,
  dayLabel,
  onConfirm,
  onCancel,
  maxAmount,
  defaultAmount,
  title,
}: {
  goal: Goal;
  dayLabel: string;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
  maxAmount?: number;
  defaultAmount?: number;
  title?: string;
}) {
  const [value, setValue] = useState(String(defaultAmount ?? 1));
  const clamp = (n: number) => Math.min(maxAmount ?? Infinity, Math.max(1, n));
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-72 rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/10">
        <p className="text-[13.5px] font-bold text-slate-800">
          {title ?? `How many ${goal.targetUnit ?? "units"}?`}
        </p>
        <p className="mt-0.5 text-[11.5px] text-slate-400">
          {goal.title} → {dayLabel}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={maxAmount}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onConfirm(clamp(Number(value) || 1));
              if (e.key === "Escape") onCancel();
            }}
            className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-semibold text-slate-800 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/15"
            autoFocus
          />
          {goal.targetUnit && (
            <span className="text-[12px] text-slate-500">{goal.targetUnit}</span>
          )}
          {maxAmount !== undefined && (
            <span className="text-[11px] text-slate-400">max {maxAmount}</span>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(clamp(Number(value) || 1))}
            className="flex-1 rounded-xl bg-brand py-2 text-[12px] font-semibold text-white transition hover:bg-brand/90"
          >
            Add to {dayLabel.split(",")[0]}
          </button>
        </div>
      </div>
    </div>
  );
}

function CapBlockedPrompt({
  goal,
  onEditPolicy,
  onDismiss,
}: {
  goal: Goal;
  onEditPolicy: () => void;
  onDismiss: () => void;
}) {
  const cadenceLabel: Record<string, string> = { weekly: "week", monthly: "month", yearly: "year" };
  const period = cadenceLabel[goal.cadence] ?? "period";
  const effectiveCap = (goal.target ?? 0) + (goal.backlog ?? 0);
  const unit = goal.targetUnit ?? "unit";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
    >
      <div className="w-80 rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/10">
        <p className="text-[13.5px] font-bold text-slate-800">All planned for this {period}</p>
        <p className="mt-1 text-[12px] text-slate-500">
          <span className="font-semibold">{goal.title}</span> already has {effectiveCap} {unit}{effectiveCap !== 1 ? "s" : ""} planned — the full {period}ly allocation.
        </p>
        <p className="mt-2 text-[11.5px] text-slate-400">
          To add more, update the cap in your goal settings.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 rounded-xl border border-slate-200 py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={onEditPolicy}
            className="flex-1 rounded-xl bg-brand py-2 text-[12px] font-semibold text-white transition hover:bg-brand/90"
          >
            Edit Policy
          </button>
        </div>
      </div>
    </div>
  );
}

type PanelGoalItem =
  | { kind: "daily"; goal: Goal }
  | { kind: "assigned"; goal: Goal; assignment: DayAssignment };

function PanelSortHandle({
  goalId,
  allIds,
  onReorderGoals,
}: {
  goalId: string;
  allIds: string[];
  onReorderGoals: (prev: string[], next: string[]) => void;
}) {
  const dragRef = useRef<{ startY: number; startIdx: number } | null>(null);
  return (
    <button
      type="button"
      tabIndex={-1}
      className="shrink-0 cursor-grab touch-none text-slate-200 hover:text-slate-400 active:cursor-grabbing"
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = { startY: e.clientY, startIdx: allIds.indexOf(goalId) };
      }}
      onPointerMove={(e) => { if (dragRef.current) e.stopPropagation(); }}
      onPointerUp={(e) => {
        if (!dragRef.current) return;
        e.stopPropagation();
        const { startY, startIdx } = dragRef.current;
        dragRef.current = null;
        const offset = Math.round((e.clientY - startY) / 44);
        const newIdx = Math.max(0, Math.min(allIds.length - 1, startIdx + offset));
        if (newIdx !== startIdx) onReorderGoals(allIds, arrayMove(allIds, startIdx, newIdx));
      }}
      onPointerCancel={() => { dragRef.current = null; }}
    >
      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
        <circle cx="2.5" cy="2.5" r="1.5"/><circle cx="7.5" cy="2.5" r="1.5"/>
        <circle cx="2.5" cy="7" r="1.5"/><circle cx="7.5" cy="7" r="1.5"/>
        <circle cx="2.5" cy="11.5" r="1.5"/><circle cx="7.5" cy="11.5" r="1.5"/>
      </svg>
    </button>
  );
}

function SortablePanelGoalItem({
  item,
  iso,
  allIds,
  onToggleDate,
  onToggleAssignment,
  onReorderGoals,
}: {
  item: PanelGoalItem;
  iso: string;
  allIds: string[];
  onToggleDate: (goalId: string, isoDate: string) => void;
  onToggleAssignment: (id: string) => void;
  onReorderGoals: (prev: string[], next: string[]) => void;
}) {
  const done = item.kind === "assigned"
    ? item.assignment.completed
    : (item.goal.completedDates?.includes(iso) ?? false);

  function handleToggle() {
    if (item.kind === "assigned") onToggleAssignment(item.assignment.id);
    else onToggleDate(item.goal.id, iso);
  }

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <PanelSortHandle goalId={item.goal.id} allIds={allIds} onReorderGoals={onReorderGoals} />
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition",
          done ? "border-success bg-success" : "border-slate-300 bg-white hover:border-brand",
        )}
      >
        {done && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <p className={cn("min-w-0 flex-1 truncate text-[13px] font-semibold", done ? "text-slate-400 line-through" : "text-slate-800")}>
        {item.goal.title}
      </p>
    </div>
  );
}

function DayPanelContent({
  date,
  metadata,
  goals,
  dayAssignments,
  excludedByGoal,
  onToggleAssignment,
  onToggleDate,
  goalOrder,
  onReorderGoals,
  onNavigate,
}: {
  date: Date;
  metadata?: CalendarDayMetadata;
  goals: Goal[];
  dayAssignments: DayAssignment[];
  excludedByGoal: Map<string, Set<string>>;
  onToggleAssignment: (id: string) => void;
  onToggleDate: (goalId: string, isoDate: string) => void;
  goalOrder: string[];
  onReorderGoals: (prev: string[], next: string[]) => void;
  onNavigate: () => void;
}) {
  const iso = toIsoDate(date);

  const assignments = dayAssignments.filter((a) => a.date === iso);
  const assignedGoalIds = new Set(assignments.map((a) => a.goalId));
  const dailyGoals = getApplicableGoalsForDate(goals, date, excludedByGoal)
    .filter((g) => !assignedGoalIds.has(g.id));

  // Unified sorted list
  const allItems: PanelGoalItem[] = [
    ...dailyGoals.map((g): PanelGoalItem => ({ kind: "daily", goal: g })),
    ...assignments
      .map((a) => ({ a, goal: goals.find((g) => g.id === a.goalId) }))
      .filter((x): x is { a: DayAssignment; goal: Goal } => x.goal !== undefined)
      .map(({ a, goal }): PanelGoalItem => ({ kind: "assigned", goal, assignment: a })),
  ].sort((x, y) => {
    const ai = goalOrder.indexOf(x.goal.id);
    const bi = goalOrder.indexOf(y.goal.id);
    return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
  });

  const itemIds = allItems.map((i) => i.goal.id);

  return (
    <div className="flex flex-col gap-5">
      {/* Hebrew date + zmanim */}
      {metadata && (
        <div className="flex flex-wrap items-center gap-2">
          {metadata.hebrewDateLabel && (
            <span className="text-[13px] font-semibold text-slate-500">{metadata.hebrewDateLabel}</span>
          )}
          {metadata.candleLighting && (
            <span className="rounded-full border border-brand/15 bg-brand/[0.06] px-2 py-0.5 text-[11px] font-semibold text-brand/70">
              🕯 {metadata.candleLighting}
            </span>
          )}
          {metadata.fastBegins && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              Fast {metadata.fastBegins}
            </span>
          )}
          {metadata.shabbosEnds && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              Ends {metadata.shabbosEnds}
            </span>
          )}
        </div>
      )}

      {/* Goals for this day */}
      <div className="flex flex-col gap-2">
        {allItems.length === 0 ? (
          <p className="text-[13px] text-slate-400">No goals scheduled — drag from the Goal Library</p>
        ) : (
          <>{allItems.map((item) => (
            <SortablePanelGoalItem
              key={item.goal.id}
              item={item}
              iso={iso}
              allIds={itemIds}
              onToggleDate={onToggleDate}
              onToggleAssignment={onToggleAssignment}
              onReorderGoals={onReorderGoals}
            />
          ))}</>
        )}
      </div>

      {/* Open full day view */}
      <button
        type="button"
        onClick={onNavigate}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-brand/20 bg-brand/[0.06] py-2.5 text-[13px] font-semibold text-brand transition hover:bg-brand/10"
      >
        Open Day View
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 2.5L9.5 7L5 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}


export function CalendarWorkspace() {
  const router = useRouter();
  const calendar = useCalendarRouterState();
  const { preferences, hydrated, updatePreference, resetPreferences } = useCalendarPreferences();
  const today = startOfDay(new Date());
  const monthRangeStart = startOfWeek(startOfMonth(calendar.selectedDate), preferences.weekStartsOn);
  const monthRangeEnd = endOfWeek(endOfMonth(calendar.selectedDate), preferences.weekStartsOn);
  const jewishTimesByDate = useMemo(
    () => buildJewishTimesByDate(monthRangeStart, monthRangeEnd, preferences),
    [calendar.selectedDateIso, preferences],
  );

  const [goals, setGoals] = useState<Goal[]>([]);
  const [dayAssignments, setDayAssignments] = useState<DayAssignment[]>([]);
  const [goalOrder, setGoalOrder] = useState<string[]>([]);
  const [completedOmerDates, setCompletedOmerDates] = useState<Set<string>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("steinberg.omer_completions.v1") : null;
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  });
  const handleToggleOmer = useCallback((isoDate: string) => {
    setCompletedOmerDates((prev) => {
      const next = new Set(prev);
      next.has(isoDate) ? next.delete(isoDate) : next.add(isoDate);
      try { localStorage.setItem("steinberg.omer_completions.v1", JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const [sidePanelDate, setSidePanelDate] = useState<Date | null>(null);

  // Start open (matches SSR); sync from localStorage after hydration to avoid mismatch
  const [trayOpen, setTrayOpen] = useState(true);
  const [trayFilter, setTrayFilter] = useState<"all" | "hide-done" | "hide-allocated">("all");
  const [trayFilterMenuOpen, setTrayFilterMenuOpen] = useState(false);
  const trayFilterMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const saved = localStorage.getItem("goal-tray-open");
    if (saved !== null) setTrayOpen(saved === "true");
  }, []);
  useEffect(() => {
    if (!trayFilterMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (trayFilterMenuRef.current && !trayFilterMenuRef.current.contains(e.target as Node)) {
        setTrayFilterMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [trayFilterMenuOpen]);
  const [pendingAssignment, setPendingAssignment] = useState<{ goalId: string; isoDate: string; maxAmount?: number; suggestedAmount?: number; replacedAutoDate?: string } | null>(null);
  const [pendingCompletion, setPendingCompletion] = useState<{ id: string; defaultAmount: number; date: string } | null>(null);
  const [pendingDateCompletion, setPendingDateCompletion] = useState<{ goalId: string; isoDate: string; defaultAmount: number } | null>(null);
  const [capBlockedGoal, setCapBlockedGoal] = useState<{ goalId: string } | null>(null);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );
  useEffect(() => {
    setGoals(loadGoals());
    setDayAssignments(loadDayAssignments());
    setGoalOrder(loadGoalOrder());
  }, []);

  const handleReorderGoals = useCallback((prevDayIds: string[], newDayIds: string[]) => {
    setGoalOrder((prev) => {
      const next = reorderGlobal(prev, prevDayIds, newDayIds);
      saveGoalOrder(next);
      return next;
    });
  }, []);

  const dayZmanim = useMemo(() => {
    if (calendar.view !== "day") return null;
    const locationOption = getCalendarLocationByKey(preferences.locationKey);
    if (!locationOption) return null;
    const location = Location.lookup(locationOption.lookupName);
    if (!location) return null;
    return computeDayZmanim(calendar.selectedDate, location, preferences.timeFormat);
  }, [calendar.view, calendar.selectedDateIso, preferences.locationKey, preferences.timeFormat]);

  // Zmanim for today — used in week view to dim expired goals in the today column
  const todayZmanim = useMemo(() => {
    if (calendar.view !== "week") return null;
    const locationOption = getCalendarLocationByKey(preferences.locationKey);
    if (!locationOption) return null;
    const location = Location.lookup(locationOption.lookupName);
    if (!location) return null;
    return computeDayZmanim(today, location, preferences.timeFormat);
  }, [calendar.view, preferences.locationKey, preferences.timeFormat]);

  const [viewInitialized, setViewInitialized] = useState(false);
  useEffect(() => {
    if (hydrated && !viewInitialized) {
      calendar.setView(preferences.defaultView);
      setViewInitialized(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // When weekStartsOn changes in week view, snap selectedDate to the new week start
  // so the displayed week aligns with the change instead of shifting to a prior week.
  useEffect(() => {
    if (!viewInitialized || calendar.view !== "week") return;
    const snapped = startOfWeek(calendar.selectedDate, preferences.weekStartsOn);
    if (toIsoDate(snapped) !== toIsoDate(calendar.selectedDate)) {
      calendar.setSelectedDate(snapped);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences.weekStartsOn]);

  // Pre-compute holiday excluded dates per goal (once per month/goal change)
  const excludedByGoal = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const goal of goals) {
      if (goal.cadence !== "daily") continue;
      const excluded = buildExcludedDates(
        monthRangeStart,
        monthRangeEnd,
        goal.excludes?.categories ?? [],
        goal.excludes?.individual ?? [],
      );
      map.set(goal.id, excluded);
    }
    return map;
  }, [goals, monthRangeStart, monthRangeEnd]);

  // Build the CalendarDayMetadata map used by month/week grid tiles.
  //
  // The `progress` field on each day's metadata is a MERGED counter that combines
  // two semantically distinct sources into one { completed, total } shape:
  //
  //   Source 1 — Schedule-driven daily goals (from computeDayProgress):
  //     "Of the recurring daily goals that apply to this day (by activeDays + holiday exclusions),
  //      how many has the user marked done via completedDates?"
  //
  //   Source 2 — Intent-driven assignments (from dayAssignments):
  //     "Of the weekly/monthly/yearly/one-time sessions the user explicitly planned for this day,
  //      how many have been toggled to completed?"
  //
  // These are merged because the month tile needs a single dot/fraction to show overall daily
  // completion across both recurring obligations and planned sessions. This is intentional UX.
  //
  // IMPORTANT: Do not split this into two separate counters without updating the month/week tile
  // rendering logic that consumes `progress`. A future DB migration may want to store these
  // separately and combine them only at the view-model layer.
  const metadataByDate = useMemo(() => {
    const merged = new Map(jewishTimesByDate);

    // 1. Daily goal progress (schedule-driven: applicable goals marked done via completedDates)
    if (goals.length > 0) {
      const cursor = new Date(monthRangeStart);
      while (cursor <= monthRangeEnd) {
        const progress = computeDayProgress(goals, new Date(cursor), excludedByGoal, dayAssignments);
        if (progress) {
          const iso = toIsoDate(cursor);
          const existing = merged.get(iso);
          merged.set(iso, { ...existing, progress });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    // 2. Assignment progress (intent-driven: explicitly planned sessions toggled complete)
    //    Folded in so monthly tile counters stay in sync with the planner.
    //    IMPORTANT: skip daily goals — they are already counted in Source 1 via completedDates.
    //    Counting them again here causes double-counting and stale missed/completed mismatches.
    const goalMap = new Map(goals.map((g) => [g.id, g]));
    for (const assignment of dayAssignments) {
      const goal = goalMap.get(assignment.goalId);
      if (!goal) continue; // skip orphaned assignments
      if (goal.cadence === "daily") continue; // already counted by computeDayProgress via completedDates
      const existing = merged.get(assignment.date);
      const base = existing?.progress ?? { completed: 0, total: 0, missed: 0 };
      merged.set(assignment.date, {
        ...existing,
        progress: {
          completed: base.completed + (assignment.completed ? 1 : 0),
          total: base.total + 1,
          missed: base.missed,
        },
      });
    }

    // 3. Auto-show completions for non-daily goals (weekly/monthly/yearly goals completed via
    //    completedDates without creating a DayAssignment — e.g. toggled in the week grid).
    //    Skip any date already covered by a DayAssignment for the same goal (Source 2 counted those).
    const assignmentDatesByGoal = new Map<string, Set<string>>();
    for (const a of dayAssignments) {
      if (!assignmentDatesByGoal.has(a.goalId)) assignmentDatesByGoal.set(a.goalId, new Set());
      assignmentDatesByGoal.get(a.goalId)!.add(a.date);
    }
    for (const goal of goals) {
      if (goal.cadence === "daily") continue; // already handled by Source 1
      const coveredDates = assignmentDatesByGoal.get(goal.id) ?? new Set<string>();
      for (const dateStr of (goal.completedDates ?? [])) {
        if (coveredDates.has(dateStr)) continue; // already counted in Source 2
        const existing = merged.get(dateStr);
        const base = existing?.progress ?? { completed: 0, total: 0, missed: 0 };
        merged.set(dateStr, {
          ...existing,
          progress: { completed: base.completed + 1, total: base.total + 1, missed: base.missed },
        });
      }
    }

    return merged;
  }, [jewishTimesByDate, goals, excludedByGoal, dayAssignments, monthRangeStart, monthRangeEnd]);

  const handleAssign = useCallback((
    goalId: string,
    isoDate: string,
    targetAmount?: number,
    periodKey?: string,
    replacedAutoDate?: string,
    scheduledTime?: string,
    durationMins?: number,
  ) => {
    setDayAssignments((prev) => {
      // Allow multiple assignments for quantified goals; block duplicates for binary
      const goal = goals.find((g) => g.id === goalId);
      const isDuplicate = goal?.type !== "quantified" && prev.some((a) => a.goalId === goalId && a.date === isoDate);
      if (isDuplicate) return prev;
      // Enforce noGettingAhead cap
      if (goal?.noGettingAhead && goal.target !== undefined) {
        const effectiveCap = goal.target + (goal.backlog ?? 0);
        const alreadyPlanned = prev.reduce(
          (sum, a) => a.goalId === goalId ? sum + (a.targetAmount ?? 1) : sum, 0,
        );
        if (alreadyPlanned + (targetAmount ?? 1) > effectiveCap) return prev;
      }
      const updated = [...prev, createAssignment(goalId, isoDate, targetAmount, periodKey, replacedAutoDate, scheduledTime, durationMins)];
      saveDayAssignments(updated);
      return updated;
    });
  }, [goals]);

  const handleSetDuration = useCallback((assignmentId: string, durationMins: number) => {
    setDayAssignments((prev) => {
      const updated = prev.map((a) => a.id === assignmentId ? { ...a, durationMins } : a);
      saveDayAssignments(updated);
      return updated;
    });
  }, []);

  const handleUnassign = useCallback((assignmentId: string) => {
    const assignment = dayAssignments.find((a) => a.id === assignmentId);
    if (!assignment) return;
    const remainingAssignments = dayAssignments.filter(
      (a) => a.goalId === assignment.goalId && a.id !== assignmentId,
    );
    setDayAssignments((prev) => {
      const updated = prev.filter((a) => a.id !== assignmentId);
      saveDayAssignments(updated);
      return updated;
    });
    setGoals((gs) => {
      const goal = gs.find((g) => g.id === assignment.goalId);
      // Remove one-time goals that have no remaining assignments (created via + Add task)
      if (goal?.cadence === "one-time" && remainingAssignments.length === 0) {
        const synced = gs.filter((g) => g.id !== assignment.goalId);
        saveGoals(synced);
        return synced;
      }
      // If this assignment's date is marked done in completedDates, un-mark it
      if (goal?.completedDates?.includes(assignment.date)) {
        const synced = gs.map((g) =>
          g.id === assignment.goalId
            ? { ...g, completedDates: g.completedDates!.filter((d) => d !== assignment.date) }
            : g,
        );
        saveGoals(synced);
        return synced;
      }
      return gs;
    });
  }, [dayAssignments]);

  const handleMoveAssignment = useCallback((assignmentId: string, newIsoDate: string) => {
    setDayAssignments((prev) => {
      const idx = prev.findIndex((a) => a.id === assignmentId);
      if (idx === -1) return prev;
      if (prev[idx].date === newIsoDate) return prev;
      const updated = prev.map((a) => a.id === assignmentId ? { ...a, date: newIsoDate } : a);
      saveDayAssignments(updated);
      return updated;
    });
  }, []);

  const handleToggleAssignment = useCallback((id: string) => {
    const assignment = dayAssignments.find((a) => a.id === id);
    if (!assignment) return;
    const nowCompleted = !assignment.completed;
    // For daily binary goals tracked via completedDates, keep completedDates in sync
    const goal = goals.find((g) => g.id === assignment.goalId);
    if (goal?.cadence === "daily" && goal?.type === "binary") {
      const alreadyInDates = goal.completedDates?.includes(assignment.date) ?? false;
      if (nowCompleted !== alreadyInDates) {
        setGoals((prev) => {
          const updated = prev.map((g) => {
            if (g.id !== assignment.goalId) return g;
            const dates = g.completedDates ?? [];
            const newDates = dates.includes(assignment.date)
              ? dates.filter((d) => d !== assignment.date)
              : [...dates, assignment.date];
            return { ...g, completedDates: newDates };
          });
          saveGoals(updated);
          return updated;
        });
      }
    }
    // Intercept quantified completions — ask "how many?" before marking done
    if (nowCompleted && goal?.type === "quantified") {
      const def = assignment.targetAmount ?? suggestedAmount(goal);
      setPendingCompletion({ id, defaultAmount: def, date: assignment.date });
      return;
    }
    // Feed progress back to parent one-time (project) goal
    if (goal?.parentGoalId) {
      const delta = nowCompleted
        ? +(assignment.targetAmount ?? goal.target ?? 1)
        : -(assignment.targetAmount ?? goal.target ?? 1);
      setGoals((prev) => {
        const updated = updateParentProgress(prev, goal.parentGoalId!, delta);
        saveGoals(updated);
        return updated;
      });
    }
    setDayAssignments((prev) => {
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, "0");
      const mm = now.getMinutes().toString().padStart(2, "0");
      const timeStr = `${hh}:${mm}`;
      const updated = prev.map((a) => {
        if (a.id !== id) return a;
        return {
          ...a,
          completed: nowCompleted,
          completedAt: nowCompleted ? (a.scheduledTime ?? timeStr) : undefined,
          scheduledTime: nowCompleted && !a.scheduledTime ? timeStr : a.scheduledTime,
        };
      });
      saveDayAssignments(updated);
      return updated;
    });
  }, [dayAssignments, goals]);

  const handleSetScheduledTime = useCallback((assignmentId: string, time: string | null) => {
    setDayAssignments((prev) => {
      const updated = prev.map((a) =>
        a.id === assignmentId ? { ...a, scheduledTime: time ?? undefined } : a,
      );
      saveDayAssignments(updated);
      return updated;
    });
  }, []);

  function suggestedAmount(goal: Goal): number {
    // Daily goals: target IS the per-session amount — don't divide by activeDays
    if (goal.cadence === "daily") return goal.target ?? 1;
    return Math.ceil((goal.target ?? 1) / Math.max(1, goal.activeDays?.length ?? 7));
  }

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveGoalId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveGoalId(null);
    const activeId = event.active.id as string;

    const isoDate = event.over?.id as string | undefined;

    // Drop onto a timeline time slot (day view)
    if (typeof isoDate === "string" && isoDate.startsWith("time-slot:")) {
      const minutesFromStart = parseInt(isoDate.slice("time-slot:".length), 10);
      const totalMins = minutesFromStart + TIMELINE_START_HOUR * 60;
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      const dayIso = toIsoDate(calendar.selectedDate);

      // Helper: check if a "HH:MM" time falls within a goal's zmanim window
      const isTimeInGoalWindow = (goal: Goal, hhmm: string): boolean => {
        if (!dayZmanim || (!goal.startsAt && !goal.expiresAt)) return true;
        const [hh, mm] = hhmm.split(":").map(Number);
        const frac = hh + mm / 60;
        if (goal.startsAt) {
          const p = dayZmanim.periods.find((p) => p.name === goal.startsAt);
          if (p && frac < p.startHour) return false;
        }
        if (goal.expiresAt) {
          const p = dayZmanim.periods.find((p) => p.name === goal.expiresAt);
          if (p && frac >= p.startHour) return false;
        }
        return true;
      };

      if (activeId.startsWith("assignment:") || activeId.startsWith("timeline:")) {
        // Existing assignment dragged to a different slot → update scheduledTime
        const assignmentId = activeId.startsWith("assignment:")
          ? activeId.slice("assignment:".length)
          : activeId.slice("timeline:".length);
        const assignment = dayAssignments.find((a) => a.id === assignmentId);
        const goal = assignment ? goals.find((g) => g.id === assignment.goalId) : undefined;
        if (goal && !isTimeInGoalWindow(goal, timeStr)) return;
        handleSetScheduledTime(assignmentId, timeStr);
      } else if (activeId.startsWith("daily:")) {
        // Daily goal dragged from checklist to timeline → create assignment with scheduledTime
        // The assignment will suppress the auto-show in dailyGoals and appear in assignedItems instead
        const goalId = activeId.slice("daily:".length);
        const goal = goals.find((g) => g.id === goalId);
        if (!goal) return;
        if (!isTimeInGoalWindow(goal, timeStr)) return;
        handleAssign(goalId, dayIso, undefined, undefined, undefined, timeStr, preferences.timelineDefaultDurationMins);
      } else {
        // Goal pill from tray dropped directly onto a time slot → create assignment with scheduledTime
        const goalId = activeId;
        const goal = goals.find((g) => g.id === goalId);
        if (!goal) return;
        const periodKey = computePeriodKey(goal.cadence, new Date(dayIso + "T00:00:00"));
        handleAssign(goalId, dayIso, undefined, periodKey, undefined, timeStr, preferences.timelineDefaultDurationMins);
      }
      return;
    }

    // Assignment drag → move to new day (blocked if goal is locked)
    if (activeId.startsWith("assignment:") || activeId.startsWith("timeline:")) {
      const assignmentId = activeId.startsWith("assignment:")
        ? activeId.slice("assignment:".length)
        : activeId.slice("timeline:".length);
      if (isoDate) {
        const assignment = dayAssignments.find((a) => a.id === assignmentId);
        const goal = assignment ? goals.find((g) => g.id === assignment.goalId) : undefined;
        if (!goal?.lockInDays) handleMoveAssignment(assignmentId, isoDate);
      }
      return;
    }

    // Auto-scheduled weekly goal dragged from week grid → assign to single dropped day.
    // Records sourceIso as replacedAutoDate so WeekGrid can suppress that specific
    // preferred-day auto-show instead of globally suppressing all preferred days.
    // Format: "weekly:${goalId}:${sourceIso}"
    if (activeId.startsWith("weekly:")) {
      const rest = activeId.slice("weekly:".length);
      const lastColon = rest.lastIndexOf(":");
      const goalId = rest.slice(0, lastColon);
      const sourceIso = rest.slice(lastColon + 1);
      if (!isoDate || isoDate === sourceIso) return; // no-op if dropped on same day
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) return;
      if (goal.lockInDays) return; // locked — ignore cross-day drag
      const periodKey = computePeriodKey(goal.cadence, new Date(isoDate + "T00:00:00"));
      // For quantified weekly auto-show drags, prompt for amount (same as pill drags)
      if (goal.type === "quantified" && goal.targetUnit) {
        const remaining = goal.noGettingAhead && goal.target !== undefined
          ? computeRemainingCapacity(goal, dayAssignments, calendar.selectedDate)
          : undefined;
        setPendingAssignment({ goalId, isoDate, suggestedAmount: suggestedAmount(goal), maxAmount: remaining, replacedAutoDate: sourceIso });
        return;
      }
      handleAssign(goalId, isoDate, undefined, periodKey, sourceIso);
      return;
    }

    // Goal pill drag → create assignment
    const goalId = activeId;
    if (!isoDate) return;
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    const periodKey = computePeriodKey(goal.cadence, new Date(isoDate + "T00:00:00"));

    // noGettingAhead: compute remaining capacity for all capped goals
    if (goal.noGettingAhead && goal.target !== undefined) {
      const remaining = computeRemainingCapacity(goal, dayAssignments, calendar.selectedDate);
      if (remaining <= 0) {
        setCapBlockedGoal({ goalId });
        return;
      }
      if (goal.type === "quantified" && goal.targetUnit) {
        setPendingAssignment({ goalId, isoDate, maxAmount: remaining, suggestedAmount: suggestedAmount(goal) });
        return;
      }
      // Binary capped goal with remaining capacity — assign to the dropped day.
      // Monthly goals snap to their preferred day within the month if set.
      // Weekly goals with activeDays: assign to the dropped day (preferred days already auto-show).
      if (goal.cadence === "monthly" && goal.preferredMonthDay !== undefined) {
        handleAssign(goalId, getPreferredMonthDate(isoDate, goal.preferredMonthDay), undefined, periodKey);
      } else {
        handleAssign(goalId, isoDate, undefined, periodKey);
      }
      return;
    }

    if (goal.type === "quantified" && goal.targetUnit) {
      setPendingAssignment({ goalId, isoDate, suggestedAmount: suggestedAmount(goal) });
    } else if (goal.cadence === "monthly" && goal.preferredMonthDay !== undefined) {
      handleAssign(goalId, getPreferredMonthDate(isoDate, goal.preferredMonthDay), undefined, periodKey);
    } else {
      handleAssign(goalId, isoDate, undefined, periodKey);
    }
  }, [goals, dayAssignments, preferences, dayZmanim, handleAssign, handleMoveAssignment, handleSetScheduledTime, calendar.selectedDate]);

  const handleAddTask = useCallback((title: string, isoDate: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newGoal: Goal = { id, title, cadence: "one-time", type: "binary", status: "ongoing", adhoc: true };
    setGoals((prev) => {
      const updated = [...prev, newGoal];
      saveGoals(updated);
      return updated;
    });
    handleAssign(id, isoDate);
  }, [handleAssign]);

  const handleToggleDate = useCallback((goalId: string, isoDate: string) => {
    const goal = goals.find((g) => g.id === goalId);
    const isDone = goal?.completedDates?.includes(isoDate) ?? false;
    // Intercept quantified goals marking done — ask "how many?" first
    if (!isDone && goal?.type === "quantified") {
      setPendingDateCompletion({ goalId, isoDate, defaultAmount: suggestedAmount(goal) });
      return;
    }
    setGoals((prev) => {
      const updated = toggleGoalDate(prev, goalId, isoDate);
      saveGoals(updated);
      return updated;
    });
  }, [goals]);

  const title = getViewTitle(calendar.view, calendar.selectedDate, calendar.selectedDate, today, preferences.weekStartsOn);
  const month = buildMonthView(calendar.selectedDate, calendar.selectedDate, today, metadataByDate, preferences.weekStartsOn);
  const week = buildWeekView(calendar.selectedDate, today, metadataByDate, preferences.weekStartsOn);
  const relativeLabel = getRelativeDayLabel(calendar.selectedDate, today);
  const isMonthView = calendar.view === "month";
  const selectedLocation = getCalendarLocationByKey(preferences.locationKey);
  const monthSubtitle = selectedLocation
    ? `${selectedLocation.label} Shabbos times are shown on Fridays and Saturdays.`
    : "Select a location to add Friday candle-lighting, Saturday Shabbos end, and parsha.";
  const hebrewYear = preferences.showHebrewDates
    ? getHebrewYearLabel(calendar.selectedDate)
    : undefined;

  return (
    <div className={isMonthView ? "space-y-5" : "space-y-8"}>
      <CalendarHeader
        view={calendar.view}
        onViewChange={calendar.setView}
        onPrev={calendar.goToPrevious}
        onNext={calendar.goToNext}
        onToday={calendar.jumpToToday}
        title={title.title}
        subtitle={isMonthView ? monthSubtitle : title.subtitle}
        hebrewYear={hebrewYear}
        actionsSlot={
          <CalendarSettingsMenu
            preferences={preferences}
            onPreferenceChange={updatePreference}
            onReset={resetPreferences}
          />
        }
      />

      <div className={cn(
        "rounded-3xl bg-slate-100 p-3",
        activeGoalId ? "overflow-visible" : "overflow-hidden",
      )}>
        <DndContext
          sensors={sensors}

          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveGoalId(null)}
        >
          {/* Goal Library — persistent collapsible */}
          <div className="mb-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center px-4 py-3">
              {/* Left: title + badge — clickable to toggle */}
              <button
                type="button"
                onClick={() => { const next = !trayOpen; setTrayOpen(next); localStorage.setItem("goal-tray-open", String(next)); }}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition-colors hover:opacity-80"
              >
                <span className="text-[13px] font-semibold text-slate-700">Goal Library</span>
                {goals.filter((g) => !g.adhoc && g.status !== "paused" && g.status !== "done").length > 0 && (
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                    {goals.filter((g) => !g.adhoc && g.status !== "paused" && g.status !== "done").length}
                  </span>
                )}
              </button>

              {/* Right: filter icon + chevron */}
              <div className="flex items-center gap-2">
                {/* Filter settings icon */}
                <div ref={trayFilterMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setTrayFilterMenuOpen((s) => !s)}
                    className={cn(
                      "rounded-md p-1 transition-colors",
                      trayFilter !== "all" ? "text-brand" : "text-slate-400 hover:text-slate-600",
                    )}
                    title="Filter goals"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
                    </svg>
                  </button>
                  {trayFilterMenuOpen && (
                    <div className="absolute right-0 top-7 z-50 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                      {(["all", "hide-done", "hide-allocated"] as const).map((value) => {
                        const label = value === "all" ? "Show all" : value === "hide-done" ? "Hide done" : "Hide allocated";
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => { setTrayFilter(value); setTrayFilterMenuOpen(false); }}
                            className={cn(
                              "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-slate-50",
                              trayFilter === value ? "font-semibold text-brand" : "text-slate-600",
                            )}
                          >
                            <span className={cn("h-[7px] w-[7px] rounded-full border", trayFilter === value ? "border-brand bg-brand" : "border-slate-300")} />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Collapse chevron */}
                <button
                  type="button"
                  onClick={() => { const next = !trayOpen; setTrayOpen(next); localStorage.setItem("goal-tray-open", String(next)); }}
                  className="rounded-md p-1 text-slate-400 transition-colors hover:text-slate-600"
                >
                  <svg width="14" height="8" viewBox="0 0 14 8" fill="none" className={cn("transition-transform duration-200", trayOpen && "rotate-180")}>
                    <path d="M1 1L7 7L13 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>

            {trayOpen && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                <GoalTray
                  goals={goals}
                  dayAssignments={dayAssignments}
                  selectedDate={calendar.selectedDate}
                  view={calendar.view === "month" ? "month" : "week"}
                  weekStartsOn={preferences.weekStartsOn}
                  filter={trayFilter}
                />
              </div>
            )}
          </div>
          <div className={cn(
            "rounded-2xl border border-slate-200/80 bg-white shadow-sm",
            calendar.view === "day" ? "p-4" : "p-4 md:p-5",
          )}>
            {calendar.view === "month" ? (
              <MonthGrid
                month={month}
                onSelectDate={(d) => { calendar.setSelectedDate(d); setSidePanelDate(d); }}
                onDoubleClickDate={(d) => { calendar.setSelectedDate(d); calendar.setView("day"); }}
                showOutsideMonthDays={preferences.showOutsideMonthDays}
                weekStartsOn={preferences.weekStartsOn}
              />
            ) : null}
            {calendar.view === "week" ? (
              <WeekGrid
                week={week}
                goals={goals}
                excludedByGoal={excludedByGoal}
                onToggleDate={handleToggleDate}
                planMode={trayOpen}
                dayAssignments={dayAssignments}
                onToggleAssignment={handleToggleAssignment}
                onRemoveAssignment={handleUnassign}
                onAddTask={handleAddTask}
                weekStartsOn={preferences.weekStartsOn}
                showOmer={preferences.showOmer}
                completedOmerDates={completedOmerDates}
                onToggleOmer={handleToggleOmer}
                goalOrder={goalOrder}
                onReorderGoals={handleReorderGoals}
                todayZmanim={todayZmanim ?? undefined}
              />
            ) : null}
            {calendar.view === "day" ? (
              <DayFocus
                date={calendar.selectedDate}
                relativeLabel={relativeLabel}
                goals={goals}
                dayAssignments={dayAssignments}
                excludedByGoal={excludedByGoal}
                metadata={metadataByDate.get(toIsoDate(calendar.selectedDate))}
                onToggleDate={handleToggleDate}
                onToggleAssignment={handleToggleAssignment}
                onRemoveAssignment={handleUnassign}
                onAddTask={handleAddTask}
                onSetScheduledTime={handleSetScheduledTime}
                onNavigateToDate={(d) => { calendar.setSelectedDate(d); calendar.setView("day"); }}
                showOmer={preferences.showOmer}
                completedOmerDates={completedOmerDates}
                onToggleOmer={handleToggleOmer}
                zmanim={dayZmanim ?? undefined}
                timeFormat={preferences.timeFormat}
                timelineSnapMins={preferences.timelineSnapMins}
                timelineDefaultDurationMins={preferences.timelineDefaultDurationMins}
                onTimelinePreferenceChange={(key, value) => updatePreference(key, value as never)}
                onSetDuration={handleSetDuration}
                goalOrder={goalOrder}
                onReorderGoals={handleReorderGoals}
              />
            ) : null}
          </div>

          {/* Cap-blocked dialog */}
          {capBlockedGoal && (() => {
            const goal = goals.find((g) => g.id === capBlockedGoal.goalId);
            if (!goal) return null;
            return (
              <CapBlockedPrompt
                goal={goal}
                onEditPolicy={() => { setCapBlockedGoal(null); router.push("/goals"); }}
                onDismiss={() => setCapBlockedGoal(null)}
              />
            );
          })()}

          {/* Amount prompt for quantified goals */}
          {pendingAssignment && (() => {
            const goal = goals.find((g) => g.id === pendingAssignment.goalId);
            const day = week.days.find((d) => d.iso === pendingAssignment.isoDate);
            if (!goal || !day) return null;
            const dayLabel = day.date.toLocaleDateString("en-US", { weekday: "long" });
            return (
              <AmountPrompt
                goal={goal}
                dayLabel={dayLabel}
                defaultAmount={pendingAssignment.suggestedAmount}
                maxAmount={pendingAssignment.maxAmount}
                onConfirm={(amount) => {
                  const pGoal = goals.find((g) => g.id === pendingAssignment.goalId);
                  const pKey = pGoal ? computePeriodKey(pGoal.cadence, new Date(pendingAssignment.isoDate + "T00:00:00")) : undefined;
                  handleAssign(pendingAssignment.goalId, pendingAssignment.isoDate, amount, pKey, pendingAssignment.replacedAutoDate);
                  setPendingAssignment(null);
                }}
                onCancel={() => setPendingAssignment(null)}
              />
            );
          })()}

          {/* Amount prompt when checking off a quantified assignment */}
          {pendingCompletion && (() => {
            const goal = goals.find((g) => g.id === dayAssignments.find((a) => a.id === pendingCompletion.id)?.goalId);
            if (!goal) return null;
            const maxAmount = goal.noGettingAhead && goal.target !== undefined
              ? computeRemainingCapacity(goal, dayAssignments, calendar.selectedDate)
              : undefined;
            return (
              <AmountPrompt
                goal={goal}
                dayLabel={pendingCompletion.date}
                defaultAmount={pendingCompletion.defaultAmount}
                maxAmount={maxAmount}
                onConfirm={(amount) => {
                  const id = pendingCompletion.id;
                  setPendingCompletion(null);
                  setDayAssignments((prev) => {
                    const now = new Date();
                    const hh = now.getHours().toString().padStart(2, "0");
                    const mm = now.getMinutes().toString().padStart(2, "0");
                    const timeStr = `${hh}:${mm}`;
                    const updated = prev.map((a) => {
                      if (a.id !== id) return a;
                      return {
                        ...a,
                        targetAmount: amount,
                        completed: true,
                        completedAt: a.scheduledTime ?? timeStr,
                        scheduledTime: a.scheduledTime ?? timeStr,
                      };
                    });
                    saveDayAssignments(updated);
                    return updated;
                  });
                  // Feed progress back to parent project goal if applicable
                  const assignment = dayAssignments.find((a) => a.id === id);
                  if (goal.parentGoalId && assignment) {
                    const delta = amount;
                    setGoals((prev) => {
                      const updated = updateParentProgress(prev, goal.parentGoalId!, delta);
                      saveGoals(updated);
                      return updated;
                    });
                  }
                }}
                onCancel={() => setPendingCompletion(null)}
              />
            );
          })()}

          {/* Amount prompt when checking off a quantified auto-show goal (date-toggle path) */}
          {pendingDateCompletion && (() => {
            const goal = goals.find((g) => g.id === pendingDateCompletion.goalId);
            if (!goal) return null;
            return (
              <AmountPrompt
                goal={goal}
                dayLabel={pendingDateCompletion.isoDate}
                defaultAmount={pendingDateCompletion.defaultAmount}
                onConfirm={(amount) => {
                  const { goalId, isoDate } = pendingDateCompletion;
                  setPendingDateCompletion(null);
                  // Create a completed DayAssignment so the amount is tracked
                  const periodKey = computePeriodKey(goal.cadence, new Date(isoDate + "T00:00:00"));
                  const now = new Date();
                  const hh = now.getHours().toString().padStart(2, "0");
                  const mm = now.getMinutes().toString().padStart(2, "0");
                  const timeStr = `${hh}:${mm}`;
                  setDayAssignments((prev) => {
                    // Skip if already assigned (avoids duplicates)
                    if (prev.some((a) => a.goalId === goalId && a.date === isoDate)) return prev;
                    const newAssignment = {
                      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                      goalId,
                      date: isoDate,
                      targetAmount: amount,
                      periodKey: periodKey ?? undefined,
                      completed: true,
                      completedAt: timeStr,
                    };
                    const updated = [...prev, newAssignment];
                    saveDayAssignments(updated);
                    return updated;
                  });
                }}
                onCancel={() => setPendingDateCompletion(null)}
              />
            );
          })()}

          {/* DragOverlay renders in a portal at body root — escapes all overflow containers */}
          <DragOverlay dropAnimation={null}>
            {activeGoalId ? (() => {
              const g = goals.find((gl) => gl.id === activeGoalId);
              if (!g) return null;
              return (
                <div className="flex cursor-grabbing select-none items-center gap-2 rounded-xl border border-brand/30 bg-white px-3 py-2 shadow-xl ring-1 ring-brand/20">
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand/60" />
                  <span className="text-[13px] font-semibold text-slate-800">{g.title}</span>
                </div>
              );
            })() : null}
          </DragOverlay>

        </DndContext>
      </div>

      {/* Day side panel — opens on single-click in month view */}
      <Drawer
        open={sidePanelDate !== null}
        onClose={() => setSidePanelDate(null)}
        subtitle="Day Overview"
        title={sidePanelDate ? sidePanelDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : ""}
      >
        {sidePanelDate && (
          <DayPanelContent
            date={sidePanelDate}
            metadata={metadataByDate.get(toIsoDate(sidePanelDate))}
            goals={goals}
            dayAssignments={dayAssignments}
            excludedByGoal={excludedByGoal}
            onToggleAssignment={handleToggleAssignment}
            onToggleDate={handleToggleDate}
            goalOrder={goalOrder}
            onReorderGoals={handleReorderGoals}
            onNavigate={() => {
              calendar.setSelectedDate(sidePanelDate);
              calendar.setView("day");
              setSidePanelDate(null);
            }}
          />
        )}
      </Drawer>
    </div>
  );
}
