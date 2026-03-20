"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { Check, X, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import { toIsoDate, todayIso, addDays } from "@/lib/date";
import { getApplicableGoalsForDate } from "@/features/goals/lib/goal-progress";
import type { CalendarDayMetadata } from "@/features/calendar/types/calendar";
import type { Goal } from "@/features/goals/types/goal";
import type { DayAssignment } from "@/features/planner/lib/day-assignment-store";
import type { DayZmanim } from "@/features/calendar/lib/zmanim";
import { getHourZmanInfo, formatZmanTime } from "@/features/calendar/lib/zmanim";
import type { CalendarTimeFormat } from "@/features/settings/types/calendar-preferences";

interface DayFocusProps {
  date: Date;
  relativeLabel: string;
  goals: Goal[];
  dayAssignments: DayAssignment[];
  excludedByGoal: Map<string, Set<string>>;
  metadata?: CalendarDayMetadata;
  onToggleDate: (goalId: string, isoDate: string) => void;
  onToggleAssignment: (id: string) => void;
  onRemoveAssignment: (assignmentId: string) => void;
  onAddTask: (title: string, isoDate: string) => void;
  onSetScheduledTime: (assignmentId: string, time: string | null) => void;
  onNavigateToDate: (date: Date) => void;
  showOmer?: boolean;
  completedOmerDates?: Set<string>;
  onToggleOmer?: (isoDate: string) => void;
  zmanim?: DayZmanim;
  timeFormat?: CalendarTimeFormat;
  timelineSnapMins: number;
  timelineDefaultDurationMins: number;
  onTimelinePreferenceChange: (key: "timelineSnapMins" | "timelineDefaultDurationMins", value: number) => void;
  onSetDuration: (assignmentId: string, durationMins: number) => void;
}

// ─── Timeline constants ───────────────────────────────────────────────────────
const TIMELINE_START_HOUR = 5;
const PX_PER_HOUR = 60;           // 1px = 1 min
const TOTAL_HEIGHT_PX = 19 * 60;  // 1140px  (5am–midnight)
const LEFT_GUTTER = 52;           // 4px zmanim stripe + 40px labels + 8px gap
const MIN_EVENT_HEIGHT_PX = 20;

const HOURS = Array.from({ length: 19 }, (_, i) => i + TIMELINE_START_HOUR); // 5–23

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatHour(h: number): string {
  if (h === 0 || h === 24) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function nowTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
}

function parseHHMM(timeStr: string): number {
  if (!timeStr) return NaN;
  const colonIdx = timeStr.indexOf(":");
  if (colonIdx === -1) return NaN;
  const h = parseInt(timeStr.slice(0, colonIdx), 10);
  const m = parseInt(timeStr.slice(colonIdx + 1), 10);
  if (isNaN(h) || isNaN(m)) return NaN;
  return h * 60 + m;
}

