import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { CalendarWeek } from "@/features/calendar/types/calendar";

interface WeekStripProps {
  week: CalendarWeek;
  onSelectDate: (date: Date) => void;
}

export function WeekStrip({ week, onSelectDate }: WeekStripProps) {
  return (
    <div className="grid gap-4 md:grid-cols-7">
      {week.days.map((day) => (
        <button
          key={day.iso}
          type="button"
          onClick={() => onSelectDate(day.date)}
          className={cn(
            "rounded-[1.75rem] border p-5 text-left shadow-soft transition hover:-translate-y-0.5",
            day.isSelected
              ? "border-brand bg-brand-soft/90"
              : "border-white/70 bg-white/90 hover:border-brand/30",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-subtle">
                {day.date.toLocaleDateString("en-US", { weekday: "short" })}
              </p>
              <p className="mt-2 text-4xl font-bold tracking-tight text-text">{day.dayNumber}</p>
            </div>
            {day.isToday ? <Badge tone="brand">Today</Badge> : null}
          </div>
          <p className="mt-8 text-sm leading-6 text-text-muted">
            Weekly view gives us a strong bridge into future scheduling, workload previews, and weekly goal rollups.
          </p>
        </button>
      ))}
    </div>
  );
}
