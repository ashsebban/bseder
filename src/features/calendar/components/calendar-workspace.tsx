"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";
import { useCalendarRouterState } from "@/features/calendar/hooks/use-calendar-router-state";
import { getRelativeDayLabel, startOfDay } from "@/features/calendar/lib/date";
import { getHebrewYearLabel } from "@/features/calendar/lib/jewish-times";
import { resolveAssignmentsForAction, suggestedAssignmentAmount } from "@/features/calendar/lib/assignment-actions";
import { computeDayZmanim } from "@/features/calendar/lib/zmanim";
import { startOfMonth, endOfMonth, startOfWeek, toIsoDate } from "@/features/calendar/lib/date";
import { resolveLocation, getCalendarLocationByKey } from "@/features/calendar/lib/locations";
import { buildMonthView, buildWeekView, getViewTitle } from "@/features/calendar/lib/view-models";
import { CalendarHeader } from "@/features/calendar/components/calendar-header";
import { MonthGrid } from "@/features/calendar/components/month-grid";
import { WeekGrid } from "@/features/calendar/components/week-grid";
import { DayFocus } from "@/features/calendar/components/day-focus";
import { EditableGoalTitle, GoalListRow } from "@/features/calendar/components/goal-list-row";
import { DailyBacklogBadge } from "@/components/planner/daily-backlog-badge";
import {
  buildGoalOccurrencesForDate,
  sortGoalOccurrences,
  type GoalOccurrence,
} from "@/features/calendar/lib/goal-occurrences";
import { isTimeInGoalWindowFraction } from "@/features/calendar/lib/goal-time-window";
import { CalendarSettingsMenu } from "@/features/settings/components/calendar-settings-menu";
import { useSyncedCalendarPreferences } from "@/features/settings/hooks/use-synced-calendar-preferences";
import {
  DndContext,
  DragOverlay,
  type Modifier,
  pointerWithin,
  rectIntersection,
  useSensor, useSensors, MouseSensor, TouchSensor,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { GoalTray } from "@/features/planner/components/goal-tray";
import { type DayAssignment } from "@/features/planner/lib/day-assignment-store";
import { parseSessionGroupActionId } from "@/features/planner/lib/day-assignment-groups";
import type { Goal } from "@/features/goals/types/goal";
import { computePeriodKey } from "@/features/planner/lib/period-key";
import { computeRemainingCapacity } from "@/features/planner/lib/assignment-rules";
import { getDailyBacklogEntries, type DailyBacklogEntry } from "@/features/goals/lib/daily-backlog";
import { Drawer } from "@/components/ui/drawer";
import type { CalendarDayMetadata } from "@/features/calendar/types/calendar";
import { CalendarMetaPills, buildCalendarMetaPills } from "@/components/planner/calendar-meta-pills";
import { PlannerModalCard } from "@/components/planner/planner-modal-card";
import { ReorderGrip } from "@/components/planner/reorder-grip";
import { TaskListEmptyState } from "@/components/planner/inline-add-task";
import type { CalendarPreferences } from "@/features/settings/types/calendar-preferences";
import { useCalendarData } from "@/features/calendar/hooks/use-calendar-data";


const TIMELINE_START_HOUR = 0;

function getGoalIdFromDragId(dragId: string): string | null {
  if (dragId.startsWith("daily:")) return dragId.slice("daily:".length);
  if (dragId.startsWith("weekly:")) {
    const rest = dragId.slice("weekly:".length);
    const lastColon = rest.lastIndexOf(":");
    return lastColon === -1 ? rest : rest.slice(0, lastColon);
  }
  if (
    dragId.startsWith("assignment:") ||
    dragId.startsWith("timeline:") ||
    dragId.startsWith("checklist-collapsed:")
  ) {
    return null;
  }
  return dragId;
}

function getEventClientPoint(event: Event | null): { x: number; y: number } | null {
  if (!event) return null;
  if (event instanceof MouseEvent || event instanceof PointerEvent) {
    return { x: event.clientX, y: event.clientY };
  }
  if (event instanceof TouchEvent) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    if (!touch) return null;
    return { x: touch.clientX, y: touch.clientY };
  }
  return null;
}