function formatMinutesAsTime(totalMins: number, format: "12h" | "24h"): string {
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  const mm = m.toString().padStart(2, "0");
  if (format === "24h") return `${h.toString().padStart(2, "0")}:${mm}`;
  const period = h < 12 ? "am" : "pm";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${period}` : `${h12}:${mm}${period}`;
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
          className="pointer-events-none fixed z-[200] min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-xl"
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
  const totalMins = 19 * 60;
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
  onRemove,
  onSetDuration,
}: {
  assignment: DayAssignment;
  goal: Goal;
  colIdx: number;
  totalCols: number;
  defaultDurationMins: number;
  snapMins: number;
  timeFormat: "12h" | "24h";
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onSetDuration: (id: string, mins: number) => void;
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

  // Fixed 8px resize handle at bottom; body fills the rest
  const RESIZE_H = 8;
  const bodyH = Math.max(0, heightPx - RESIZE_H);
  // Content density tiers
  const showTimeRange = bodyH >= 36;
  const tinyCheckbox = bodyH < 18; // 12px checkbox vs 14px

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
        "group cursor-grab select-none touch-none rounded-md border overflow-hidden active:cursor-grabbing",
        assignment.completed
          ? "border-success/20 bg-success/[0.08]"
          : "border-brand/20 bg-brand/[0.07]",
        isDragging && "opacity-40",
      )}
    >
      {/* Body — vertically centered, always fills available height above resize handle */}
      <div
        className="flex items-center gap-1 px-1.5"
        style={{ height: bodyH }}
      >
        {/* Checkbox */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(assignment.id); }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full border transition-all",
            tinyCheckbox ? "h-3 w-3" : "h-3.5 w-3.5",
            assignment.completed
              ? "border-success bg-success"
              : "border-slate-300 bg-white/80 hover:border-brand/50",
          )}
        >
          {assignment.completed && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
        </button>

        {/* Text column */}
        <div className="min-w-0 flex-1">
          <p className={cn(
            "font-semibold leading-none truncate",
            tinyCheckbox ? "text-[10px]" : "text-[10.5px]",
            assignment.completed ? "text-slate-400 line-through decoration-slate-300" : "text-slate-800",
          )}>
            {goal.title}
          </p>
          {showTimeRange && (
            <p className="mt-[2px] text-[9px] leading-none text-slate-400 truncate">{timeRange}</p>
          )}
        </div>

        {/* Remove — hover only */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(assignment.id); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3 text-slate-300 hover:text-red-400" strokeWidth={2.5} />
        </button>
      </div>

      {/* Resize handle */}
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
  onRemove,
  onSetDuration,
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
  onRemove: (id: string) => void;
  onSetDuration: (id: string, mins: number) => void;
  zmanim?: DayZmanim;
  timeFormat: "12h" | "24h";
  snapMins: number;
  defaultDurationMins: number;
  onPreferenceChange: (key: "timelineSnapMins" | "timelineDefaultDurationMins", value: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isToday = isoDate === todayIso();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Current time indicator
  const [currentTime, setCurrentTime] = useState(nowTime());
  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => setCurrentTime(nowTime()), 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  // Auto-scroll to current hour on mount
  useEffect(() => {
    if (!isToday || !scrollRef.current) return;
    const hour = new Date().getHours();
    const clampedHour = Math.max(TIMELINE_START_HOUR, Math.min(23, hour));
    scrollRef.current.scrollTop = Math.max(0, (clampedHour - TIMELINE_START_HOUR) * PX_PER_HOUR - 120);
  }, [isToday]);

  // Current time position
  const [ctH, ctM] = currentTime.split(":").map(Number);
  const ctMinsFromStart = (ctH * 60 + ctM) - TIMELINE_START_HOUR * 60;

  // Scheduled assignments with valid times
  const scheduledAssignments = useMemo(() =>
    assignments.filter((a) => {
      const t = a.scheduledTime ?? a.completedAt;
      return t && !isNaN(parseHHMM(t));
    }).map((a) => {
      const startMins = parseHHMM(a.scheduledTime ?? a.completedAt ?? "00:00");
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

          {/* Left gutter: zmanim stripe + hour labels */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-10"
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
                  <span className="text-[10.5px] tabular-nums text-slate-400">{formatHour(hour)}</span>
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
          {Array.from({ length: Math.floor((19 * 60) / snapMins) }, (_, i) => (
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
                  onRemove={onRemove}
                  onSetDuration={onSetDuration}
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
                {currentTime}
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
function DailyCheckItem({
  goal,
  isoDate,
  onToggle,
}: {
  goal: Goal;
  isoDate: string;
  onToggle: (goalId: string, isoDate: string) => void;
}) {
  const isDone = goal.completedDates?.includes(isoDate) ?? false;
  const activeDays = goal.activeDays;
  const subtitle =
    activeDays && activeDays.length > 0 && activeDays.length < 7
      ? `Daily · ${activeDays[0]}–${activeDays[activeDays.length - 1]}`
      : "Daily";

  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: `daily:${goal.id}`,
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 999 } : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={cn(
        "group flex w-full cursor-grab select-none touch-none items-start gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-50 active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      {/* Drag handle — visual only */}
      <div className="mt-[3px] shrink-0 text-slate-300 group-hover:text-slate-400 transition-colors">
        <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
          <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
          <circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/>
          <circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/>
        </svg>
      </div>
      <button
        type="button"
        onClick={() => onToggle(goal.id, isoDate)}
        className={cn(
          "mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
          isDone ? "border-success bg-success" : "border-slate-300",
        )}
      >
        {isDone && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[13.5px] font-semibold leading-tight text-slate-800 transition-colors",
            isDone && "text-slate-400 line-through decoration-slate-300",
          )}
        >
          {goal.title}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-400">{subtitle} · drag to schedule</p>
      </div>
    </div>
  );
}

function AssignedCheckItem({
  goal,
  assignment,
  onToggle,
  onRemove,
}: {
  goal: Goal;
  assignment: DayAssignment;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: `assignment:${assignment.id}`,
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 999 } : undefined;

  const cadenceLabel =
    goal.cadence === "one-time" && goal.adhoc
      ? "Task"
      : goal.cadence.charAt(0).toUpperCase() + goal.cadence.slice(1);

  const subtitle = [
    cadenceLabel,
    assignment.targetAmount ? `${assignment.targetAmount} ${goal.targetUnit ?? "units"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={cn(
        "group flex w-full cursor-grab select-none touch-none items-start gap-3 rounded-xl px-2 py-2.5 transition active:cursor-grabbing",
        isDragging ? "opacity-40" : "hover:bg-slate-50",
      )}
    >
      {/* Drag handle — visual only */}
      <div className="mt-[3px] shrink-0 text-slate-300 group-hover:text-slate-400 transition-colors">
        <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
          <circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
          <circle cx="2" cy="6" r="1.2" /><circle cx="6" cy="6" r="1.2" />
          <circle cx="2" cy="10" r="1.2" /><circle cx="6" cy="10" r="1.2" />
        </svg>
      </div>

      {/* Checkbox */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(assignment.id); }}
        className={cn(
          "mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
          assignment.completed ? "border-success bg-success" : "border-slate-300",
        )}
      >
        {assignment.completed && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-[13.5px] font-semibold leading-tight text-slate-800 transition-colors",
              assignment.completed && "text-slate-400 line-through decoration-slate-300",
            )}
          >
            {goal.title}
          </p>
          {assignment.completed && assignment.completedAt && (
            <span className="shrink-0 rounded-full bg-success/10 px-1.5 py-[1px] text-[9.5px] font-semibold text-success">
              ✓ {assignment.completedAt}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-slate-400">
          {subtitle}
          {assignment.scheduledTime && !assignment.completed && (
            <span className="ml-1.5 text-brand/60">· {assignment.scheduledTime}</span>
          )}
        </p>
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(assignment.id); }}
        className="mt-[3px] shrink-0 rounded-full p-0.5 text-slate-300 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
      >
        <X className="h-3 w-3" strokeWidth={2.5} />
      </button>
    </div>
  );
}

