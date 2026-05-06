"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { GoalListRow, EditableGoalTitle } from "@/features/calendar/components/goal-list-row";
import { Checkbox } from "@/components/ui/checkbox";
import { ReorderGrip } from "@/features/planner/components/reorder-grip";
import { DailyBacklogBadge } from "@/features/planner/components/daily-backlog-badge";
import {
  getGoalItemStatus,
  goalStatusRowClass,
  goalStatusTitleClass,
  goalStatusSubtitleClass,
  goalStatusCheckboxClass,
  GoalStatusPill,
} from "@/features/goals/components/goal-item-status";
import { getGoalTimeStateForNow, computeGoalCountdown } from "@/features/calendar/lib/goal-time-window";
import { todayIso } from "@/lib/date";
import { formatClockTime } from "@/features/calendar/lib/time-format";
import { isPrebuiltGoal } from "@/features/goals/lib/prebuilt-goals";
import type { GoalOccurrence } from "@/features/calendar/lib/goal-occurrences";
import type { DayZmanim } from "@/features/calendar/lib/zmanim";
import type { DailyBacklogEntry } from "@/features/goals/lib/daily-backlog";

export type OccurrenceItemProps = {
  item: GoalOccurrence;
  density?: "compact" | "comfortable";
  isToday: boolean;
  now: Date;
  zmanim?: DayZmanim;
  timeFormat?: "12h" | "24h";
  onToggle: () => void;
  onRemove?: () => void;
  onRenameGoal?: (goalId: string, nextTitle: string) => void;
  backlogEntries?: DailyBacklogEntry[];
  onResolveBacklogDate?: (goalId: string, isoDate: string) => void;
  /** Enable drag-to-timeline for assignment-backed items. Default false. */
  enableDrag?: boolean;
  /** Goal IDs for the vertical reorder grip. Omit to hide the grip. */
  allIds?: string[];
  onReorderGoals?: (prevIds: string[], nextIds: string[]) => void;
  /** Whether to show "Missed" for past-day incomplete items. Adhoc tasks always forgive. Default "punish". */
  missedBehavior?: "punish" | "forgive";
};

/**
 * Single unified row component for all goal/task occurrence types.
 *
 * Status drives every color decision through the shared GoalItemStatus system:
 *   completed   → green row + strikethrough title
 *   missed      → red tint + "Missed" pill
 *   due-soon    → amber tint + "Due soon" pill
 *   not-yet     → dimmed + "Not yet" pill
 *   backlog     → blue tint + "Owed" pill
 *   available   → neutral (default)
 *
 * Metadata shown consistently across all item types:
 *   subtitle line  = programLabel · cadenceHint · amountLabel · timeStateLabel
 *   trailing       = status pill (priority) OR scheduled-time chip
 */