const overlayNearPointerModifier: Modifier = ({
  activatorEvent,
  activeNodeRect,
  overlayNodeRect,
  transform,
}) => {
  if (!activeNodeRect || !overlayNodeRect) return transform;
  const point = getEventClientPoint(activatorEvent);
  if (!point) return transform;

  const initialOffsetX = point.x - activeNodeRect.left;
  const initialOffsetY = point.y - activeNodeRect.top;
  const desiredOffsetX = Math.min(26, Math.max(14, overlayNodeRect.width * 0.18));
  const desiredOffsetY = Math.min(
    overlayNodeRect.height - 8,
    Math.max(12, overlayNodeRect.height * 0.55),
  );

  return {
    ...transform,
    x: transform.x + (initialOffsetX - desiredOffsetX),
    y: transform.y + (initialOffsetY - desiredOffsetY),
  };
};

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
  const [value, setValue] = useState(() => {
    const raw = defaultAmount ?? 1;
    const clamped = maxAmount !== undefined ? Math.min(maxAmount, Math.max(1, raw)) : Math.max(1, raw);
    return String(clamped);
  });
  const clamp = (n: number) => Math.min(maxAmount ?? Infinity, Math.max(1, n));
  return (
    <PlannerModalCard
      title={title ?? `How many ${goal.targetUnit ?? "units"}?`}
      subtitle={<>{goal.title} → {dayLabel}</>}
      onClose={onCancel}
      widthClassName="w-72"
      actions={[
        { label: "Cancel", onClick: onCancel, variant: "secondary" },
        {
          label: `Add to ${dayLabel.split(",")[0]}`,
          onClick: () => onConfirm(clamp(Number(value) || 1)),
          variant: "primary",
          disabled: maxAmount === 0,
        },
      ]}
    >
      {maxAmount === 0 ? (
        <p className="mt-4 text-[12px] text-slate-500">
          There&apos;s nothing left to enter for this session.
        </p>
      ) : (
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
      )}
    </PlannerModalCard>
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
    <PlannerModalCard
      title={`All planned for this ${period}`}
      subtitle={(
        <>
          <span className="font-semibold">{goal.title}</span> already has {effectiveCap} {unit}
          {effectiveCap !== 1 ? "s" : ""} planned — the full {period}ly allocation.
        </>
      )}
      onClose={onDismiss}
      widthClassName="w-80"
      actions={[
        { label: "Dismiss", onClick: onDismiss, variant: "secondary" },
        { label: "Edit Policy", onClick: onEditPolicy, variant: "primary" },
      ]}
    >
      <p className="mt-2 text-[11.5px] text-slate-400">
        To add more, update the cap in your goal settings.
      </p>
    </PlannerModalCard>
  );
}

