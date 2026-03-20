"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
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
  useSensor, useSensors, MouseSensor, TouchSensor,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { GoalTray } from "@/features/planner/components/goal-tray";
import {
  loadDayAssignments,
  saveDayAssignments,
  createAssignment,
  type DayAssignment,
} from "@/features/planner/lib/day-assignment-store";
import type { Goal } from "@/features/goals/types/goal";
import { computePeriodKey } from "@/features/planner/lib/period-key";
import { toggleGoalDate } from "@/features/goals/lib/goal-mutations";
import { computeRemainingCapacity } from "@/features/planner/lib/assignment-rules";


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
}: {
  goal: Goal;
  dayLabel: string;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
  maxAmount?: number;
}) {
  const [value, setValue] = useState("1");
  const clamp = (n: number) => Math.min(maxAmount ?? Infinity, Math.max(1, n));
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-72 rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/10">
        <p className="text-[13.5px] font-bold text-slate-800">
          How many {goal.targetUnit ?? "units"}?
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

  // Start open (matches SSR); sync from localStorage after hydration to avoid mismatch
  const [trayOpen, setTrayOpen] = useState(true);
  useEffect(() => {
    const saved = localStorage.getItem("goal-tray-open");
    if (saved !== null) setTrayOpen(saved === "true");
  }, []);
  const [pendingAssignment, setPendingAssignment] = useState<{ goalId: string; isoDate: string; maxAmount?: number } | null>(null);
  const [capBlockedGoal, setCapBlockedGoal] = useState<{ goalId: string } | null>(null);
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );
  useEffect(() => {
    setGoals(loadGoals());
    setDayAssignments(loadDayAssignments());
  }, []);

  const dayZmanim = useMemo(() => {
    if (calendar.view !== "day") return null;
    const locationOption = getCalendarLocationByKey(preferences.locationKey);
    if (!locationOption) return null;
    const location = Location.lookup(locationOption.lookupName);
    if (!location) return null;
    return computeDayZmanim(calendar.selectedDate, location, preferences.timeFormat);
  }, [calendar.view, calendar.selectedDateIso, preferences.locationKey, preferences.timeFormat]);

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
        const progress = computeDayProgress(goals, new Date(cursor), excludedByGoal);
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
    const goalIdSet = new Set(goals.map((g) => g.id));
    for (const assignment of dayAssignments) {
      if (!goalIdSet.has(assignment.goalId)) continue; // skip orphaned assignments
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
        setGoals((prev) =>
          prev.map((g) => {
            if (g.id !== assignment.goalId) return g;
            const dates = g.completedDates ?? [];
            const updated = dates.includes(assignment.date)
              ? dates.filter((d) => d !== assignment.date)
              : [...dates, assignment.date];
            return { ...g, completedDates: updated };
          }),
        );
      }
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
          completedAt: nowCompleted ? timeStr : undefined,
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

      if (activeId.startsWith("assignment:") || activeId.startsWith("timeline:")) {
        // Existing assignment dragged to a different slot → update scheduledTime
        const assignmentId = activeId.startsWith("assignment:")
          ? activeId.slice("assignment:".length)
          : activeId.slice("timeline:".length);
        handleSetScheduledTime(assignmentId, timeStr);
      } else if (activeId.startsWith("daily:")) {
        // Daily goal dragged from checklist to timeline → create assignment with scheduledTime
        // The assignment will suppress the auto-show in dailyGoals and appear in assignedItems instead
        const goalId = activeId.slice("daily:".length);
        const goal = goals.find((g) => g.id === goalId);
        if (!goal) return;
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

    // Assignment drag → move to new day
    if (activeId.startsWith("assignment:") || activeId.startsWith("timeline:")) {
      const assignmentId = activeId.startsWith("assignment:")
        ? activeId.slice("assignment:".length)
        : activeId.slice("timeline:".length);
      if (isoDate) handleMoveAssignment(assignmentId, isoDate);
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
      const periodKey = computePeriodKey(goal.cadence, new Date(isoDate + "T00:00:00"));
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
        setPendingAssignment({ goalId, isoDate, maxAmount: remaining });
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
      setPendingAssignment({ goalId, isoDate });
    } else if (goal.cadence === "monthly" && goal.preferredMonthDay !== undefined) {
      handleAssign(goalId, getPreferredMonthDate(isoDate, goal.preferredMonthDay), undefined, periodKey);
    } else {
      handleAssign(goalId, isoDate, undefined, periodKey);
    }
  }, [goals, dayAssignments, preferences, handleAssign, handleMoveAssignment, handleSetScheduledTime, calendar.selectedDate]);

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
    setGoals((prev) => {
      const updated = toggleGoalDate(prev, goalId, isoDate);
      saveGoals(updated);
      return updated;
    });
  }, []);

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
            <button
              type="button"
              onClick={() => {
                const next = !trayOpen;
                setTrayOpen(next);
                localStorage.setItem("goal-tray-open", String(next));
              }}
              className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-slate-50/60"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[13px] font-semibold text-slate-700">Goal Library</span>
                {goals.filter((g) => !g.adhoc && g.status !== "paused" && g.status !== "done").length > 0 && (
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                    {goals.filter((g) => !g.adhoc && g.status !== "paused" && g.status !== "done").length}
                  </span>
                )}
              </div>
              <svg
                width="14"
                height="8"
                viewBox="0 0 14 8"
                fill="none"
                className={cn("text-slate-400 transition-transform duration-200", trayOpen && "rotate-180")}
              >
                <path d="M1 1L7 7L13 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {trayOpen && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                <GoalTray
                  goals={goals}
                  dayAssignments={dayAssignments}
                  selectedDate={calendar.selectedDate}
                  view={calendar.view === "month" ? "month" : "week"}
                  weekStartsOn={preferences.weekStartsOn}
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
                onSelectDate={calendar.setSelectedDate}
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
                maxAmount={pendingAssignment.maxAmount}
                onConfirm={(amount) => {
                  const pGoal = goals.find((g) => g.id === pendingAssignment.goalId);
                  const pKey = pGoal ? computePeriodKey(pGoal.cadence, new Date(pendingAssignment.isoDate + "T00:00:00")) : undefined;
                  handleAssign(pendingAssignment.goalId, pendingAssignment.isoDate, amount, pKey);
                  setPendingAssignment(null);
                }}
                onCancel={() => setPendingAssignment(null)}
              />
            );
          })()}

        </DndContext>
      </div>
    </div>
  );
}
