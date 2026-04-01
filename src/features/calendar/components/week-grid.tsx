"use client";

import { useState, useRef } from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { todayIso } from "@/lib/date";
import { getApplicableGoalsForDate } from "@/features/goals/lib/goal-progress";
import type { CalendarWeek, CalendarDayMetadata, CalendarDay } from "@/features/calendar/types/calendar";
import type { Goal } from "@/features/goals/types/goal";
import type { DayAssignment } from "@/features/planner/lib/day-assignment-store";
import type { DayZmanim } from "@/features/calendar/lib/zmanim";

interface WeekGridProps {
  week: CalendarWeek;
  goals: Goal[];
  excludedByGoal: Map<string, Set<string>>;
  onToggleDate: (goalId: string, isoDate: string) => void;
  planMode?: boolean;
  dayAssignments?: DayAssignment[];
  onToggleAssignment?: (id: string) => void;
  onRemoveAssignment?: (assignmentId: string) => void;
  onAddTask?: (title: string, isoDate: string) => void;
  weekStartsOn?: 0 | 1;
  showOmer?: boolean;
  completedOmerDates?: Set<string>;
  onToggleOmer?: (isoDate: string) => void;
  goalOrder?: string[];
  onReorderGoals?: (prevIds: string[], newIds: string[]) => void;
  todayZmanim?: DayZmanim;
}

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function buildTimePills(meta: CalendarDayMetadata) {
  const pills: { label: string; time: string }[] = [];
  if (meta.fastBegins) pills.push({ label: "Fast", time: meta.fastBegins });
  if (meta.candleLighting) pills.push({ label: "Light", time: meta.candleLighting });
  if (meta.shabbosEnds && pills.length < 2) pills.push({ label: "Ends", time: meta.shabbosEnds });
  return pills.slice(0, 2);
}


function OmerTaskItem({ day, isoDate, completed, onToggle }: {
  day: number;
  isoDate: string;
  completed: boolean;
  onToggle: (isoDate: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(isoDate)}
      className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-slate-50 active:bg-slate-100"
    >
      <div className={cn(
        "mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
        completed ? "border-success bg-success" : "border-slate-300",
      )}>
        {completed && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn(
          "text-[12.5px] font-medium leading-tight text-slate-800 transition-colors",
          completed && "text-slate-400 line-through decoration-slate-300",
        )}>
          Omer <span className="text-[10.5px] text-slate-400">day {day}</span>
        </p>
      </div>
    </button>
  );
}

/** Auto-scheduled weekly goal — draggable to another day unless locked. */
function DraggableWeeklyTaskItem({
  goal,
  isoDate,
  onToggle,
}: {
  goal: Goal;
  isoDate: string;
  onToggle: (goalId: string, isoDate: string) => void;
}) {
  const isDone = goal.completedDates?.includes(isoDate) ?? false;
  const locked = goal.lockInDays === true;
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: `weekly:${goal.id}:${isoDate}`,
    disabled: locked,
  });

  const dragStyle = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 999 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className={cn(
        "flex w-full select-none touch-none items-start gap-2 rounded-lg px-1.5 py-1 transition hover:bg-slate-50",
        !locked && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(goal.id, isoDate)}
        className={cn(
          "mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
          isDone ? "border-success bg-success" : "border-slate-300",
        )}
      >
        {isDone && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
      </button>
      <p
        {...(!locked ? listeners : {})}
        {...(!locked ? attributes : {})}
        className={cn(
          "flex-1 text-[12.5px] font-medium leading-tight text-slate-800 transition-colors",
          isDone && "text-slate-400 line-through decoration-slate-300",
        )}
      >
        {goal.title}
      </p>
    </div>
  );
}


type WeekGoalItem =
  | { kind: "daily"; goal: Goal }
  | { kind: "weekly"; goal: Goal }
  | { kind: "assigned"; goal: Goal; assignment: DayAssignment };

/** Native-pointer sort handle — completely decoupled from dnd-kit. */
function SortHandle({
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
      className="mt-[2px] shrink-0 cursor-grab touch-none text-slate-200 hover:text-slate-400 active:cursor-grabbing"
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
        const offset = Math.round((e.clientY - startY) / 28);
        const newIdx = Math.max(0, Math.min(allIds.length - 1, startIdx + offset));
        if (newIdx !== startIdx) onReorderGoals(allIds, arrayMove(allIds, startIdx, newIdx));
      }}
      onPointerCancel={() => { dragRef.current = null; }}
    >
      <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
        <circle cx="2" cy="2" r="1.3"/><circle cx="6" cy="2" r="1.3"/>
        <circle cx="2" cy="6" r="1.3"/><circle cx="6" cy="6" r="1.3"/>
        <circle cx="2" cy="10" r="1.3"/><circle cx="6" cy="10" r="1.3"/>
      </svg>
    </button>
  );
}

