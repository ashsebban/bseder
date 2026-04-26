"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { X, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { Checkbox } from "@/components/ui/checkbox";
import { toIsoDate, todayIso, addDays } from "@/lib/date";
import type { CalendarDayMetadata } from "@/features/calendar/types/calendar";
import type { Goal } from "@/features/goals/types/goal";
import { isPrebuiltGoal } from "@/features/goals/lib/prebuilt-goals";
import type { DayAssignment } from "@/features/planner/lib/day-assignment-store";
import {
  buildGoalOccurrencesForDate,
  sortGoalOccurrences,
  type GoalOccurrence,
} from "@/features/calendar/lib/goal-occurrences";
import { EditableGoalTitle, GoalListRow } from "@/features/calendar/components/goal-list-row";
import type { DayZmanim } from "@/features/calendar/lib/zmanim";
import { getHourZmanInfo, formatZmanTime } from "@/features/calendar/lib/zmanim";
import { computeGoalCountdown, getGoalTimeStateForNow } from "@/features/calendar/lib/goal-time-window";
import { formatClockTime, formatHourLabel, formatMinutesAsTime, parseHHMM } from "@/features/calendar/lib/time-format";
import type { CalendarTimeFormat } from "@/features/settings/types/calendar-preferences";
import { CalendarMetaPills, buildCalendarMetaPills } from "@/components/planner/calendar-meta-pills";
import { DailyBacklogBadge } from "@/components/planner/daily-backlog-badge";
import { CompletionBanner, CompletionCount } from "@/components/planner/completion-status";
import { InlineAddTask, TaskListEmptyState } from "@/components/planner/inline-add-task";
import { ReorderGrip } from "@/components/planner/reorder-grip";
import { getDailyBacklogEntries, type DailyBacklogEntry } from "@/features/goals/lib/daily-backlog";
import { getGoalProgramLabel } from "@/features/goals/lib/goal-programs";

interface DayFocusProps {
  date: Date;
  relativeLabel: string;
  goals: Goal[];
  dayAssignments: DayAssignment[];
  excludedByGoal: Map<string, Set<string>>;
  metadata?: CalendarDayMetadata;
  onToggleDate: (goalId: string, isoDate: string, source?: "checklist") => void;
  onToggleAssignment: (id: string) => void;
  onRemoveAssignment: (assignmentId: string) => void;
  onUnscheduleAssignment: (assignmentId: string) => void;
  onAddTask: (title: string, isoDate: string) => void;
  onSetScheduledTime: (assignmentId: string, time: string | null) => void;
  onNavigateToDate: (date: Date) => void;
  onRenameGoal: (goalId: string, nextTitle: string) => void;
  zmanim?: DayZmanim;
  timeFormat?: CalendarTimeFormat;
  timelineSnapMins: number;
  timelineDefaultDurationMins: number;
  onTimelinePreferenceChange: (key: "timelineSnapMins" | "timelineDefaultDurationMins", value: number) => void;
  onSetDuration: (assignmentId: string, durationMins: number) => void;
  goalOrder?: string[];
  onReorderGoals?: (prevIds: string[], newIds: string[]) => void;
}

// ─── Timeline constants ───────────────────────────────────────────────────────
const TIMELINE_START_HOUR = 0;
const TIMELINE_TOTAL_HOURS = 24;
const PX_PER_HOUR = 60;                // 1px = 1 min
const TOTAL_HEIGHT_PX = TIMELINE_TOTAL_HOURS * 60; // 1440px (midnight–midnight)
const LEFT_GUTTER = 52;           // 4px zmanim stripe + 40px labels + 8px gap
const MIN_EVENT_HEIGHT_PX = 20;

const HOURS = Array.from({ length: TIMELINE_TOTAL_HOURS }, (_, i) => i + TIMELINE_START_HOUR); // 0–23

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nowTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
}

interface EventLayout { colIdx: number; totalCols: number; }

function layoutEvents(
  events: { id: string; startMins: number; endMins: number }[],
): Map<string, EventLayout> {
  // Sort by start time; on tie put longer events first
  const sorted = [...events].sort((a, b) =>
    a.startMins !== b.startMins
      ? a.startMins - b.startMins
      : (b.endMins - b.startMins) - (a.endMins - a.startMins),
  );

  // Greedy column assignment
  const colEnds: number[] = []; // last endMins for each column
  const colAssign = new Map<string, number>();
  for (const ev of sorted) {
    let col = colEnds.findIndex((end) => end <= ev.startMins);
    if (col === -1) col = colEnds.length;
    colEnds[col] = ev.endMins;
    colAssign.set(ev.id, col);
  }

  // Second pass: totalCols = how many columns overlap this event
  const result = new Map<string, EventLayout>();
  for (const ev of sorted) {
    const col = colAssign.get(ev.id) ?? 0;
    let maxCol = col;
    for (const other of sorted) {
      if (other.id === ev.id) continue;
      const overlaps = other.startMins < ev.endMins && other.endMins > ev.startMins;
      if (overlaps) maxCol = Math.max(maxCol, colAssign.get(other.id) ?? 0);
    }
    result.set(ev.id, { colIdx: col, totalCols: maxCol + 1 });
  }
  return result;
}

