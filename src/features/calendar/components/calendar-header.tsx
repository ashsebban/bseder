import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/tabs";
import type { CalendarView } from "@/features/calendar/types/calendar";
import { useRef, type ReactNode } from "react";
import { parseIsoDate, toIsoDate } from "@/lib/date";

interface CalendarHeaderProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onJumpToDate: (date: Date) => void;
  title: string;
  subtitle: string;
  selectedDate: Date;
  hebrewYear?: string;
  actionsSlot?: ReactNode;
}

const options = [
  { label: "Month", value: "month" },
  { label: "Week", value: "week" },
  { label: "Day", value: "day" },
] as const;

export function CalendarHeader({
  view,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onJumpToDate,
  title,
  subtitle,
  selectedDate,
  hebrewYear,
  actionsSlot,
}: CalendarHeaderProps) {
  const jumpInputType = view === "month" ? "month" : "date";
  const jumpLabel = view === "month" ? "Pick month" : "Pick date";
  const jumpInputRef = useRef<HTMLInputElement | null>(null);

  const iso = toIsoDate(selectedDate);
  const jumpValue = view === "month" ? iso.slice(0, 7) : iso;

  function parseJumpDate(raw: string): Date | null {
    if (view === "month") {
      if (!/^\d{4}-\d{2}$/.test(raw)) return null;
      return parseIsoDate(`${raw}-01`);
    }
    return parseIsoDate(raw);
  }

  function handleJumpChange(raw: string) {
    const parsed = parseJumpDate(raw);
    if (!parsed) return;
    onJumpToDate(parsed);
  }

  function openJumpPicker() {
    const input = jumpInputRef.current;
    if (!input) return;
    const withPicker = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof withPicker.showPicker === "function") {
      withPicker.showPicker();
      return;
    }
    input.focus();
    input.click();
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-xl font-bold tracking-tight text-text md:text-2xl">{title}</h1>
            {hebrewYear && (
              <span className="shrink-0 text-sm font-medium text-text-muted">{hebrewYear}</span>
            )}
          </div>
          {subtitle ? (
            <p className="mt-1.5 text-sm text-text-muted">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface p-1 shadow-soft">
              <Button variant="ghost" size="sm" className="h-8 w-8 rounded-xl px-0" onClick={onPrev} aria-label="Previous">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 rounded-xl px-0" onClick={onNext} aria-label="Next">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="mx-1 h-4 w-px bg-line" />
              <Button variant="ghost" size="sm" className="h-8 rounded-xl px-3.5 text-[13px]" onClick={onToday}>Today</Button>
              <span className="mx-1 h-4 w-px bg-line" />
              <button
                type="button"
                onClick={openJumpPicker}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-semibold text-text-muted transition hover:bg-brand-soft/50 hover:text-text"
                aria-label={jumpLabel}
                title={jumpLabel}
              >
                <CalendarDays className="h-4 w-4" />
                <span>Jump</span>
              </button>
            </div>

            <input
              ref={jumpInputRef}
              type={jumpInputType}
              value={jumpValue}
              onChange={(event) => handleJumpChange(event.target.value)}
              className="pointer-events-none absolute h-0 w-0 opacity-0"
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <SegmentedTabs value={view} onValueChange={onViewChange} options={[...options]} size="sm" className="shadow-soft" />
            {actionsSlot}
          </div>
        </div>
      </div>
    </div>
  );
}