/// ─── Omer check item ─────────────────────────────────────────────────────────
function OmerCheckItem({ day, isoDate, completed, onToggle }: {
  day: number;
  isoDate: string;
  completed: boolean;
  onToggle: (isoDate: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(isoDate)}
      className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-slate-50 active:bg-slate-100"
    >
      <div className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
        completed ? "border-success bg-success" : "border-slate-300",
      )}>
        {completed && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <p className={cn(
          "text-[13.5px] font-semibold leading-tight text-slate-800 transition-colors",
          completed && "text-slate-400 line-through decoration-slate-300",
        )}>
          Sefirat HaOmer
        </p>
        <span className="text-[10.5px] font-medium text-slate-400">Day {day} of 49</span>
      </div>
      {completed && (
        <span className="shrink-0 text-[10px] font-semibold text-success">✓ counted</span>
      )}
    </button>
  );
}

// ─── Right panel: DayChecklist ────────────────────────────────────────────────
function DayChecklist({
  date,
  relativeLabel,
  metadata,
  dailyGoals,
  assignedItems,
  goals,
  isoDate,
  isToday,
  omerDay,
  omerCompleted,
  onToggleOmer,
  onToggleDate,
  onToggleAssignment,
  onRemoveAssignment,
  onAddTask,
  onNavigateToDate,
}: {
  date: Date;
  relativeLabel: string;
  metadata?: CalendarDayMetadata;
  dailyGoals: Goal[];
  assignedItems: { assignment: DayAssignment; goal: Goal }[];
  goals: Goal[];
  isoDate: string;
  isToday: boolean;
  omerDay?: number;
  omerCompleted?: boolean;
  onToggleOmer?: (isoDate: string) => void;
  onToggleDate: (goalId: string, isoDate: string) => void;
  onToggleAssignment: (id: string) => void;
  onRemoveAssignment: (id: string) => void;
  onAddTask: (title: string, isoDate: string) => void;
  onNavigateToDate: (date: Date) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState("");
  // Droppable zone so goal pills from the tray can be dropped here
  const { setNodeRef: setDropRef, isOver: isOverChecklist } = useDroppable({ id: isoDate });

  const omerCount = omerDay !== undefined ? 1 : 0;
  const omerDoneCount = omerDay !== undefined && omerCompleted ? 1 : 0;
  const totalCount = dailyGoals.length + assignedItems.length + omerCount;
  const completedCount =
    dailyGoals.filter((g) => g.completedDates?.includes(isoDate)).length +
    assignedItems.filter((i) => i.assignment.completed).length +
    omerDoneCount;
  const allDone = totalCount > 0 && completedCount === totalCount;

  const tomorrow = addDays(date, 1);

  // Build time pills for the header
  const timePills: { label: string; time: string }[] = [];
  if (metadata?.fastBegins) timePills.push({ label: "Fast", time: metadata.fastBegins });
  if (metadata?.candleLighting) timePills.push({ label: "Candles", time: metadata.candleLighting });
  if (metadata?.shabbosEnds && timePills.length < 2) timePills.push({ label: "Ends", time: metadata.shabbosEnds });

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
          {timePills.length > 0 && (
            <div className="flex flex-col items-end gap-1.5 pt-1">
              {timePills.map(({ label, time }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 rounded-full border border-brand/15 bg-brand/[0.06] px-2.5 py-1"
                >
                  <span className="text-[9px] font-bold uppercase tracking-wide text-brand/60">{label}</span>
                  <span className="tabular-nums text-[11px] font-semibold text-slate-700">{time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* All-done banner */}
      {allDone && (
        <div className="mx-4 mt-4 rounded-xl border border-success/20 bg-success/[0.07] px-4 py-2.5">
          <p className="text-[12.5px] font-semibold text-success">✓ All done for today — great work!</p>
        </div>
      )}

      {/* Task list — also a drop target for goal pills from the tray */}
      <div
        ref={setDropRef}
        className={cn(
          "flex flex-1 flex-col gap-px px-3 py-3 transition-colors",
          isOverChecklist && "bg-brand/[0.025]",
        )}
      >
        {/* Omer auto-item */}
        {omerDay !== undefined && onToggleOmer && (
          <OmerCheckItem
            day={omerDay}
            isoDate={isoDate}
            completed={omerCompleted ?? false}
            onToggle={onToggleOmer}
          />
        )}

        {/* Daily goals */}
        {dailyGoals.map((goal) => (
          <DailyCheckItem
            key={goal.id}
            goal={goal}
            isoDate={isoDate}
            onToggle={onToggleDate}
          />
        ))}

        {/* Divider */}
        {dailyGoals.length > 0 && assignedItems.length > 0 && (
          <div className="mx-2 my-1.5 border-t border-slate-100" />
        )}

        {/* Assigned items */}
        {assignedItems.map(({ assignment, goal }) => (
          <AssignedCheckItem
            key={assignment.id}
            goal={goal}
            assignment={assignment}
            onToggle={onToggleAssignment}
            onRemove={onRemoveAssignment}
          />
        ))}

        {/* Empty state */}
        {totalCount === 0 && !isAdding && (
          <p className="px-2 py-2 text-[12px] text-slate-400">Nothing planned for this day yet.</p>
        )}

        {/* Add task */}
        {isAdding ? (
          <input
            autoFocus
            type="text"
            placeholder="Task name…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft.trim()) {
                onAddTask(draft.trim(), isoDate);
                setDraft("");
                setIsAdding(false);
              }
              if (e.key === "Escape") { setDraft(""); setIsAdding(false); }
            }}
            onBlur={() => {
              if (draft.trim()) onAddTask(draft.trim(), isoDate);
              setDraft("");
              setIsAdding(false);
            }}
            className="mx-2 rounded-xl border border-brand/30 px-3 py-2 text-[13px] text-slate-800 placeholder-slate-300 outline-none focus:ring-1 focus:ring-brand/20"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-left text-[12px] text-slate-300 transition hover:text-slate-500"
          >
            + Add task
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <span
            className={cn(
              "text-[12.5px] font-semibold tabular-nums transition-colors",
              allDone ? "text-success" : "text-slate-500",
            )}
          >
            {completedCount}/{totalCount} done
          </span>

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
  onAddTask,
  onSetScheduledTime: _onSetScheduledTime,
  onNavigateToDate,
  showOmer = true,
  completedOmerDates,
  onToggleOmer,
  zmanim,
  timeFormat = "24h",
  timelineSnapMins,
  timelineDefaultDurationMins,
  onTimelinePreferenceChange,
  onSetDuration,
}: DayFocusProps) {
  const isoDate = toIsoDate(date);
  const isToday = isoDate === todayIso();

  const omerDay = showOmer ? metadata?.omerDay : undefined;
  const omerCompleted = omerDay !== undefined ? (completedOmerDates?.has(isoDate) ?? false) : undefined;

  // Suppress auto-shows for weekly goals replaced by manual drag
  const suppressedAutoShows = new Set<string>(
    dayAssignments
      .filter((a) => a.replacedAutoDate !== undefined)
      .map((a) => `${a.goalId}:${a.replacedAutoDate}`),
  );

  // Daily + auto-weekly goals applicable to this day
  const dailyGoals = getApplicableGoalsForDate(goals, date, excludedByGoal)
    .filter((g) => !dayAssignments.some((a) => a.date === isoDate && a.goalId === g.id))
    .filter((g) => !suppressedAutoShows.has(`${g.id}:${isoDate}`));

  // Explicit assignments for today
  const assignedItems = dayAssignments
    .filter((a) => a.date === isoDate)
    .map((a) => ({ assignment: a, goal: goals.find((g) => g.id === a.goalId) }))
    .filter((item): item is { assignment: DayAssignment; goal: Goal } => item.goal !== undefined);

  return (
    <div className="grid grid-cols-[1fr_1.5fr] gap-4">
      <DayTimeline
        assignments={assignedItems.map((i) => i.assignment)}
        goals={goals}
        isoDate={isoDate}
        onToggle={onToggleAssignment}
        onRemove={onRemoveAssignment}
        onSetDuration={onSetDuration}
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
        dailyGoals={dailyGoals}
        assignedItems={assignedItems}
        goals={goals}
        isoDate={isoDate}
        isToday={isToday}
        omerDay={omerDay}
        omerCompleted={omerCompleted}
        onToggleOmer={onToggleOmer}
        onToggleDate={onToggleDate}
        onToggleAssignment={onToggleAssignment}
        onRemoveAssignment={onRemoveAssignment}
        onAddTask={onAddTask}
        onNavigateToDate={onNavigateToDate}
      />
    </div>
  );
}