// ─── Zmanim stripe segment (absolute, inside left gutter) ────────────────────
function ZmanimStripeSegment({
  hour,
  zmanim,
  timeFormat,
}: {
  hour: number;
  zmanim: DayZmanim;
  timeFormat: CalendarTimeFormat;
}) {
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const info = getHourZmanInfo(hour, zmanim);
  // Only render a tooltip if this period has something interesting to show
  const hasContent = info.boundaries.length > 0 || info.periodName !== "Night";

  return (
    <div
      className="absolute"
      style={{ left: 0, top: (hour - TIMELINE_START_HOUR) * PX_PER_HOUR, width: 4, height: PX_PER_HOUR }}
    >
      <div
        className="absolute inset-0 cursor-default rounded-[1px] pointer-events-auto"
        style={{ backgroundColor: info.color }}
        onMouseEnter={(e) => hasContent && setMousePos({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => hasContent && setMousePos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setMousePos(null)}
      />
      {mousePos && hasContent && (
        <div
          className="pointer-events-none fixed z-[9999] min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-xl"
          style={{ left: mousePos.x + 14, top: mousePos.y - 8 }}
        >
          <p className="text-[11px] font-bold text-slate-700">{info.periodName}</p>
          {info.boundaries.map((b) => (
            <p key={b.label} className="mt-0.5 text-[10px] text-slate-500">
              {b.label}: {formatZmanTime(b.time, zmanim.tzid, timeFormat)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Minor grid lines ─────────────────────────────────────────────────────────
function MinorGridLines({ snapMins }: { snapMins: number }) {
  if (snapMins >= 60) return null;
  const lines: { offset: number; is30: boolean }[] = [];
  const totalMins = TIMELINE_TOTAL_HOURS * 60;
  for (let m = 0; m < totalMins; m += snapMins) {
    if (m % 60 === 0) continue; // skip whole hours (handled by main lines)
    lines.push({ offset: m, is30: m % 30 === 0 });
  }
  return (
    <>
      {lines.map(({ offset, is30 }) => (
        <div
          key={offset}
          className="absolute pointer-events-none"
          style={{
            left: LEFT_GUTTER,
            right: 0,
            top: offset,
            borderTop: `1px solid ${is30 ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.08)"}`,
          }}
        />
      ))}
    </>
  );
}

// ─── Drop slot ────────────────────────────────────────────────────────────────
function DropSlot({ minutesFromStart, snapMins }: { minutesFromStart: number; snapMins: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `time-slot:${minutesFromStart}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute z-0 transition-colors",
        isOver && "bg-brand/[0.06]",
      )}
      style={{
        left: LEFT_GUTTER,
        right: 0,
        top: minutesFromStart,
        height: snapMins,
      }}
    />
  );
}

// ─── Event block ──────────────────────────────────────────────────────────────
function EventBlock({
  assignment,
  goal,
  colIdx,
  totalCols,
  defaultDurationMins,
  snapMins,
  timeFormat,
  onToggle,
  onUnschedule,
  onSetDuration,
  onRenameGoal,
}: {
  assignment: DayAssignment;
  goal: Goal;
  colIdx: number;
  totalCols: number;
  defaultDurationMins: number;
  snapMins: number;
  timeFormat: "12h" | "24h";
  onToggle: (id: string) => void;
  onUnschedule: (id: string) => void;
  onSetDuration: (id: string, mins: number) => void;
  onRenameGoal: (goalId: string, nextTitle: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: `timeline:${assignment.id}`,
  });

  // Live resize preview (px delta while dragging resize handle)
  const [resizeDeltaPx, setResizeDeltaPx] = useState(0);
  const isResizingRef = useRef(false);

  const startMins = parseHHMM(assignment.scheduledTime ?? "00:00");
  const baseDuration = assignment.durationMins ?? defaultDurationMins;
  // Apply live preview: snap delta to grid, convert px → mins (1px = 1min)
  const previewDuration = isResizingRef.current
    ? Math.max(snapMins, Math.round((baseDuration + resizeDeltaPx) / snapMins) * snapMins)
    : baseDuration;
  const topPx = (startMins - TIMELINE_START_HOUR * 60) * (PX_PER_HOUR / 60);
  const heightPx = Math.max(MIN_EVENT_HEIGHT_PX, previewDuration * (PX_PER_HOUR / 60));

  // Positioned relative to the events wrapper (which starts at LEFT_GUTTER)
  const style: React.CSSProperties = {
    position: "absolute",
    top: topPx,
    height: heightPx,
    left: `${(colIdx / totalCols) * 100}%`,
    width: `calc(${100 / totalCols}% - 2px)`,
    zIndex: isDragging ? 50 : 10,
    ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}),
  };

  const endMins = startMins + previewDuration;
  const timeRange = `${formatMinutesAsTime(startMins, timeFormat)}–${formatMinutesAsTime(endMins, timeFormat)}`;

  const RESIZE_H = 8;
  // Tiers based on full event height (1px = 1min)
  const showTimeRange = heightPx >= 44;          // 45 min+
  const tinyCheckbox  = heightPx <= 20;          // clamped 15-min events only
  const topAlign      = heightPx >= 40;          // 45 min and 1hr → top; 15/30 min → center

  function handleResizePointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    const startY = e.clientY;
    isResizingRef.current = true;

    function onMove(ev: PointerEvent) {
      setResizeDeltaPx(ev.clientY - startY);
    }

    function onUp(ev: PointerEvent) {
      isResizingRef.current = false;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      const delta = ev.clientY - startY;
      const newDuration = Math.max(snapMins, Math.round((baseDuration + delta) / snapMins) * snapMins);
      setResizeDeltaPx(0);
      onSetDuration(assignment.id, newDuration);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={cn(
        // Outer div IS the flex row — alignment uses full heightPx, not a cropped bodyH
        "group relative flex gap-1 px-1.5 cursor-grab select-none touch-none rounded-md border overflow-hidden active:cursor-grabbing",
        topAlign ? "items-start pt-1" : "items-center",
        assignment.completed
          ? "border-success/20 bg-success/[0.08]"
          : "border-brand/20 bg-brand/[0.07]",
        isDragging && "opacity-40",
      )}
    >
      <Checkbox
        checked={assignment.completed}
        onChange={() => onToggle(assignment.id)}
        size={tinyCheckbox ? "xs" : "sm"}
        className={tinyCheckbox ? undefined : "h-3.5 w-3.5"}
        uncheckedClassName="bg-white/80"
      />

      {/* Text column */}
      <div className="min-w-0 flex-1">
        <EditableGoalTitle
          title={goal.title}
          onRename={isPrebuiltGoal(goal.id) ? undefined : (nextTitle) => onRenameGoal(goal.id, nextTitle)}
          className={cn(
            "font-semibold leading-none",
            tinyCheckbox ? "text-[10px]" : "text-[10.5px]",
            assignment.completed ? "text-slate-400 line-through decoration-slate-300" : "text-slate-800",
          )}
          inputClassName={cn(tinyCheckbox ? "text-[10px] font-semibold" : "text-[10.5px] font-semibold")}
        />
        {showTimeRange && (
          <p className="mt-[2px] text-[9px] leading-none text-slate-400 truncate">{timeRange}</p>
        )}
      </div>

      {/* Remove — hover only */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onUnschedule(assignment.id); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-3 w-3 text-slate-300 hover:text-red-400" strokeWidth={2.5} />
      </button>

      {/* Resize handle — absolute, does NOT participate in flex layout */}
      <div
        onPointerDown={handleResizePointerDown}
        className="absolute bottom-0 left-0 right-0 cursor-s-resize z-20 flex items-center justify-center"
        style={{ height: RESIZE_H }}
      >
        <div className="w-6 h-[2px] rounded-full bg-slate-400/30 group-hover:bg-slate-400/60 transition-colors" />
      </div>
    </div>
  );
}

// ─── Left panel: DayTimeline ─────────────────────────────────────────────────
function DayTimeline({
  assignments,
  goals,
  isoDate,
  onToggle,
  onUnschedule,
  onSetDuration,
  onRenameGoal,
  zmanim,
  timeFormat,
  snapMins,
  defaultDurationMins,
  onPreferenceChange,
}: {
  assignments: DayAssignment[];
  goals: Goal[];
  isoDate: string;
  onToggle: (id: string) => void;
  onUnschedule: (id: string) => void;
  onSetDuration: (id: string, mins: number) => void;
  onRenameGoal: (goalId: string, nextTitle: string) => void;
  zmanim?: DayZmanim;
  timeFormat: "12h" | "24h";
  snapMins: number;
  defaultDurationMins: number;
  onPreferenceChange: (key: "timelineSnapMins" | "timelineDefaultDurationMins", value: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isToday = isoDate === todayIso();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Current time indicator — null until mounted to avoid SSR/client mismatch
  const [currentTime, setCurrentTime] = useState<string | null>(null);
  useEffect(() => {
    if (!isToday) return;
    setCurrentTime(nowTime());
    const id = setInterval(() => setCurrentTime(nowTime()), 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  // Auto-scroll to current hour on mount
  useEffect(() => {
    if (!isToday || !scrollRef.current) return;
    const hour = new Date().getHours();
    const clampedHour = Math.max(TIMELINE_START_HOUR, Math.min(TIMELINE_START_HOUR + TIMELINE_TOTAL_HOURS - 1, hour));
    scrollRef.current.scrollTop = Math.max(0, (clampedHour - TIMELINE_START_HOUR) * PX_PER_HOUR - 120);
  }, [isToday]);

  // Current time position (null until mounted)
  const ctMinsFromStart = currentTime ? parseHHMM(currentTime) - TIMELINE_START_HOUR * 60 : -1;
  const currentTimeLabel = formatClockTime(currentTime ?? undefined, timeFormat);

  // Scheduled assignments with valid times
  const scheduledAssignments = useMemo(() =>
    assignments.filter((a) => {
      const t = a.scheduledTime;
      return t !== undefined && !isNaN(parseHHMM(t));
    }).map((a) => {
      const startMins = parseHHMM(a.scheduledTime ?? "00:00");
      const dur = a.durationMins ?? defaultDurationMins;
      return { assignment: a, startMins, endMins: startMins + dur };
    }),
    [assignments, defaultDurationMins],
  );

  // Column layout for overlapping events
  const colLayout = useMemo(() =>
    layoutEvents(scheduledAssignments.map(({ assignment, startMins, endMins }) => ({
      id: assignment.id, startMins, endMins,
    }))),
    [scheduledAssignments],
  );

  const snapOptions: { label: string; value: number }[] = [
    { label: "5m", value: 5 },
    { label: "15m", value: 15 },
    { label: "30m", value: 30 },
    { label: "60m", value: 60 },
  ];
  const durationOptions: { label: string; value: number }[] = [
    { label: "15m", value: 15 },
    { label: "30m", value: 30 },
    { label: "45m", value: 45 },
    { label: "1h", value: 60 },
    { label: "1.5h", value: 90 },
    { label: "2h", value: 120 },
  ];

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Timeline</p>
        <button
          type="button"
          onClick={() => setSettingsOpen((s) => !s)}
          className={cn(
            "rounded-md p-1 transition-colors",
            settingsOpen ? "bg-slate-100 text-slate-600" : "text-slate-300 hover:text-slate-500",
          )}
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Inline settings panel */}
      {settingsOpen && (
        <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <span className="w-28 shrink-0 text-[10.5px] font-semibold text-slate-500">Snap to grid</span>
            <div className="flex gap-1">
              {snapOptions.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onPreferenceChange("timelineSnapMins", value)}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold transition-colors",
                    snapMins === value
                      ? "bg-brand text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-28 shrink-0 text-[10.5px] font-semibold text-slate-500">Default duration</span>
            <div className="flex flex-wrap gap-1">
              {durationOptions.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onPreferenceChange("timelineDefaultDurationMins", value)}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold transition-colors",
                    defaultDurationMins === value
                      ? "bg-brand text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Scroll container — always clip x, scroll y */}
      <div
        ref={scrollRef}
        className="relative h-[600px] overflow-y-auto overflow-x-hidden"
      >
        <div className="relative" style={{ height: TOTAL_HEIGHT_PX }}>
          {scheduledAssignments.length === 0 && (
            <TaskListEmptyState
              message="Nothing is on the calendar yet."
              description="Drag a checklist item here to give it a start time."
              className="pointer-events-none absolute left-[68px] right-4 top-5 z-10 rounded-xl border border-dashed border-slate-200 bg-slate-50/85 px-4 py-3 shadow-sm"
            />
          )}

          {/* Left gutter: zmanim stripe + hour labels */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-20"
            style={{ left: 0, width: LEFT_GUTTER }}
          >
            {/* Zmanim stripe segments */}
            {zmanim && (
              <div className="pointer-events-auto">
                {HOURS.map((hour) => (
                  <ZmanimStripeSegment key={hour} hour={hour} zmanim={zmanim} timeFormat={timeFormat} />
                ))}
              </div>
            )}
            {/* Hour labels */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute flex items-start"
                style={{ top: (hour - TIMELINE_START_HOUR) * PX_PER_HOUR, left: 4, width: LEFT_GUTTER - 4 }}
              >
                <div className="w-full text-right pr-1 pt-0.5">
                  <span className="text-[10.5px] tabular-nums text-slate-400">{formatHourLabel(hour, timeFormat)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Hour separator lines */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute border-t border-slate-100 pointer-events-none"
              style={{ left: LEFT_GUTTER, right: 0, top: (hour - TIMELINE_START_HOUR) * PX_PER_HOUR }}
            />
          ))}

          {/* Minor grid lines */}
          <MinorGridLines snapMins={snapMins} />

          {/* Drop slots */}
          {Array.from({ length: Math.floor((TIMELINE_TOTAL_HOURS * 60) / snapMins) }, (_, i) => (
            <DropSlot key={i} minutesFromStart={i * snapMins} snapMins={snapMins} />
          ))}

          {/* Event blocks — inside a gutter-offset container so % widths don't include the gutter */}
          <div className="absolute top-0 bottom-0" style={{ left: LEFT_GUTTER, right: 0 }}>
            {scheduledAssignments.map(({ assignment }) => {
              const goal = goals.find((g) => g.id === assignment.goalId);
              if (!goal) return null;
              const layout = colLayout.get(assignment.id) ?? { colIdx: 0, totalCols: 1 };
              return (
                <EventBlock
                  key={assignment.id}
                  assignment={assignment}
                  goal={goal}
                  colIdx={layout.colIdx}
                  totalCols={layout.totalCols}
                  defaultDurationMins={defaultDurationMins}
                  snapMins={snapMins}
                  timeFormat={timeFormat}
                  onToggle={onToggle}
                  onUnschedule={onUnschedule}
                  onSetDuration={onSetDuration}
                  onRenameGoal={onRenameGoal}
                />
              );
            })}
          </div>

          {/* Current time indicator */}
          {isToday && ctMinsFromStart >= 0 && ctMinsFromStart <= TOTAL_HEIGHT_PX && (
            <div
              className="absolute pointer-events-none z-20 flex items-center gap-1"
              style={{ top: ctMinsFromStart, left: LEFT_GUTTER, right: 0 }}
            >
              <span className="rounded-full bg-brand px-1.5 py-[1px] text-[9px] font-bold tabular-nums text-white">
                {currentTimeLabel}
              </span>
              <div className="h-[2px] flex-1 rounded-full bg-brand/40" />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Checklist items ──────────────────────────────────────────────────────────
function TimingPill({ value }: { value: string }) {
  return (
    <span
      className="shrink-0 rounded-full border border-brand/15 bg-brand/[0.08] px-2 py-[2px] text-[9.5px] font-semibold text-brand/75"
    >
      {value}
    </span>
  );
}

function DailyCheckItem({
  goal,
  isoDate,
  isToday,
  now,
  allIds,
  onToggle,
  onReorderGoals,
  zmanim,
  onRenameGoal,
  backlogEntries,
}: {
  goal: Goal;
  isoDate: string;
  isToday: boolean;
  now: Date;
  allIds: string[];
  onToggle: (goalId: string, isoDate: string, source?: "checklist") => void;
  onReorderGoals: (prev: string[], next: string[]) => void;
  zmanim?: DayZmanim;
  onRenameGoal: (goalId: string, nextTitle: string) => void;
  backlogEntries: DailyBacklogEntry[];
}) {
  const isDone = goal.completedDates?.includes(isoDate) ?? false;
  const timeState = getGoalTimeStateForNow(goal, zmanim, isToday, now);
  const countdown = isToday ? computeGoalCountdown(goal, zmanim, now, isDone) : null;
  const programLabel = getGoalProgramLabel(goal, new Date(`${isoDate}T00:00:00`));
  const activeDays = goal.activeDays;
  const baseSubtitle =
    activeDays && activeDays.length > 0 && activeDays.length < 7
      ? `Daily · ${activeDays[0]}–${activeDays[activeDays.length - 1]}`
      : "Daily";
  const subtitle =
    countdown
      ? `${baseSubtitle} · ${countdown.label}`
      : timeState === "expired" ? `${baseSubtitle} · expired`
      : timeState === "not-yet" ? `${baseSubtitle} · not yet`
      : baseSubtitle;

  const [isSortDragging, setIsSortDragging] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: `daily:${goal.id}`,
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 999 } : undefined;

  return (
    <GoalListRow
      density="comfortable"
      rowRef={setNodeRef}
      rootProps={{ ...listeners, ...attributes }}
      style={style}
      className={cn(
        "cursor-grab select-none touch-none active:cursor-grabbing",
        (isDragging || isSortDragging)
          ? "bg-brand/[0.05] shadow-sm ring-1 ring-brand/15"
          : "hover:bg-slate-50",
        (isDragging || isSortDragging) && "opacity-40",
        !isDragging && !isSortDragging && timeState !== "active" && "opacity-50",
      )}
      leading={(
        <ReorderGrip
          itemId={goal.id}
          itemIds={allIds}
          onReorder={onReorderGoals}
          rowStepPx={40}
          onDragStart={() => setIsSortDragging(true)}
          onDragEnd={() => setIsSortDragging(false)}
          className={cn("mt-[3px] group-hover:text-slate-400", (isDragging || isSortDragging) && "text-brand")}
        />
      )}
      checkbox={(
        <Checkbox
          checked={isDone}
          onChange={() => onToggle(goal.id, isoDate, "checklist")}
          size="md"
          uncheckedClassName="hover:border-slate-300"
        />
      )}
      content={(
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <EditableGoalTitle
              title={goal.title}
              onRename={isPrebuiltGoal(goal.id) ? undefined : (nextTitle) => onRenameGoal(goal.id, nextTitle)}
              className={cn(
                "text-[13.5px] font-semibold leading-tight text-slate-800 transition-colors",
                isDone && "text-slate-400 line-through decoration-slate-300",
              )}
              inputClassName="text-[13.5px] font-semibold"
            />
            <DailyBacklogBadge
              goalTitle={goal.title}
              entries={backlogEntries}
              onResolveDate={(date) => onToggle(goal.id, date)}
              compact
            />
          </div>
          {(() => {
            const stateLabel = countdown ? countdown.label : timeState === "expired" ? "expired" : timeState === "not-yet" ? "not yet" : null;
            const parts = [programLabel, stateLabel].filter(Boolean);
            if (!parts.length) return null;
            return (
              <p className={cn(
                "mt-0.5 truncate text-[11px]",
                countdown?.urgent ? "font-semibold text-amber-500" : "text-slate-400",
              )}>{parts.join(" · ")}</p>
            );
          })()}
        </div>
      )}
    />
  );
}

function AssignedCheckItem({
  goal,
  assignment,
  actionId,
  collapsed,
  displayAmount,
  isToday,
  now,
  timeFormat,
  allIds,
  onToggle,
  onRemove,
  onResolveBacklogDate,
  onReorderGoals,
  zmanim,
  onRenameGoal,
  backlogEntries,
}: {
  goal: Goal;
  assignment: DayAssignment;
  actionId: string;
  collapsed: boolean;
  displayAmount: number;
  isToday: boolean;
  now: Date;
  timeFormat: "12h" | "24h";
  allIds: string[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onResolveBacklogDate: (goalId: string, isoDate: string) => void;
  onReorderGoals: (prev: string[], next: string[]) => void;
  zmanim?: DayZmanim;
  onRenameGoal: (goalId: string, nextTitle: string) => void;
  backlogEntries: DailyBacklogEntry[];
}) {
  const [isSortDragging, setIsSortDragging] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: collapsed ? `checklist-collapsed:${assignment.id}` : `assignment:${assignment.id}`,
    disabled: collapsed,
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 999 } : undefined;

  const isDone = assignment.completed;
  const timeState = getGoalTimeStateForNow(goal, zmanim, isToday, now);
  const countdown = isToday ? computeGoalCountdown(goal, zmanim, now, isDone) : null;
  const programLabel = getGoalProgramLabel(goal, new Date(`${assignment.date}T00:00:00`));

  const cadenceLabel =
    goal.cadence === "one-time" && goal.adhoc
      ? "Task"
      : goal.cadence.charAt(0).toUpperCase() + goal.cadence.slice(1);

  const activeDaysLabel =
    goal.cadence === "daily" && goal.activeDays && goal.activeDays.length > 0 && goal.activeDays.length < 7
      ? `${goal.activeDays[0]}–${goal.activeDays[goal.activeDays.length - 1]}`
      : null;

  const subtitleParts = [
    cadenceLabel,
    activeDaysLabel,
    goal.type === "quantified" && displayAmount ? `${displayAmount} ${goal.targetUnit ?? "units"}` : null,
    countdown
      ? countdown.label
      : timeState === "expired" ? "expired" : timeState === "not-yet" ? "not yet" : null,
  ].filter(Boolean);
  const subtitle = subtitleParts.join(" · ");
  const timeLabel = formatClockTime(assignment.scheduledTime ?? assignment.completedAt, timeFormat);

  return (
    <GoalListRow
      density="comfortable"
      rowRef={setNodeRef}
      rootProps={!collapsed ? { ...listeners, ...attributes } : undefined}
      style={style}
      className={cn(
        "select-none touch-none active:cursor-grabbing",
        (isDragging || isSortDragging)
          ? "bg-brand/[0.05] shadow-sm ring-1 ring-brand/15"
          : "hover:bg-slate-50",
        (isDragging || isSortDragging) ? "opacity-40" : null,
        !collapsed && "cursor-grab",
        !isDragging && !isSortDragging && timeState !== "active" && !assignment.completed && "opacity-50",
      )}
      leading={(
        <ReorderGrip
          itemId={goal.id}
          itemIds={allIds}
          onReorder={onReorderGoals}
          rowStepPx={40}
          onDragStart={() => setIsSortDragging(true)}
          onDragEnd={() => setIsSortDragging(false)}
          className={cn("mt-[3px] group-hover:text-slate-400", (isDragging || isSortDragging) && "text-brand")}
        />
      )}
      checkbox={(
        <Checkbox
          checked={assignment.completed}
          onChange={() => onToggle(actionId)}
          size="md"
          uncheckedClassName="hover:border-slate-300"
        />
      )}
      content={(
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <EditableGoalTitle
              title={goal.title}
              onRename={isPrebuiltGoal(goal.id) ? undefined : (nextTitle) => onRenameGoal(goal.id, nextTitle)}
              className={cn(
                "text-[13.5px] font-semibold leading-tight text-slate-800 transition-colors",
                assignment.completed && "text-slate-400 line-through decoration-slate-300",
              )}
              inputClassName="text-[13.5px] font-semibold"
            />
            <DailyBacklogBadge
              goalTitle={goal.title}
              entries={backlogEntries}
              onResolveDate={(date) => onResolveBacklogDate(goal.id, date)}
              compact
            />
          </div>
          {(() => {
            const parts = [programLabel, subtitle].filter(Boolean);
            if (!parts.length) return null;
            return (
              <p className={cn(
                "mt-0.5 truncate text-[11px]",
                countdown?.urgent ? "font-semibold text-amber-500" : "text-slate-400",
              )}>{parts.join(" · ")}</p>
            );
          })()}
        </div>
      )}
      trailing={(
        <div className="flex shrink-0 items-center gap-1">
          {!collapsed && timeLabel && <TimingPill value={timeLabel} />}
          {!goal.lockInDays && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(actionId); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="rounded-full p-0.5 text-slate-300 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
            >
              <X className="h-3 w-3" strokeWidth={2.5} />
            </button>
          )}
        </div>
      )}
    />
  );
}

// ─── Right panel: DayChecklist ────────────────────────────────────────────────
function DayChecklist({
  date,
  relativeLabel,
  metadata,
  occurrences,
  isoDate,
  isToday,
  timeFormat,
  onToggleDate,
  onToggleAssignment,
  onRemoveAssignment,
  onAddTask,
  onNavigateToDate,
  onRenameGoal,
  onReorderGoals,
  zmanim,
  backlogEntriesByGoal,
}: {
  date: Date;
  relativeLabel: string;
  metadata?: CalendarDayMetadata;
  occurrences: GoalOccurrence[];
  isoDate: string;
  isToday: boolean;
  timeFormat: "12h" | "24h";
  onToggleDate: (goalId: string, isoDate: string, source?: "checklist") => void;
  onToggleAssignment: (id: string) => void;
  onRemoveAssignment: (id: string) => void;
  onAddTask: (title: string, isoDate: string) => void;
  onNavigateToDate: (date: Date) => void;
  onRenameGoal: (goalId: string, nextTitle: string) => void;
  onReorderGoals?: (prev: string[], next: string[]) => void;
  zmanim?: DayZmanim;
  backlogEntriesByGoal: Map<string, DailyBacklogEntry[]>;
}) {
  const [now, setNow] = useState(() => new Date());
  const { setNodeRef: setDropRef, isOver: isOverChecklist } = useDroppable({ id: isoDate });

  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [isToday]);

  const itemIds = [...new Set(occurrences.map((occurrence) => occurrence.goal.id))];

  const totalCount = occurrences.length;
  const completedCount = occurrences.filter((occurrence) => occurrence.completed).length;
  const allDone = totalCount > 0 && completedCount === totalCount;

  const tomorrow = addDays(date, 1);

  const timePills = buildCalendarMetaPills(metadata);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {/* Day header */}
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">
              {relativeLabel}
            </p>
            <h2 className="mt-0.5 text-[1.75rem] font-black leading-none tracking-tight text-slate-900">
              {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h2>
            {metadata?.hebrewDateLabel && (
              <p className="mt-1 text-[12px] font-medium text-slate-500">{metadata.hebrewDateLabel}</p>
            )}
            {(metadata?.holidays?.[0] || metadata?.parsha) && (
              <p className="mt-0.5 text-[12px] font-semibold text-slate-700">
                {metadata?.holidays?.[0] ?? metadata?.parsha}
              </p>
            )}
          </div>
          <CalendarMetaPills pills={timePills} density="comfortable" orientation="vertical" align="end" className="pt-1" />
        </div>
      </div>

      {/* All-done banner */}
      {allDone && (
        <CompletionBanner message="All done for today - great work!" className="mx-4 mt-4" />
      )}

      {/* Task list — also a drop target for goal pills from the tray */}
      <div
        ref={setDropRef}
        className={cn(
          "flex flex-1 flex-col gap-px px-3 py-3 transition-colors",
          isOverChecklist && "bg-brand/[0.025]",
        )}
      >
        {/* Unified sorted goal list */}
        {occurrences.map((item) =>
          item.source === "auto" ? (
            <DailyCheckItem
              key={item.id}
              goal={item.goal}
              isoDate={isoDate}
              isToday={isToday}
              now={now}
              allIds={itemIds}
              onToggle={onToggleDate}
              onReorderGoals={onReorderGoals ?? (() => {})}
              zmanim={zmanim}
              onRenameGoal={onRenameGoal}
              backlogEntries={backlogEntriesByGoal.get(item.goal.id) ?? []}
            />
          ) : (
            <AssignedCheckItem
              key={item.id}
              goal={item.goal}
              assignment={item.assignment}
              actionId={item.actionId}
              collapsed={item.collapsed}
              displayAmount={item.displayAmount}
              isToday={isToday}
              now={now}
              timeFormat={timeFormat}
              allIds={itemIds}
              onToggle={onToggleAssignment}
              onRemove={onRemoveAssignment}
              onResolveBacklogDate={onToggleDate}
              onReorderGoals={onReorderGoals ?? (() => {})}
              zmanim={zmanim}
              onRenameGoal={onRenameGoal}
              backlogEntries={backlogEntriesByGoal.get(item.goal.id) ?? []}
            />
          ),
        )}

        {/* Empty state */}
        {totalCount === 0 && (
          <TaskListEmptyState
            message="No tasks are in the checklist yet."
            description="Drag a goal onto the timeline or add a one-off task below."
            className="px-2 py-2"
          />
        )}

        <InlineAddTask
          onAddTask={(title) => onAddTask(title, isoDate)}
          density="comfortable"
          addLabel="+ Add one-off task"
          placeholder="Quick task for today…"
        />
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <CompletionCount completedCount={completedCount} totalCount={totalCount} />

          <button
            type="button"
            onClick={() => onNavigateToDate(tomorrow)}
            className={cn(
              "rounded-xl px-4 py-2 text-[12.5px] font-semibold transition-all",
              allDone
                ? "animate-pulse bg-success text-white shadow-sm hover:bg-success/90 [animation-iteration-count:3]"
                : "text-slate-400 hover:text-brand",
            )}
          >
            Plan Tomorrow →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function DayFocus({
  date,
  relativeLabel,
  goals,
  dayAssignments,
  excludedByGoal,
  metadata,
  onToggleDate,
  onToggleAssignment,
  onRemoveAssignment,
  onUnscheduleAssignment,
  onAddTask,
  onSetScheduledTime,
  onNavigateToDate,
  onRenameGoal,
  zmanim,
  timeFormat = "24h",
  timelineSnapMins,
  timelineDefaultDurationMins,
  onTimelinePreferenceChange,
  onSetDuration,
  goalOrder = [],
  onReorderGoals,
}: DayFocusProps) {
  const isoDate = toIsoDate(date);
  const isToday = isoDate === todayIso();
  const backlogToday = todayIso();
  const backlogEntriesByGoal = useMemo(
    () => new Map(goals.map((goal) => [goal.id, getDailyBacklogEntries(goal, new Date())])),
    [goals, backlogToday],
  );

  const assignedItems = dayAssignments
    .filter((a) => a.date === isoDate && !a.skipped)
    .map((a) => ({ assignment: a, goal: goals.find((g) => g.id === a.goalId) }))
    .filter((item): item is { assignment: DayAssignment; goal: Goal } => item.goal !== undefined);
  const occurrences = sortGoalOccurrences(
    buildGoalOccurrencesForDate({
      date,
      goals,
      dayAssignments,
      excludedByGoal,
    }),
    goalOrder,
  );

  return (
    <div className="grid grid-cols-[1fr_1.5fr] gap-4">
      <DayTimeline
        assignments={assignedItems.map((i) => i.assignment)}
        goals={goals}
        isoDate={isoDate}
        onToggle={onToggleAssignment}
        onUnschedule={onUnscheduleAssignment}
        onSetDuration={onSetDuration}
        onRenameGoal={onRenameGoal}
        zmanim={zmanim}
        timeFormat={timeFormat}
        snapMins={timelineSnapMins}
        defaultDurationMins={timelineDefaultDurationMins}
        onPreferenceChange={onTimelinePreferenceChange}
      />
      <DayChecklist
        date={date}
        relativeLabel={relativeLabel}
        metadata={metadata}
        occurrences={occurrences}
        isoDate={isoDate}
        isToday={isToday}
        timeFormat={timeFormat}
        onToggleDate={onToggleDate}
        onToggleAssignment={onToggleAssignment}
        onRemoveAssignment={onRemoveAssignment}
        onAddTask={onAddTask}
        onNavigateToDate={onNavigateToDate}
        onRenameGoal={onRenameGoal}
        onReorderGoals={onReorderGoals}
        zmanim={zmanim}
        backlogEntriesByGoal={backlogEntriesByGoal}
      />
    </div>
  );
}
