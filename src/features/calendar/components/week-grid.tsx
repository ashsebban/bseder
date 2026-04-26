"use client";

import { useState, useEffect, useMemo } from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Checkbox } from "@/components/ui/checkbox";
import { todayIso } from "@/lib/date";
import { DailyBacklogBadge } from "@/components/planner/daily-backlog-badge";
import { suggestedAssignmentAmount } from "@/features/calendar/lib/assignment-actions";
import {
  buildGoalOccurrencesForDate,
  sortGoalOccurrences,
  type GoalOccurrence,
} from "@/features/calendar/lib/goal-occurrences";
import type { CalendarWeek, CalendarDay } from "@/features/calendar/types/calendar";
import type { Goal } from "@/features/goals/types/goal";
import { isPrebuiltGoal } from "@/features/goals/lib/prebuilt-goals";
import type { DayAssignment } from "@/features/planner/lib/day-assignment-store";
import { EditableGoalTitle, GoalListRow } from "@/features/calendar/components/goal-list-row";
import type { DayZmanim } from "@/features/calendar/lib/zmanim";
import { getGoalTimeStateForNow } from "@/features/calendar/lib/goal-time-window";
import { CalendarMetaPills, buildCalendarMetaPills } from "@/components/planner/calendar-meta-pills";
import { CompletionCount } from "@/components/planner/completion-status";
import { FutureDateConfirmationModal } from "@/components/planner/future-date-confirmation-modal";
import { InlineAddTask, TaskListEmptyState } from "@/components/planner/inline-add-task";
import { ReorderGrip } from "@/components/planner/reorder-grip";
import { getDailyBacklogEntries, type DailyBacklogEntry } from "@/features/goals/lib/daily-backlog";

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
  goalOrder?: string[];
  onReorderGoals?: (prevIds: string[], newIds: string[]) => void;
  todayZmanim?: DayZmanim;
  onDoubleClickDate: (date: Date) => void;
  onRenameGoal: (goalId: string, nextTitle: string) => void;
}

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];


/** Auto-scheduled weekly goal — draggable to another day unless locked. */
function DraggableWeeklyTaskItem({
  goal,
  isoDate,
  onToggle,
  allIds,
  onReorderGoals,
  onRenameGoal,
}: {
  goal: Goal;
  isoDate: string;
  onToggle: (goalId: string, isoDate: string) => void;
  allIds: string[];
  onReorderGoals: (prev: string[], next: string[]) => void;
  onRenameGoal: (goalId: string, nextTitle: string) => void;
}) {
  const isDone = goal.completedDates?.includes(isoDate) ?? false;
  const locked = goal.lockInDays === true;
  const displayAmount = goal.type === "quantified" ? suggestedAssignmentAmount(goal) : 0;
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: `weekly:${goal.id}:${isoDate}`,
    disabled: locked,
  });

  const dragStyle = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 999 }
    : undefined;

  return (
    <GoalListRow
      density="compact"
      rowRef={setNodeRef}
      rootProps={!locked ? { ...listeners, ...attributes } : undefined}
      style={dragStyle}
      className={cn(
        "hover:bg-slate-50",
        isDragging && "opacity-50",
      )}
        leading={(
          <ReorderGrip
            itemId={goal.id}
            itemIds={allIds}
            onReorder={onReorderGoals}
            rowStepPx={28}
            iconWidth={6}
            iconHeight={10}
            className="text-slate-200 hover:text-slate-400"
          />
        )}
        checkbox={
          <Checkbox
            checked={isDone}
            onChange={() => onToggle(goal.id, isoDate)}
            size="sm"
            uncheckedClassName="border-slate-400 hover:border-slate-500"
          />
        }
        content={(
          <div className="flex min-w-0 items-center gap-2">
            <EditableGoalTitle
              title={goal.title}
              onRename={isPrebuiltGoal(goal.id) ? undefined : (nextTitle) => onRenameGoal(goal.id, nextTitle)}
              className={cn(
                "min-w-0 flex-1 truncate text-[12px] font-medium leading-tight text-slate-800 transition-colors",
                !locked && "cursor-grab select-none active:cursor-grabbing",
                isDone && "text-slate-400 line-through decoration-slate-300",
              )}
              inputClassName="text-[12px] font-medium"
            />
            {displayAmount > 0 ? (
              <span
                className="shrink-0 text-[10px] font-medium tracking-tight text-brand/75"
                title={`${displayAmount} ${goal.targetUnit ?? "units"}`}
              >
                · {displayAmount}
              </span>
            ) : null}
          </div>
        )}
    />
  );
}