function SortablePanelGoalItem({
  item,
  iso,
  allIds,
  onToggleDate,
  onToggleAssignment,
  onReorderGoals,
  onRenameGoal,
  backlogEntriesByGoal,
}: {
  item: GoalOccurrence;
  iso: string;
  allIds: string[];
  onToggleDate: (goalId: string, isoDate: string) => void;
  onToggleAssignment: (id: string) => void;
  onReorderGoals: (prev: string[], next: string[]) => void;
  onRenameGoal: (goalId: string, nextTitle: string) => void;
  backlogEntriesByGoal: Map<string, DailyBacklogEntry[]>;
}) {
  const done = item.completed;

  function handleToggle() {
    if (item.source === "assignment") onToggleAssignment(item.actionId);
    else onToggleDate(item.goal.id, iso);
  }

  return (
    <GoalListRow
      density="panel"
      leading={(
        <ReorderGrip
          itemId={item.goal.id}
          itemIds={allIds}
          onReorder={onReorderGoals}
          rowStepPx={44}
          iconWidth={10}
          iconHeight={14}
          className="text-slate-200 hover:text-slate-400"
        />
      )}
      checkbox={(
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
      )}
      content={(
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <EditableGoalTitle
              title={item.goal.title}
              onRename={(nextTitle) => onRenameGoal(item.goal.id, nextTitle)}
              className={cn("truncate text-[13px] font-semibold", done ? "text-slate-400 line-through" : "text-slate-800")}
              inputClassName="text-[13px] font-semibold"
              suffix={item.goal.type === "quantified" && item.displayAmount > 0 ? (
                <span className="ml-1 font-normal text-brand/70">
                  · {item.displayAmount} {item.goal.targetUnit ?? "units"}
                </span>
              ) : undefined}
            />
            <DailyBacklogBadge
              goalTitle={item.goal.title}
              entries={backlogEntriesByGoal.get(item.goal.id) ?? []}
              onResolveDate={(isoDate) => onToggleDate(item.goal.id, isoDate)}
              compact
            />
          </div>
          {item.programLabel ? (
            <p className="mt-1 truncate text-[11px] text-slate-500">{item.programLabel}</p>
          ) : null}
        </div>
      )}
    />
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
  onRenameGoal,
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
  onRenameGoal: (goalId: string, nextTitle: string) => void;
}) {
  const iso = toIsoDate(date);
  const backlogToday = toIsoDate(new Date());
  const backlogEntriesByGoal = useMemo(
    () => new Map(goals.map((goal) => [goal.id, getDailyBacklogEntries(goal, new Date())])),
    [goals, backlogToday],
  );
  const allItems = sortGoalOccurrences(
    buildGoalOccurrencesForDate({
      date,
      goals,
      dayAssignments,
      excludedByGoal,
    }),
    goalOrder,
  );

  const itemIds = [...new Set(allItems.map((i) => i.goal.id))];
  const timePills = buildCalendarMetaPills(metadata);

  return (
    <div className="flex flex-col gap-5">
      {/* Hebrew date + zmanim */}
      {metadata && (
        <div className="flex flex-wrap items-center gap-2">
          {metadata.hebrewDateLabel && (
            <span className="text-[13px] font-semibold text-slate-500">{metadata.hebrewDateLabel}</span>
          )}
          <CalendarMetaPills pills={timePills} density="inline" orientation="horizontal" align="start" />
        </div>
      )}

      {/* Goals for this day */}
      <div className="flex flex-col gap-2">
        {allItems.length === 0 ? (
          <TaskListEmptyState message="No goals scheduled — drag from the Goal Library" className="text-[13px]" />
        ) : (
          <>{allItems.map((item) => (
            <SortablePanelGoalItem
              key={item.id}
              item={item}
              iso={iso}
              allIds={itemIds}
              onToggleDate={onToggleDate}
              onToggleAssignment={onToggleAssignment}
              onReorderGoals={onReorderGoals}
              onRenameGoal={onRenameGoal}
              backlogEntriesByGoal={backlogEntriesByGoal}
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


export function CalendarWorkspace({
  initialPreferences,
  storageScope,
}: {
  initialPreferences?: Partial<CalendarPreferences>;
  storageScope: string;
}) {
  const router = useRouter();
  const calendar = useCalendarRouterState();
  const { preferences, hydrated, updatePreference, resetPreferences, saveState } = useSyncedCalendarPreferences(initialPreferences, storageScope);
  const today = startOfDay(new Date());

  const {
    goals,
    assignments: plannerDayAssignments,
    goalOrder,
    excludedByGoal,
    metadataByDate,
    amountPrompt,
    capBlockedGoal,
    assign,
    assignWithTime,
    assignReplacing,
    assignAlreadyCompleted,
    unassign,
    moveAssignment,
    toggleAssignment,
    toggleDate,
    setScheduledTime,
    unscheduleAssignment,
    setDuration,
    reorderGoals,
    renameGoal,
    addTask,
    confirmAmountPrompt,
    clearPending,
    openCapBlockedModal,
    openAssignmentModal,
  } = useCalendarData({ storageScope, calendar, preferences });

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
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const dayZmanim = useMemo(() => {
    if (calendar.view !== "day") return null;
    const location = resolveLocation(preferences);
    if (!location) return null;
    return computeDayZmanim(calendar.selectedDate, location, preferences.timeFormat);
  }, [calendar.view, calendar.selectedDateIso, preferences.locationKey, preferences.customLocation, preferences.timeFormat]);

  // Zmanim for today — used in week view to dim expired goals in the today column
  const todayZmanim = useMemo(() => {
    if (calendar.view !== "week") return null;
    const location = resolveLocation(preferences);
    if (!location) return null;
    return computeDayZmanim(today, location, preferences.timeFormat);
  }, [calendar.view, preferences.locationKey, preferences.customLocation, preferences.timeFormat]);

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
        const [hh, mm] = hhmm.split(":").map(Number);
        return isTimeInGoalWindowFraction(goal, dayZmanim ?? undefined, hh + mm / 60);
      };

      if (activeId.startsWith("assignment:") || activeId.startsWith("timeline:")) {
        const assignmentId = activeId.startsWith("assignment:")
          ? activeId.slice("assignment:".length)
          : activeId.slice("timeline:".length);
        const assignment = plannerDayAssignments.find((a) => a.id === assignmentId);
        const goal = assignment ? goals.find((g) => g.id === assignment.goalId) : undefined;
        if (goal && !isTimeInGoalWindow(goal, timeStr)) return;
        setScheduledTime(assignmentId, timeStr);
      } else if (activeId.startsWith("daily:")) {
        // Checklist goal dragged to timeline → create a scheduled assignment.
        // If the goal is already done for this date, keep it done and just add the time visualization.
        const goalId = activeId.slice("daily:".length);
        const goal = goals.find((g) => g.id === goalId);
        if (!goal) return;
        if (!isTimeInGoalWindow(goal, timeStr)) return;
        const periodKey = goal.cadence === "daily"
          ? undefined
          : computePeriodKey(goal.cadence, new Date(dayIso + "T00:00:00"));
        const alreadyDone = goal.completedDates?.includes(dayIso) ?? false;
        if (alreadyDone) {
          assignAlreadyCompleted(goalId, dayIso, periodKey, timeStr, preferences.timelineDefaultDurationMins);
          return;
        }
        assignWithTime(goalId, dayIso, timeStr, preferences.timelineDefaultDurationMins);
      } else {
        const goalId = activeId;
        const goal = goals.find((g) => g.id === goalId);
        if (!goal) return;
        assignWithTime(goalId, dayIso, timeStr, preferences.timelineDefaultDurationMins);
      }
      return;
    }

    // Assignment drag → move to new day (blocked if goal is locked)
    if (
      activeId.startsWith("assignment:") ||
      activeId.startsWith("timeline:") ||
      parseSessionGroupActionId(activeId) !== null
    ) {
      const assignmentId = activeId.startsWith("assignment:")
        ? activeId.slice("assignment:".length)
        : activeId.startsWith("timeline:")
          ? activeId.slice("timeline:".length)
          : activeId;
      if (isoDate) {
        const assignments = resolveAssignmentsForAction(plannerDayAssignments, assignmentId);
        const assignment = assignments[0];
        const goal = assignment ? goals.find((g) => g.id === assignment.goalId) : undefined;
        if (!goal?.lockInDays) moveAssignment(assignmentId, isoDate);
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
      if (goal.type === "quantified" && goal.targetUnit) {
        const suggested = suggestedAssignmentAmount(goal);
        if (goal.noGettingAhead && goal.target !== undefined) {
          const remaining = computeRemainingCapacity(goal, plannerDayAssignments, calendar.selectedDate);
          const perDayTarget = Math.ceil(goal.target / (goal.activeDays?.length ?? 1));
          const effectiveRemaining = remaining + perDayTarget;
          if (effectiveRemaining < suggested) {
            openAssignmentModal({ goalId, isoDate, suggestedAmount: suggested, maxAmount: effectiveRemaining, replacedAutoDate: sourceIso });
            return;
          }
        }
        assign(goalId, isoDate, suggested, periodKey, sourceIso);
        return;
      }
      assignReplacing(goalId, isoDate, sourceIso);
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
      const remaining = computeRemainingCapacity(goal, plannerDayAssignments, calendar.selectedDate);
      if (remaining <= 0) {
        openCapBlockedModal(goalId);
        return;
      }
      if (goal.type === "quantified" && goal.targetUnit) {
        openAssignmentModal({ goalId, isoDate, maxAmount: remaining, suggestedAmount: suggestedAssignmentAmount(goal) });
        return;
      }
      if (goal.cadence === "monthly" && goal.preferredMonthDay !== undefined) {
        assign(goalId, getPreferredMonthDate(isoDate, goal.preferredMonthDay), undefined, periodKey);
      } else {
        assign(goalId, isoDate, undefined, periodKey);
      }
      return;
    }

    if (goal.type === "quantified" && goal.targetUnit) {
      openAssignmentModal({ goalId, isoDate, suggestedAmount: suggestedAssignmentAmount(goal) });
    } else if (goal.cadence === "monthly" && goal.preferredMonthDay !== undefined) {
      assign(goalId, getPreferredMonthDate(isoDate, goal.preferredMonthDay), undefined, periodKey);
    } else {
      assign(goalId, isoDate, undefined, periodKey);
    }
  }, [goals, plannerDayAssignments, preferences, dayZmanim, assign, assignAlreadyCompleted, moveAssignment, setScheduledTime, openAssignmentModal, openCapBlockedModal, calendar.selectedDate]);

  const title = getViewTitle(calendar.view, calendar.selectedDate, calendar.selectedDate, today, preferences.weekStartsOn);
  const month = buildMonthView(calendar.selectedDate, calendar.selectedDate, today, metadataByDate, preferences.weekStartsOn);
  const week = buildWeekView(calendar.selectedDate, today, metadataByDate, preferences.weekStartsOn);
  const relativeLabel = getRelativeDayLabel(calendar.selectedDate, today);
  const isMonthView = calendar.view === "month";
  const selectedLocation = getCalendarLocationByKey(preferences.locationKey);
  const locationLabel =
    selectedLocation?.label ??
    (preferences.customLocation?.label) ??
    null;
  const monthSubtitle = locationLabel
    ? `${locationLabel} Shabbos times are shown on Fridays and Saturdays.`
    : "Select a location to add Friday candle-lighting, Saturday Shabbos end, and parsha.";
  const hebrewYear = preferences.showHebrewDates
    ? getHebrewYearLabel(calendar.selectedDate)
    : undefined;
  const selectedIso = toIsoDate(calendar.selectedDate);
  const goalLibraryCount = goals.filter((goal) => {
    if (goal.adhoc || goal.status === "paused" || goal.status === "done") return false;
    // Calendar-only seasonal visibility: active window must include selected date.
    if (!goal.endDate) return true;
    if (goal.startDate && selectedIso < goal.startDate) return false;
    if (selectedIso > goal.endDate) return false;
    return true;
  }).length;

  return (
    <div className={isMonthView ? "space-y-5" : "space-y-8"}>
      <CalendarHeader
        view={calendar.view}
        onViewChange={calendar.setView}
        onPrev={calendar.goToPrevious}
        onNext={calendar.goToNext}
        onToday={calendar.jumpToToday}
        onJumpToDate={(date) => {
          if (calendar.view === "week") {
            calendar.setSelectedDate(startOfWeek(date, preferences.weekStartsOn));
            return;
          }
          calendar.setSelectedDate(date);
        }}
        title={title.title}
        subtitle={isMonthView ? monthSubtitle : title.subtitle}
        selectedDate={calendar.selectedDate}
        hebrewYear={hebrewYear}
        actionsSlot={
          <CalendarSettingsMenu
            preferences={preferences}
            onPreferenceChange={updatePreference}
            onReset={resetPreferences}
            saveState={saveState}
          />
        }
      />

      <div className={cn(
        "rounded-3xl bg-slate-100 p-2.5 md:p-3",
        activeGoalId ? "overflow-visible" : "overflow-hidden",
      )}>
        <DndContext
          sensors={sensors}
          collisionDetection={(args) => {
            const pointerCollisions = pointerWithin(args);
            return pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
          }}
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
                {goalLibraryCount > 0 && (
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                    {goalLibraryCount}
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
                  dayAssignments={plannerDayAssignments}
                  selectedDate={calendar.selectedDate}
                  view={calendar.view === "month" ? "month" : "week"}
                  weekStartsOn={preferences.weekStartsOn}
                  filter={trayFilter}
                  onRenameGoal={renameGoal}
                  onToggleDate={toggleDate}
                />
              </div>
            )}
          </div>
          <div className={cn(
            "rounded-2xl border border-slate-200/80 bg-white shadow-sm",
            calendar.view === "day"
              ? "p-4"
              : calendar.view === "week"
                ? "p-3 md:p-4"
                : "p-4 md:p-5",
          )}>
            {calendar.view === "month" ? (
              <MonthGrid
                month={month}
                onSelectDate={(d) => { calendar.setSelectedDate(d); setSidePanelDate(d); }}
                onDoubleClickDate={(d) => { calendar.setDateAndView(d, "day"); }}
                showOutsideMonthDays={preferences.showOutsideMonthDays}
                weekStartsOn={preferences.weekStartsOn}
              />
            ) : null}
            {calendar.view === "week" ? (
              <WeekGrid
                week={week}
                goals={goals}
                excludedByGoal={excludedByGoal}
                onToggleDate={toggleDate}
                planMode={trayOpen}
                dayAssignments={plannerDayAssignments}
                onToggleAssignment={toggleAssignment}
                onRemoveAssignment={unassign}
                onAddTask={addTask}
                weekStartsOn={preferences.weekStartsOn}
                goalOrder={goalOrder}
                onReorderGoals={reorderGoals}
                todayZmanim={todayZmanim ?? undefined}
                onDoubleClickDate={(d) => { calendar.setDateAndView(d, "day"); }}
                onRenameGoal={renameGoal}
              />
            ) : null}
            {calendar.view === "day" ? (
              <DayFocus
                date={calendar.selectedDate}
                relativeLabel={relativeLabel}
                goals={goals}
                dayAssignments={plannerDayAssignments}
                excludedByGoal={excludedByGoal}
                metadata={metadataByDate.get(toIsoDate(calendar.selectedDate))}
                onToggleDate={toggleDate}
                onToggleAssignment={toggleAssignment}
                onRemoveAssignment={unassign}
                onUnscheduleAssignment={unscheduleAssignment}
                onAddTask={addTask}
                onSetScheduledTime={setScheduledTime}
                onNavigateToDate={(d) => { calendar.setDateAndView(d, "day"); }}
                zmanim={dayZmanim ?? undefined}
                timeFormat={preferences.timeFormat}
                timelineSnapMins={preferences.timelineSnapMins}
                timelineDefaultDurationMins={preferences.timelineDefaultDurationMins}
                onTimelinePreferenceChange={(key, value) => updatePreference(key, value as never)}
                onSetDuration={setDuration}
                goalOrder={goalOrder}
                onReorderGoals={reorderGoals}
                onRenameGoal={renameGoal}
              />
            ) : null}
          </div>

          {/* Cap-blocked dialog */}
          {capBlockedGoal && (
            <CapBlockedPrompt
              goal={capBlockedGoal}
              onEditPolicy={() => { clearPending(); router.push("/goals"); }}
              onDismiss={clearPending}
            />
          )}

          {/* Amount prompt for quantified goal flows */}
          {amountPrompt && (() => {
            if (amountPrompt.kind === "assignment") {
              const goal = goals.find((g) => g.id === amountPrompt.goalId);
              const day = week.days.find((d) => d.iso === amountPrompt.isoDate);
              if (!goal || !day) return null;
              return (
                <AmountPrompt
                  goal={goal}
                  dayLabel={day.date.toLocaleDateString("en-US", { weekday: "long" })}
                  defaultAmount={amountPrompt.suggestedAmount}
                  maxAmount={amountPrompt.maxAmount}
                  onConfirm={confirmAmountPrompt}
                  onCancel={clearPending}
                />
              );
            }

            if (amountPrompt.kind === "completion") {
              const completionAssignment = plannerDayAssignments.find((a) => a.id === amountPrompt.id);
              const goal = goals.find((g) => g.id === completionAssignment?.goalId);
              if (!goal) return null;
              return (
                <AmountPrompt
                  goal={goal}
                  dayLabel={amountPrompt.date}
                  defaultAmount={amountPrompt.defaultAmount}
                  maxAmount={completionAssignment?.targetAmount ?? amountPrompt.defaultAmount}
                  onConfirm={confirmAmountPrompt}
                  onCancel={clearPending}
                />
              );
            }

            const goal = goals.find((g) => g.id === amountPrompt.goalId);
            if (!goal) return null;
            return (
              <AmountPrompt
                goal={goal}
                dayLabel={amountPrompt.isoDate}
                defaultAmount={amountPrompt.defaultAmount}
                onConfirm={confirmAmountPrompt}
                onCancel={clearPending}
              />
            );
          })()}

          {/* DragOverlay renders in a portal at body root — escapes all overflow containers */}
          <DragOverlay dropAnimation={null} modifiers={[overlayNearPointerModifier]}>
            {activeGoalId ? (() => {
              const goalId = getGoalIdFromDragId(activeGoalId);
              const g = goalId ? goals.find((gl) => gl.id === goalId) : null;
              if (!g) return null;
              return (
                <div className="flex w-[11.5rem] max-w-[calc(100vw-2rem)] cursor-grabbing select-none items-center gap-2 rounded-xl border border-brand/30 bg-white px-3 py-2 shadow-xl ring-1 ring-brand/20">
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand/60" />
                  <span className="truncate text-[13px] font-semibold text-slate-800">{g.title}</span>
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
            dayAssignments={plannerDayAssignments}
            excludedByGoal={excludedByGoal}
            onToggleAssignment={toggleAssignment}
            onToggleDate={toggleDate}
            goalOrder={goalOrder}
            onReorderGoals={reorderGoals}
            onNavigate={() => {
              calendar.setDateAndView(sidePanelDate, "day");
              setSidePanelDate(null);
            }}
            onRenameGoal={renameGoal}
          />
        )}
      </Drawer>
    </div>
  );
}