export function OccurrenceItem({
  item,
  density = "comfortable",
  isToday,
  now,
  zmanim,
  timeFormat = "12h",
  onToggle,
  onRemove,
  onRenameGoal,
  backlogEntries = [],
  onResolveBacklogDate,
  enableDrag = false,
  allIds,
  onReorderGoals,
  missedBehavior = "punish",
}: OccurrenceItemProps) {
  const [isSortDragging, setIsSortDragging] = useState(false);
  const { goal } = item;

  // ── Drag-to-timeline DnD ──────────────────────────────────────────────────
  // useDraggable must be called unconditionally (React hook rules).
  // For non-draggable items the hook runs with disabled=true.
  const dragId = item.source === "assignment"
    ? (item.collapsed ? item.actionId : `assignment:${item.assignment.id}`)
    : `daily:${goal.id}`;
  // lockInDays = "can't be moved to another day" — that restriction is enforced in handleDragEnd
  // for cross-day drops. Same-day timeline assignment (checklist → timeline) should work for
  // locked goals too. Callers that don't want cross-day drag pass enableDrag=false.
  const draggable = enableDrag
    && (item.source === "auto" || item.assignment.disabled !== true);
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: dragId,
    disabled: !draggable,
  });
  const dragStyle = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 999 }
    : undefined;
  const activeDrag = isDragging || isSortDragging;

  // ── Status: single source of truth for all visual treatment ──────────────
  // Adhoc tasks (quick todos) are always forgiven — they're not obligations.
  const isPast = !isToday && item.occurrenceDate < todayIso() && missedBehavior !== "forgive" && !goal.adhoc;

  // completedAfterWindow: use stored flag when explicitly set (true or false).
  // When undefined (generated assignments, auto items), infer:
  //   Past day + time window + no placed scheduledTime → retroactive = Late.
  //   Today + time window + completedAt after window → Late.
  const storedAfterWindow = item.source === "assignment" ? item.assignment.completedAfterWindow : undefined;
  const inferredAfterWindow = storedAfterWindow === undefined && item.completed && !!goal.expiresAt && (() => {
    if (!isToday && item.occurrenceDate < todayIso()) {
      // Past day: late unless a user-placed scheduledTime proves it was within the window
      if (item.source === "assignment" && item.assignment.scheduledTime) return false;
      return true;
    }
    if (isToday && item.source === "assignment" && item.assignment.completedAt && zmanim) {
      // Today: evaluate completedAt against this day's window
      const fakeNow = new Date(`${item.occurrenceDate}T${item.assignment.completedAt}:00`);
      return getGoalTimeStateForNow(goal, zmanim, true, fakeNow) === "expired";
    }
    return false;
  })();
  const completedAfterWindow = storedAfterWindow === true || inferredAfterWindow;

  const timeState = getGoalTimeStateForNow(goal, zmanim, isToday, now);
  const countdown = isToday ? computeGoalCountdown(goal, zmanim, now, item.completed) : null;
  const status = getGoalItemStatus({
    completed: item.completed,
    completedAfterWindow,
    timeState,
    countdownUrgent: countdown?.urgent,
    isPast,
  });

  // ── Subtitle: unified metadata line ──────────────────────────────────────
  // comfortable density shows cadence context; compact keeps it tight.
  const cadenceHint = density === "comfortable" ? (() => {
    if (goal.cadence === "one-time" && goal.adhoc) return "Task";
    const base = goal.cadence.charAt(0).toUpperCase() + goal.cadence.slice(1);
    const days = goal.activeDays;
    if (goal.cadence === "daily" && days && days.length > 0 && days.length < 7) {
      return `${base} · ${days[0]}–${days[days.length - 1]}`;
    }
    return base;
  })() : null;
  const amountLabel = goal.type === "quantified" && item.displayAmount > 0
    ? `${item.displayAmount}${goal.targetUnit ? ` ${goal.targetUnit}` : ""}`
    : null;
  // Only show countdown text when it adds time-specific info ("starts in X", "ends in X").
  // "expired" / "not yet" / "done before deadline" are already communicated by the status pill.
  const stateLabel = countdown?.label?.includes(" in ") ? countdown.label : null;
  const subtitle = [item.programLabel, cadenceHint, amountLabel, stateLabel]
    .filter(Boolean)
    .join(" · ");

  // ── Trailing: status pill takes priority, time chip is secondary ──────────
  const timeLabel = item.source === "assignment" && density === "comfortable"
    ? (formatClockTime(item.assignment.scheduledTime ?? item.assignment.completedAt, timeFormat) ?? null)
    : null;

  return (
    <GoalListRow
      density={density}
      align="start"
      rowRef={setNodeRef}
      rootProps={draggable ? { ...listeners, ...attributes } : undefined}
      style={dragStyle}
      className={cn(
        "select-none touch-none",
        (enableDrag || (allIds && onReorderGoals)) && "cursor-grab active:cursor-grabbing",
        activeDrag
          ? "opacity-40 bg-brand/[0.05] shadow-sm ring-1 ring-brand/15"
          : goalStatusRowClass(status),
      )}
      leading={allIds && onReorderGoals ? (
        <ReorderGrip
          itemId={goal.id}
          itemIds={allIds}
          onReorder={onReorderGoals}
          rowStepPx={density === "compact" ? 28 : 40}
          iconWidth={density === "compact" ? 6 : 8}
          iconHeight={density === "compact" ? 10 : 12}
          onDragStart={() => setIsSortDragging(true)}
          onDragEnd={() => setIsSortDragging(false)}
          className={cn(
            density === "compact"
              ? "text-slate-200 hover:text-slate-400"
              : "mt-[3px] text-slate-300 group-hover:text-slate-400",
            activeDrag && "text-brand",
          )}
        />
      ) : undefined}
      checkbox={(
        <Checkbox
          checked={item.completed}
          onChange={onToggle}
          disabled={item.source === "assignment" && item.assignment.disabled === true}
          size={density === "compact" ? "sm" : "md"}
          uncheckedClassName={cn(
            density === "compact"
              ? "border-slate-400 hover:border-slate-500"
              : "hover:border-slate-300",
            goalStatusCheckboxClass(status, item.completed),
          )}
        />
      )}
      content={(
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-2">
            <EditableGoalTitle
              title={goal.title}
              onRename={onRenameGoal && !isPrebuiltGoal(goal.id)
                ? (next) => onRenameGoal(goal.id, next)
                : undefined}
              className={cn(
                "font-semibold leading-tight transition-colors",
                density === "compact" ? "text-[12.5px]" : "text-[13.5px]",
                goalStatusTitleClass(status),
              )}
              inputClassName={cn(
                "font-semibold",
                density === "compact" ? "text-[12.5px]" : "text-[13.5px]",
              )}
            />
            {backlogEntries.length > 0 && density !== "compact" && (
              <DailyBacklogBadge
                goalTitle={goal.title}
                entries={backlogEntries}
                onResolveDate={
                  onResolveBacklogDate ? (d) => onResolveBacklogDate(goal.id, d) : undefined
                }
                compact
              />
            )}
          </div>
          {subtitle ? (
            <p className={cn(
              "mt-0.5 truncate",
              density === "compact" ? "text-[10px] leading-tight" : "text-[11px]",
              goalStatusSubtitleClass(status),
            )}>
              {subtitle}
            </p>
          ) : null}
        </div>
      )}
      trailing={(
        <div className="flex shrink-0 items-center gap-1">
          {status !== "available" && status !== "completed" ? (
            <GoalStatusPill status={status} />
          ) : timeLabel ? (
            <span className="shrink-0 rounded-full border border-brand/15 bg-brand/[0.08] px-2 py-[2px] text-[9.5px] font-semibold text-brand/75">
              {timeLabel}
            </span>
          ) : null}
          {/* Always rendered to keep trailing width uniform across all items in a list */}
          <button
            type="button"
            onClick={(e) => { if (onRemove && !goal.lockInDays) { e.stopPropagation(); onRemove(); } }}
            onPointerDown={(e) => e.stopPropagation()}
            className={cn(
              "rounded-full p-0.5 transition",
              onRemove && !goal.lockInDays
                ? "text-slate-300 opacity-0 hover:text-red-400 group-hover:opacity-100"
                : "invisible pointer-events-none",
            )}
          >
            <X className={cn(density === "compact" ? "h-2.5 w-2.5" : "h-3 w-3")} strokeWidth={2.5} />
          </button>
        </div>
      )}
    />
  );
}
