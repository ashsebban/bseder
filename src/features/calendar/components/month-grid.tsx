import { useRef } from "react";
import { cn } from "@/lib/cn";
import type { CalendarMonth, CalendarDayMetadata } from "@/features/calendar/types/calendar";

const WEEKDAY_LABELS_FROM_SUN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface MonthGridProps {
  month: CalendarMonth;
  onSelectDate: (date: Date) => void;
  onDoubleClickDate: (date: Date) => void;
  showOutsideMonthDays: boolean;
  weekStartsOn?: 0 | 1;
}

function buildTimeSlots(meta: CalendarDayMetadata) {
  const slots: { label: string; time: string }[] = [];
  if (meta.fastBegins) slots.push({ label: "Fast", time: meta.fastBegins });
  if (meta.candleLighting) slots.push({ label: "Light", time: meta.candleLighting });
  if (meta.shabbosEnds && slots.length < 2) slots.push({ label: "Ends", time: meta.shabbosEnds });
  return slots.slice(0, 2);
}

export function MonthGrid({ month, onSelectDate, onDoubleClickDate, showOutsideMonthDays, weekStartsOn = 0 }: MonthGridProps) {
  const days = month.weeks.flatMap((week) => week.days);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weekdayLabels = weekStartsOn === 1
    ? [...WEEKDAY_LABELS_FROM_SUN.slice(1), WEEKDAY_LABELS_FROM_SUN[0]]
    : WEEKDAY_LABELS_FROM_SUN;

  return (
    <div className="space-y-2">
      {/* Column headers */}
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {weekdayLabels.map((weekday) => (
          <div
            key={weekday}
            className="py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400"
          >
            {weekday}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-2.5">
        {days.map((day) => {
          const showMeta = showOutsideMonthDays || day.inCurrentPeriod;
          const meta = day.metadata;
          const timeSlots = meta && showMeta ? buildTimeSlots(meta) : [];
          const progress = showMeta ? meta?.progress : undefined;
          const hasProgress = !!(progress && progress.total > 0);
          const completedPct = hasProgress ? (progress!.completed / progress!.total) * 100 : 0;
          const missedPct = hasProgress && progress!.missed ? (progress!.missed / progress!.total) * 100 : 0;
          const allDone = hasProgress && progress!.completed >= progress!.total;

          // Primary label: holiday first, then parsha (only if no holiday)
          const eventLabel = showMeta
            ? (meta?.holidays?.[0] ?? meta?.parsha ?? null)
            : null;
          const isParsha = !meta?.holidays?.[0] && !!meta?.parsha;

          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => {
                if (clickTimerRef.current) {
                  clearTimeout(clickTimerRef.current);
                  clickTimerRef.current = null;
                  onDoubleClickDate(day.date);
                } else {
                  clickTimerRef.current = setTimeout(() => {
                    clickTimerRef.current = null;
                    onSelectDate(day.date);
                  }, 250);
                }
              }}
              className={cn(
                "group flex min-h-[7.5rem] flex-col rounded-xl border p-3 text-left transition-all duration-150",
                // Default in-period
                !day.isSelected && day.inCurrentPeriod &&
                  "border-slate-200/70 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-brand/30 hover:shadow-[0_3px_10px_rgba(0,0,0,0.08)]",
                // Today (not selected)
                day.isToday && !day.isSelected && "border-brand/30",
                // Selected
                day.isSelected &&
                  "border-brand/40 bg-brand-soft shadow-[0_2px_10px_rgba(0,0,0,0.07)] ring-1 ring-brand/20",
                // Outside month
                !day.inCurrentPeriod && "border-slate-100/60 bg-slate-50/40 shadow-none",
                !showOutsideMonthDays && !day.inCurrentPeriod && "pointer-events-none opacity-25",
              )}
            >
              {/* ── Top row: day number + time pills ── */}
              <div className="flex items-start justify-between gap-1">
                {/* Day number + Hebrew date stacked */}
                <div>
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[1.3rem] font-black leading-none",
                      day.isToday && day.inCurrentPeriod
                        ? "bg-brand text-white"
                        : day.inCurrentPeriod
                          ? "text-slate-900"
                          : "text-slate-400/50",
                      !showOutsideMonthDays && !day.inCurrentPeriod && "invisible",
                    )}
                  >
                    {day.dayNumber}
                  </div>
                  {showMeta && meta?.hebrewDateLabel && (
                    <p className="mt-1 whitespace-nowrap text-[10px] font-semibold leading-none text-slate-400">
                      {meta.hebrewDateLabel}
                    </p>
                  )}
                </div>

                {/* Time pills — stacked, compact */}
                {timeSlots.length > 0 && (
                  <div className="flex flex-col items-end gap-[3px]">
                    {timeSlots.map(({ label, time }) => (
                      <div
                        key={label}
                        className="flex items-center gap-[3px] rounded-full border border-brand/15 bg-brand/[0.06] px-1.5 py-[2px]"
                      >
                        <span className="text-[8px] font-bold uppercase tracking-wide text-brand/60">
                          {label}
                        </span>
                        <span className="tabular-nums text-[10px] font-semibold leading-none text-slate-700">
                          {time}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Event label: holiday primary, parsha secondary ── */}
              {eventLabel && (
                <p
                  className={cn(
                    "mt-2 truncate text-[11px] leading-tight",
                    isParsha ? "text-brand/70 font-medium" : "text-slate-700 font-semibold",
                  )}
                >
                  {eventLabel}
                </p>
              )}
              {!isParsha && meta?.parsha && showMeta && (
                <p className="truncate text-[10px] font-medium leading-tight text-brand/60 mt-0.5">
                  {meta.parsha}
                </p>
              )}

              {/* ── Progress bar — thin, anchored to bottom ── */}
              {hasProgress && (
                <div className="mt-auto pt-2.5">
                  <div className="flex h-[4px] w-full overflow-hidden rounded-full bg-slate-100">
                    {allDone ? (
                      <div className="h-full w-full bg-success transition-all duration-500" />
                    ) : completedPct === 0 && missedPct === 0 ? (
                      <div className="h-full w-full bg-planned" />
                    ) : (
                      <>
                        {completedPct > 0 && (
                          <div className="h-full bg-success transition-all duration-500" style={{ width: `${completedPct}%` }} />
                        )}
                        {missedPct > 0 && (
                          <div className="h-full bg-penalty transition-all duration-500" style={{ width: `${missedPct}%` }} />
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
