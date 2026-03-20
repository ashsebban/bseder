import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/tabs";
import type { CalendarView } from "@/features/calendar/types/calendar";
import type { ReactNode } from "react";

interface CalendarHeaderProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  title: string;
  subtitle: string;
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
  title,
  subtitle,
  hebrewYear,
  actionsSlot,
}: CalendarHeaderProps) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <h1 className="text-xl font-bold tracking-tight text-text md:text-2xl">{title}</h1>
        {hebrewYear && (
          <span className="text-sm font-medium text-text-muted">{hebrewYear}</span>
        )}
        <Button variant="ghost" size="sm" className="px-2.5" onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="px-2.5" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="sm" onClick={onToday}>Today</Button>
        <div className="flex-1" />
        <SegmentedTabs value={view} onValueChange={onViewChange} options={[...options]} />
        {actionsSlot}
      </div>
      {subtitle ? (
        <p className="mt-1.5 text-sm text-text-muted">{subtitle}</p>
      ) : null}
    </div>
  );
}