function weekGoalTimeExpired(goal: Goal, zmanim: DayZmanim | undefined, isToday: boolean): boolean {
  if (!isToday || !zmanim || !goal.expiresAt) return false;
  const now = new Date();
  const nowFrac = now.getHours() + now.getMinutes() / 60;
  const expPeriod = zmanim.periods.find((p) => p.name === goal.expiresAt);
  return expPeriod !== undefined && nowFrac >= expPeriod.startHour;
}

function SortableWeekGoalItem({
  item,
  isoDate,
  isToday,
  allIds,
  onToggleDate,
  onToggleAssignment,
  onRemoveAssignment,
  onReorderGoals,
  zmanim,
}: {
  item: WeekGoalItem;
  isoDate: string;
  isToday: boolean;
  allIds: string[];
  onToggleDate: (goalId: string, iso: string) => void;
  onToggleAssignment: (id: string) => void;
  onRemoveAssignment: (id: string) => void;
  onReorderGoals: (prev: string[], next: string[]) => void;
  zmanim?: DayZmanim;
}) {
  // useDraggable called unconditionally (rules of hooks) — disabled for non-assigned items or locked goals
  const assignId = item.kind === "assigned" ? `assignment:${item.assignment.id}` : `noop:${item.goal.id}`;
  const assignedAndMoveable = item.kind === "assigned" && !item.goal.lockInDays;
  const { attributes, listeners, setNodeRef: aRef, isDragging: aIsDragging, transform: aXform } =
    useDraggable({ id: assignId, disabled: !assignedAndMoveable });

  if (item.kind === "weekly") {
    return <DraggableWeeklyTaskItem goal={item.goal} isoDate={isoDate} onToggle={onToggleDate} />;
  }

  const assignDragStyle = aXform
    ? { transform: `translate3d(${aXform.x}px, ${aXform.y}px, 0)`, zIndex: 999 }
    : undefined;

  if (item.kind === "assigned") {
    const { assignment, goal } = item;
    return (
      <div
        ref={aRef}
        style={assignDragStyle}
        className={cn(
          "group flex w-full select-none touch-none items-start gap-2 rounded-lg px-1.5 py-1",
          aIsDragging && "opacity-50",
        )}
      >
        <SortHandle goalId={goal.id} allIds={allIds} onReorderGoals={onReorderGoals} />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleAssignment(assignment.id); }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
            assignment.completed ? "border-success bg-success" : "border-slate-300",
          )}
        >
          {assignment.completed && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
        </button>
        <p
          {...(assignedAndMoveable ? listeners : {})}
          {...(assignedAndMoveable ? attributes : {})}
          className={cn(
            "min-w-0 flex-1 truncate text-[12.5px] font-medium leading-tight text-slate-800 select-none transition-colors",
            assignedAndMoveable && "cursor-grab",
            assignment.completed && "text-slate-400 line-through decoration-slate-300",
          )}
        >
          {goal.title}
          {assignment.targetAmount && (
            <span className="ml-1 font-normal text-brand/70">
              · {assignment.targetAmount} {goal.targetUnit ?? "units"}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemoveAssignment(assignment.id); }}
          className="ml-auto mt-[1px] shrink-0 rounded-full p-0.5 text-slate-300 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
        >
          <X className="h-2.5 w-2.5" strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  // Daily goal
  const isDone = item.goal.completedDates?.includes(isoDate) ?? false;
  const isExpired = weekGoalTimeExpired(item.goal, zmanim, isToday);
  return (
    <div className={cn("flex w-full items-start gap-2 rounded-lg px-1.5 py-1 transition hover:bg-slate-50", !isDone && isExpired && "opacity-50")}>
      <SortHandle goalId={item.goal.id} allIds={allIds} onReorderGoals={onReorderGoals} />
      <button
        type="button"
        onClick={() => onToggleDate(item.goal.id, isoDate)}
        className={cn(
          "mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
          isDone ? "border-success bg-success" : "border-slate-300",
        )}
      >
        {isDone && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
      </button>
      <p className={cn(
        "text-[12.5px] font-medium leading-tight text-slate-800 transition-colors",
        isDone && "text-slate-400 line-through decoration-slate-300",
      )}>
        {item.goal.title}
      </p>
    </div>
  );
}

function DayColumn({
  day,
  goals,
  excludedByGoal,
  onToggleDate,
  planMode,
  assignedItems,
  onToggleAssignment,
  onRemoveAssignment,
  onAddTask,
  suppressedAutoShows,
  omerDay,
  omerCompleted,
  onToggleOmer,
  goalOrder = [],
  onReorderGoals,
  zmanim,
}: {
  day: CalendarDay;
  goals: Goal[];
  excludedByGoal: Map<string, Set<string>>;
  onToggleDate: (goalId: string, isoDate: string) => void;
  planMode: boolean;
  assignedItems: { assignment: DayAssignment; goal: Goal }[];
  onToggleAssignment: (id: string) => void;
  onRemoveAssignment: (assignmentId: string) => void;
  onAddTask?: (title: string, isoDate: string) => void;
  suppressedAutoShows: Set<string>;
  omerDay?: number;
  omerCompleted?: boolean;
  onToggleOmer?: (isoDate: string) => void;
  goalOrder?: string[];
  onReorderGoals?: (prevIds: string[], newIds: string[]) => void;
  zmanim?: DayZmanim;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingToggle, setPendingToggle] = useState<
    | { type: "date"; goalId: string }
    | { type: "assignment"; assignmentId: string }
    | { type: "omer" }
    | null
  >(null);
  const { setNodeRef, isOver } = useDroppable({ id: day.iso });

  const meta = day.metadata;
  const isoDate = day.iso;
  const todayIsoStr = todayIso();
  const dayIsFuture = isoDate > todayIsoStr;
  const isToday = isoDate === todayIsoStr;

  function handleToggleDateMaybeConfirm(goalId: string, date: string) {
    const goal = goals.find((g) => g.id === goalId);
    const alreadyDone = goal?.completedDates?.includes(date) ?? false;
    if (dayIsFuture && !alreadyDone) {
      setPendingToggle({ type: "date", goalId });
    } else {
      onToggleDate(goalId, date);
    }
  }

  function handleToggleOmerMaybeConfirm(date: string) {
    if (dayIsFuture && !omerCompleted) {
      setPendingToggle({ type: "omer" });
    } else {
      onToggleOmer?.(date);
    }
  }

  function handleToggleAssignmentMaybeConfirm(assignmentId: string) {
    const item = assignedItems.find((i) => i.assignment.id === assignmentId);
    if (dayIsFuture && item && !item.assignment.completed) {
      setPendingToggle({ type: "assignment", assignmentId });
    } else {
      onToggleAssignment(assignmentId);
    }
  }

  const pendingGoalTitle = pendingToggle
    ? pendingToggle.type === "date"
      ? (goals.find((g) => g.id === pendingToggle.goalId)?.title ?? "this task")
      : pendingToggle.type === "omer"
      ? "Sefirat HaOmer"
      : (assignedItems.find((i) => i.assignment.id === pendingToggle.assignmentId)?.goal.title ?? "this task")
    : "";
  // Suppress an auto-show if:
  // 1. This date already has an explicit assignment for the same goal (no duplicate display), OR
  // 2. This preferred-day auto-show was explicitly replaced by dragging it to another day
  //    (tracked via replacedAutoDate on the resulting assignment).
  // Use assignmentsForDay (not assignedItems) so an orphaned assignment (unknown goalId)
  // doesn't silently suppress the daily goal row — only valid assignments suppress the daily show.
  const assignedGoalIds = new Set(assignedItems.map((item) => item.assignment.goalId));
  const rawDailyGoals = getApplicableGoalsForDate(goals, day.date, excludedByGoal)
    .filter((g) => !assignedGoalIds.has(g.id))
    .filter((g) => !suppressedAutoShows.has(`${g.id}:${isoDate}`));
  const pills = meta ? buildTimePills(meta) : [];
  const weekdayLabel = WEEKDAY_LABELS[day.date.getDay()];

  // Build unified sorted list
  const allGoalItems: WeekGoalItem[] = [
    ...rawDailyGoals.map((g): WeekGoalItem =>
      g.cadence === "weekly" ? { kind: "weekly", goal: g } : { kind: "daily", goal: g },
    ),
    ...assignedItems.map(({ goal, assignment }): WeekGoalItem => ({ kind: "assigned", goal, assignment })),
  ].sort((a, b) => {
    const ai = goalOrder.indexOf(a.goal.id);
    const bi = goalOrder.indexOf(b.goal.id);
    return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
  });
  const itemIds = allGoalItems.map((i) => i.goal.id);

  const omerCount = omerDay !== undefined ? 1 : 0;
  const totalCount = allGoalItems.length + omerCount;
  const completedCount =
    allGoalItems.filter((item) =>
      item.kind === "assigned"
        ? item.assignment.completed
        : item.goal.completedDates?.includes(isoDate),
    ).length + (omerDay !== undefined && omerCompleted ? 1 : 0);
  const allDone = totalCount > 0 && completedCount === totalCount;

  return (
    <div
      className={cn(
        "flex min-h-[22rem] flex-col rounded-[1.2rem] border transition-all duration-200",
        day.isToday
          ? "border-brand/30 bg-white shadow-[0_2px_14px_rgba(0,0,0,0.07)]"
          : "border-slate-200/70 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        isOver && "border-brand/50 bg-brand/[0.03] shadow-[0_0_0_2px_rgba(99,102,241,0.15)]",
      )}
    >
      {/* Header */}
      <div className="border-b border-slate-100 p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          {weekdayLabel}
        </p>
        <div className="flex items-start justify-between gap-1">
          <div className="flex flex-col gap-1">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-[1.5rem] font-black leading-none tracking-tight",
                day.isToday ? "bg-brand text-white" : "text-slate-900",
              )}
            >
              {day.dayNumber}
            </div>
            {meta?.hebrewDateLabel && (
              <p className="whitespace-nowrap text-[9.5px] font-medium leading-none text-slate-500">
                {meta.hebrewDateLabel}
              </p>
            )}
          </div>
          {pills.length > 0 && (
            <div className="flex flex-col items-end gap-[3px] pt-[1px]">
              {pills.map((p) => (
                <div
                  key={p.label}
                  className="flex items-center gap-1 rounded-full border border-brand/15 bg-brand/[0.06] px-1.5 py-[3px]"
                >
                  <span className="text-[7.5px] font-bold uppercase tracking-wide text-brand/70">{p.label}</span>
                  <span className="whitespace-nowrap tabular-nums text-[9.5px] font-semibold text-slate-800">{p.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Fixed-height holiday zone — 1 line max, always reserves space so all columns align */}
        <div className="mt-1.5 h-[14px] overflow-hidden">
          {meta?.holidays?.[0] ? (
            <p className="truncate text-[10px] font-semibold leading-none text-slate-700">
              {meta.holidays[0]}
            </p>
          ) : meta?.parsha ? (
            <p className="truncate text-[10px] font-medium leading-none text-brand/85">
              {meta.parsha}
            </p>
          ) : null}
        </div>
      </div>

      {/* Task list — this is the drop zone */}
      <div ref={setNodeRef} className="flex flex-1 flex-col gap-px p-2">
        {omerDay !== undefined && onToggleOmer && (
          <OmerTaskItem
            day={omerDay}
            isoDate={isoDate}
            completed={omerCompleted ?? false}
            onToggle={handleToggleOmerMaybeConfirm}
          />
        )}
        {allGoalItems.map((item) => (
          <SortableWeekGoalItem
            key={item.goal.id}
            item={item}
            isoDate={isoDate}
            allIds={itemIds}
            onToggleDate={handleToggleDateMaybeConfirm}
            onToggleAssignment={handleToggleAssignmentMaybeConfirm}
            onRemoveAssignment={onRemoveAssignment}
            onReorderGoals={onReorderGoals ?? (() => {})}
            isToday={isToday}
            zmanim={zmanim}
          />
        ))}

        {planMode && totalCount === 0 && (
          <div className={cn(
            "flex flex-1 items-center justify-center rounded-xl border border-dashed m-1 transition-colors",
            isOver ? "border-brand/40 bg-brand/[0.04]" : "border-slate-200",
          )}>
            <p className={cn("text-[10px]", isOver ? "text-brand/60" : "text-slate-300")}>
              Drop here
            </p>
          </div>
        )}

        {!planMode && totalCount === 0 && (
          <p className="px-1.5 pt-0.5 text-[11px] text-slate-400/70">No tasks</p>
        )}

        {isAdding ? (
          <input
            autoFocus
            type="text"
            placeholder="Task name…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft.trim()) {
                onAddTask?.(draft.trim(), isoDate);
                setDraft("");
                setIsAdding(false);
              }
              if (e.key === "Escape") {
                setDraft("");
                setIsAdding(false);
              }
            }}
            onBlur={() => {
              if (draft.trim()) onAddTask?.(draft.trim(), isoDate);
              setDraft("");
              setIsAdding(false);
            }}
            className="w-full rounded-lg border border-brand/30 bg-white px-2 py-1 text-[12px] text-slate-800 placeholder-slate-300 outline-none focus:ring-1 focus:ring-brand/20"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex w-full items-center gap-1 rounded-lg px-1.5 py-1 text-left text-[11px] text-slate-300 transition hover:text-slate-400"
          >
            + Add task
          </button>
        )}
      </div>

      {/* Footer */}
      {totalCount > 0 && (
        <div className="border-t border-slate-100 px-3 py-2">
          <span
            className={cn(
              "text-[10.5px] font-semibold tabular-nums transition-colors",
              allDone ? "text-success" : "text-slate-500",
            )}
          >
            {completedCount}/{totalCount} done
          </span>
        </div>
      )}

      {/* Future-date confirmation dialog */}
      {pendingToggle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[2px]"
          onClick={(e) => { if (e.target === e.currentTarget) setPendingToggle(null); }}
        >
          <div className="w-72 rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/10">
            <p className="text-[13.5px] font-bold text-slate-800">Mark as done?</p>
            <p className="mt-1 text-[12px] text-slate-500">
              <span className="font-semibold">{pendingGoalTitle}</span> is scheduled for a future date. Override to mark it done now?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setPendingToggle(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingToggle.type === "date") {
                    onToggleDate(pendingToggle.goalId, isoDate);
                  } else if (pendingToggle.type === "omer") {
                    onToggleOmer?.(isoDate);
                  } else {
                    onToggleAssignment(pendingToggle.assignmentId);
                  }
                  setPendingToggle(null);
                }}
                className="flex-1 rounded-xl bg-brand py-2 text-[12px] font-semibold text-white transition hover:bg-brand/90"
              >
                Mark done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function WeekGrid({
  week,
  goals,
  excludedByGoal,
  onToggleDate,
  planMode = false,
  dayAssignments = [],
  onToggleAssignment,
  onRemoveAssignment,
  onAddTask,
  showOmer,
  completedOmerDates,
  onToggleOmer,
  goalOrder = [],
  onReorderGoals,
  todayZmanim,
}: WeekGridProps) {
  // When a weekly auto-show is dragged from its preferred day to another day, the assignment
  // stores replacedAutoDate = the source preferred-day ISO. We suppress only that specific
  // preferred-day auto-show — not all auto-shows for the goal.
  // Key format: "${goalId}:${suppressedIsoDate}"
  const suppressedAutoShows = new Set<string>(
    dayAssignments
      .filter((a) => a.replacedAutoDate !== undefined)
      .map((a) => `${a.goalId}:${a.replacedAutoDate}`),
  );

  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
      <div className="grid min-w-[48rem] grid-cols-7 gap-2 md:gap-2.5">
        {week.days.map((day) => {
          const assignmentsForDay = dayAssignments.filter((a) => a.date === day.iso);
          const assignedItems = assignmentsForDay
            .map((assignment) => ({
              assignment,
              goal: goals.find((g) => g.id === assignment.goalId),
            }))
            .filter((item): item is { assignment: DayAssignment; goal: Goal } =>
              item.goal !== undefined,
            );

          const omerDay = showOmer ? day.metadata?.omerDay : undefined;
          return (
            <DayColumn
              key={day.iso}
              day={day}
              goals={goals}
              excludedByGoal={excludedByGoal}
              onToggleDate={onToggleDate}
              planMode={planMode}
              assignedItems={assignedItems}
              onToggleAssignment={onToggleAssignment ?? (() => {})}
              onRemoveAssignment={onRemoveAssignment ?? (() => {})}
              onAddTask={onAddTask}
              suppressedAutoShows={suppressedAutoShows}
              omerDay={omerDay}
              omerCompleted={omerDay !== undefined ? (completedOmerDates?.has(day.iso) ?? false) : undefined}
              onToggleOmer={onToggleOmer}
              goalOrder={goalOrder}
              onReorderGoals={onReorderGoals}
              zmanim={day.iso === todayIso() ? todayZmanim : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
