"use client";

import { useState, useEffect, useMemo } from "react";
import { useDroppable, useDraggable, useDndMonitor } from "@dnd-kit/core";
import { cn } from "@/lib/cn";
import { Checkbox } from "@/components/ui/checkbox";
import { todayIso } from "@/lib/date";
import { getGoalOriginLabel } from "@/features/goals/components/goal-origin-pill";
import { OccurrenceItem } from "@/features/planner/components/occurrence-item";
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
import { CalendarMetaPills, buildCalendarMetaPills } from "@/features/planner/components/calendar-meta-pills";
import { CompletionCount } from "@/features/planner/components/completion-status";
import { FutureDateConfirmationModal } from "@/features/planner/components/future-date-confirmation-modal";
import { InlineAddTask, TaskListEmptyState } from "@/features/planner/components/inline-add-task";
import { ReorderGrip } from "@/features/planner/components/reorder-grip";
import { getDailyBacklogEntries, type DailyBacklogEntry } from "@/features/goals/lib/daily-backlog";

interface WeekGridProps {
  week: CalendarWeek;
  goals: Goal[];
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
  missedBehavior?: "punish" | "forgive";
}

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const WEEK_TITLE_PILL_CLASSES = {
  preset: "bg-brand-soft text-brand",
  edited: "bg-amber-100 text-amber-700",
  custom: "bg-surface-muted text-text-muted",
  task: "bg-slate-100 text-slate-600",
} as const;

function WeekGoalTitlePill({
  goal,
  completed,
  draggable = false,
  onRenameGoal,
}: {
  goal: Goal;
  completed: boolean;
  draggable?: boolean;
  onRenameGoal: (goalId: string, nextTitle: string) => void;
}) {
  const origin = getGoalOriginLabel(goal);

  return (
    <EditableGoalTitle
      title={goal.title}
      onRename={isPrebuiltGoal(goal.id) ? undefined : (nextTitle) => onRenameGoal(goal.id, nextTitle)}
      className={cn(
        "!inline-flex !w-auto min-w-0 max-w-full overflow-hidden rounded-full px-2 py-0.5 text-[12px] font-semibold leading-tight transition-colors",
        WEEK_TITLE_PILL_CLASSES[origin.tone],
        draggable && "cursor-grab select-none active:cursor-grabbing",
        completed && "opacity-65 line-through decoration-current/40",
      )}
      inputClassName="text-[12px] font-medium"
    />
  );
}


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
      align="start"
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
          <div className="flex min-w-0 items-start gap-2">
            <WeekGoalTitlePill
              goal={goal}
              completed={isDone}
              draggable={!locked}
              onRenameGoal={onRenameGoal}
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
  missedBehavior,
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
  missedBehavior?: "punish" | "forgive";
}) {
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

  return (
    <OccurrenceItem
      item={item}
      density="compact"
      isToday={isToday}
      now={new Date()}
      zmanim={zmanim}
      onToggle={
        item.source === "auto"
          ? () => onToggleDate(item.goal.id, item.occurrenceDate)
          : () => onToggleAssignment(item.actionId)
      }
      onRemove={item.source === "assignment" ? () => onRemoveAssignment(item.actionId) : undefined}
      onRenameGoal={onRenameGoal}
      backlogEntries={backlogEntriesByGoal.get(item.goal.id) ?? []}
      onResolveBacklogDate={(goalId, date) => onToggleDate(goalId, date)}
      enableDrag={item.source === "assignment" && !item.goal.lockInDays}
      allIds={allIds}
      onReorderGoals={onReorderGoals}
      missedBehavior={missedBehavior}
    />
  );
}

function DayColumn({
  day,
  goals,
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
  missedBehavior,
}: {
  day: CalendarDay;
  goals: Goal[];
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
  missedBehavior?: "punish" | "forgive";
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [pendingToggle, setPendingToggle] = useState<
    | { type: "date"; goalId: string; date: string }
    | { type: "assignment"; assignmentId: string }
    | null
  >(null);
  const { setNodeRef, isOver } = useDroppable({ id: day.iso });

  useDndMonitor({});

  const meta = day.metadata;
  const isoDate = day.iso;
  const todayIsoStr = todayIso();
  const dayIsFuture = isoDate > todayIsoStr;
  const isToday = isoDate === todayIsoStr;
  const isIdealDropZone = isOver;

  function handleToggleDateMaybeConfirm(goalId: string, date: string) {
    const goal = goals.find((g) => g.id === goalId);
    const alreadyDone = goal?.completedDates?.includes(date) ?? false;
    if (dayIsFuture && !alreadyDone) {
      setPendingToggle({ type: "date", goalId, date });
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
        isIdealDropZone && "border-brand/50 bg-brand/[0.03] shadow-[0_0_0_2px_rgba(99,102,241,0.15)]",
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
            missedBehavior={missedBehavior}
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
            active={isIdealDropZone}
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
              onToggleDate(pendingToggle.goalId, pendingToggle.date);
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
  missedBehavior,
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
            }),
            goalOrder,
          );

          return (
            <DayColumn
              key={day.iso}
              day={day}
              goals={goals}
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
              missedBehavior={missedBehavior}
            />
          );
        })}
      </div>
    </div>
  );
}