function weekGoalTimeExpired(goal: Goal, zmanim: DayZmanim | undefined, isToday: boolean): boolean {
  return getGoalTimeStateForNow(goal, zmanim, isToday, new Date()) === "expired";
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
  onRenameGoal,
  backlogEntriesByGoal,
}: {
  item: GoalOccurrence;
  isoDate: string;
  isToday: boolean;
  allIds: string[];
  onToggleDate: (goalId: string, iso: string) => void;
  onToggleAssignment: (id: string) => void;
  onRemoveAssignment: (id: string) => void;
  onReorderGoals: (prev: string[], next: string[]) => void;
  zmanim?: DayZmanim;
  onRenameGoal: (goalId: string, nextTitle: string) => void;
  backlogEntriesByGoal: Map<string, DailyBacklogEntry[]>;
}) {
  // useDraggable called unconditionally (rules of hooks) — disabled for non-assigned items or locked goals
  const assignId = item.source === "assignment"
    ? (item.collapsed ? item.actionId : `assignment:${item.assignment.id}`)
    : `noop:${item.goal.id}`;
  const assignedAndMoveable = item.source === "assignment" && !item.goal.lockInDays;
  const { attributes, listeners, setNodeRef: aRef, isDragging: aIsDragging, transform: aXform } =
    useDraggable({ id: assignId, disabled: !assignedAndMoveable });

  if (item.source === "auto" && item.autoKind === "weekly") {
    return (
      <DraggableWeeklyTaskItem
        goal={item.goal}
        isoDate={isoDate}
        onToggle={onToggleDate}
        allIds={allIds}
        onReorderGoals={onReorderGoals}
        onRenameGoal={onRenameGoal}
      />
    );
  }

  const assignDragStyle = aXform
    ? { transform: `translate3d(${aXform.x}px, ${aXform.y}px, 0)`, zIndex: 999 }
    : undefined;

  if (item.source === "assignment") {
    const assignment = item.assignment;
    const goal = item.goal;
    return (
      <GoalListRow
        density="compact"
        rowRef={aRef}
        rootProps={assignedAndMoveable ? { ...listeners, ...attributes } : undefined}
        style={assignDragStyle}
        className={cn(
          aIsDragging && "opacity-50",
        )}
        leading={(
          <ReorderGrip
            itemId={goal.id}
            itemIds={allIds}
            onReorder={onReorderGoals}
            rowStepPx={28}
            iconWidth={6}
            iconHeight={10}
            className="mt-[2px] text-slate-200 hover:text-slate-400"
          />
        )}
        checkbox={(
          <Checkbox
            checked={assignment.completed}
            onChange={() => onToggleAssignment(item.actionId)}
            size="sm"
            uncheckedClassName="border-slate-400 hover:border-slate-500"
          />
        )}
        content={(
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <EditableGoalTitle
                title={goal.title}
                onRename={isPrebuiltGoal(goal.id) ? undefined : (nextTitle) => onRenameGoal(goal.id, nextTitle)}
                className={cn(
                  "min-w-0 flex-1 truncate text-[12px] font-medium leading-tight text-slate-800 select-none transition-colors",
                  assignedAndMoveable && "cursor-grab",
                  assignment.completed && "text-slate-400 line-through decoration-slate-300",
                )}
                inputClassName="text-[12px] font-medium"
              />
              <DailyBacklogBadge
                goalTitle={goal.title}
                entries={backlogEntriesByGoal.get(goal.id) ?? []}
                onResolveDate={(isoDate) => onToggleDate(goal.id, isoDate)}
                compact
              />
              {goal.type === "quantified" && item.displayAmount > 0 ? (
                <span
                  className="shrink-0 text-[10px] font-medium tracking-tight text-brand/75"
                  title={`${item.displayAmount} ${goal.targetUnit ?? "units"}`}
                >
                  · {item.displayAmount}
                </span>
              ) : null}
            </div>
            {item.programLabel ? (
              <p className="mt-0.5 truncate text-[10px] leading-tight text-slate-400">
                {item.programLabel}
              </p>
            ) : null}
          </div>
        )}
        trailing={goal.lockInDays ? undefined : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemoveAssignment(item.actionId); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="rounded-full p-0.5 text-slate-300 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
            >
              <X className="h-2.5 w-2.5" strokeWidth={2.5} />
            </button>
          </div>
        )}
      />
    );
  }

  // Daily goal
  const isDone = item.completed;
  const isExpired = weekGoalTimeExpired(item.goal, zmanim, isToday);
  return (
    <GoalListRow
      density="compact"
      className={cn("hover:bg-slate-50", !isDone && isExpired && "opacity-50")}
      leading={(
        <ReorderGrip
          itemId={item.goal.id}
          itemIds={allIds}
          onReorder={onReorderGoals}
          rowStepPx={28}
          iconWidth={6}
          iconHeight={10}
          className="text-slate-200 hover:text-slate-400"
        />
      )}
      checkbox={(
        <Checkbox
          checked={isDone}
          onChange={() => onToggleDate(item.goal.id, isoDate)}
          size="sm"
          uncheckedClassName="border-slate-400 hover:border-slate-500"
        />
      )}
      content={(
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <EditableGoalTitle
              title={item.goal.title}
              onRename={(nextTitle) => onRenameGoal(item.goal.id, nextTitle)}
              className={cn(
                "min-w-0 flex-1 truncate text-[12px] font-medium leading-tight text-slate-800 transition-colors",
                isDone && "text-slate-400 line-through decoration-slate-300",
              )}
              inputClassName="text-[12px] font-medium"
            />
            <DailyBacklogBadge
              goalTitle={item.goal.title}
              entries={backlogEntriesByGoal.get(item.goal.id) ?? []}
              onResolveDate={(isoDate) => onToggleDate(item.goal.id, isoDate)}
              compact
            />
            {item.displayAmount > 0 ? (
              <span
                className="shrink-0 text-[10px] font-medium tracking-tight text-brand/75"
                title={`${item.displayAmount} ${item.goal.targetUnit ?? "units"}`}
              >
                · {item.displayAmount}
              </span>
            ) : null}
          </div>
          {item.programLabel ? (
            <p className="mt-0.5 truncate text-[10px] leading-tight text-slate-400">
              {item.programLabel}
            </p>
          ) : null}
        </div>
      )}
    />
  );
}

function DayColumn({
  day,
  goals,
  excludedByGoal,
  onToggleDate,
  planMode,
  occurrences,
  onToggleAssignment,
  onRemoveAssignment,
  onAddTask,
  onReorderGoals,
  zmanim,
  onDoubleClickDate,
  onRenameGoal,
  backlogEntriesByGoal,
}: {
  day: CalendarDay;
  goals: Goal[];
  excludedByGoal: Map<string, Set<string>>;
  onToggleDate: (goalId: string, isoDate: string) => void;
  planMode: boolean;
  occurrences: GoalOccurrence[];
  onToggleAssignment: (id: string) => void;
  onRemoveAssignment: (assignmentId: string) => void;
  onAddTask?: (title: string, isoDate: string) => void;
  onReorderGoals?: (prevIds: string[], newIds: string[]) => void;
  zmanim?: DayZmanim;
  onDoubleClickDate: (date: Date) => void;
  onRenameGoal: (goalId: string, nextTitle: string) => void;
  backlogEntriesByGoal: Map<string, DailyBacklogEntry[]>;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [pendingToggle, setPendingToggle] = useState<
    | { type: "date"; goalId: string }
    | { type: "assignment"; assignmentId: string }
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

  function handleToggleAssignmentMaybeConfirm(assignmentId: string) {
    const item = occurrences.find(
      (occurrence) => occurrence.source === "assignment" && occurrence.actionId === assignmentId,
    );
    if (dayIsFuture && item && !item.completed) {
      setPendingToggle({ type: "assignment", assignmentId });
    } else {
      onToggleAssignment(assignmentId);
    }
  }

  const pendingGoalTitle = pendingToggle
    ? pendingToggle.type === "date"
      ? (goals.find((g) => g.id === pendingToggle.goalId)?.title ?? "this task")
      : (occurrences.find(
        (occurrence) => occurrence.source === "assignment" && occurrence.actionId === pendingToggle.assignmentId,
      )?.goal.title ?? "this task")
    : "";
  const pills = buildCalendarMetaPills(meta, { candleLabel: "Light" });
  const weekdayLabel = WEEKDAY_LABELS[day.date.getDay()];
  const itemIds = [...new Set(occurrences.map((occurrence) => occurrence.goal.id))];
  const totalCount = occurrences.length;
  const completedCount = mounted
    ? occurrences.filter((occurrence) => occurrence.completed).length
    : 0;
  const allDone = totalCount > 0 && completedCount === totalCount;

  return (
    <div
      ref={setNodeRef}
      onDoubleClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button, input, textarea")) return;
        onDoubleClickDate(day.date);
      }}
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
          <CalendarMetaPills pills={pills} density="compact" orientation="vertical" align="end" className="pt-[1px]" />
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
      <div className="flex flex-1 flex-col gap-px p-2">
        {occurrences.map((item) => (
          <SortableWeekGoalItem
            key={item.id}
            item={item}
            isoDate={isoDate}
            allIds={itemIds}
            onToggleDate={handleToggleDateMaybeConfirm}
            onToggleAssignment={handleToggleAssignmentMaybeConfirm}
            onRemoveAssignment={onRemoveAssignment}
            onReorderGoals={onReorderGoals ?? (() => {})}
            isToday={isToday}
            zmanim={zmanim}
            onRenameGoal={onRenameGoal}
            backlogEntriesByGoal={backlogEntriesByGoal}
          />
        ))}

        <InlineAddTask
          onAddTask={onAddTask ? (title) => onAddTask(title, isoDate) : undefined}
          density="compact"
        />

        {planMode && totalCount === 0 && (
          <TaskListEmptyState
            message="Drop here"
            variant="dropzone"
            active={isOver}
          />
        )}

        {!planMode && totalCount === 0 && (
          <TaskListEmptyState message="No tasks" className="px-1.5 pt-0.5 text-[11px] text-slate-400/70" />
        )}
      </div>

      {/* Footer */}
      {totalCount > 0 && (
        <div className="border-t border-slate-100 px-3 py-2">
          <CompletionCount completedCount={completedCount} totalCount={totalCount} density="compact" />
        </div>
      )}

      {/* Future-date confirmation dialog */}
      {pendingToggle && (
        <FutureDateConfirmationModal
          goalTitle={pendingGoalTitle}
          onCancel={() => setPendingToggle(null)}
          onConfirm={() => {
            if (pendingToggle.type === "date") {
              onToggleDate(pendingToggle.goalId, isoDate);
            } else {
              onToggleAssignment(pendingToggle.assignmentId);
            }
            setPendingToggle(null);
          }}
        />
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
  goalOrder = [],
  onReorderGoals,
  todayZmanim,
  onDoubleClickDate,
  onRenameGoal,
}: WeekGridProps) {
  const backlogToday = todayIso();
  const backlogEntriesByGoal = useMemo(
    () => new Map(goals.map((goal) => [goal.id, getDailyBacklogEntries(goal, new Date())])),
    [goals, backlogToday],
  );

  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
      <div className="grid min-w-[48rem] grid-cols-7 gap-1.5 md:gap-2">
        {week.days.map((day) => {
          const occurrences = sortGoalOccurrences(
            buildGoalOccurrencesForDate({
              date: day.date,
              goals,
              dayAssignments,
              excludedByGoal,
            }),
            goalOrder,
          );

          return (
            <DayColumn
              key={day.iso}
              day={day}
              goals={goals}
              excludedByGoal={excludedByGoal}
              onToggleDate={onToggleDate}
              planMode={planMode}
              occurrences={occurrences}
              onToggleAssignment={onToggleAssignment ?? (() => {})}
              onRemoveAssignment={onRemoveAssignment ?? (() => {})}
              onAddTask={onAddTask}
              onReorderGoals={onReorderGoals}
              zmanim={day.iso === todayIso() ? todayZmanim : undefined}
              onDoubleClickDate={onDoubleClickDate}
              onRenameGoal={onRenameGoal}
              backlogEntriesByGoal={backlogEntriesByGoal}
            />
          );
        })}
      </div>
    </div>
  );
}
