import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Moon, Sun, Sunrise, Sunset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedTabs } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import type { CalendarView } from "@/features/calendar/types/calendar";
import type { DayZmanim } from "@/features/calendar/lib/zmanim";
import type { CalendarTimeFormat } from "@/features/settings/types/calendar-preferences";
import { formatTimeInZone } from "@/features/calendar/lib/time-format";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  locationLabel?: string | null;
  locationTimeZone?: string | null;
  timeFormat: CalendarTimeFormat;
  zmanim?: DayZmanim | null;
  locationHref?: string;
  actionsSlot?: ReactNode;
}

const options = [
  { label: "Month", value: "month" },
  { label: "Week", value: "week" },
  { label: "Day", value: "day" },
] as const;

function formatCityName(label: string | null | undefined) {
  if (!label) return "Set city";
  const withoutZip = label.replace(/\s+\d{5}(?:-\d{4})?$/, "");
  return withoutZip.split(",")[0]?.trim() || label;
}

function getHourInTimeZone(date: Date, timeZone?: string | null) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timeZone ?? undefined,
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    return Number.isFinite(hour) ? hour % 24 : date.getHours();
  } catch {
    return date.getHours();
  }
}

function getAmbientContext(hour: number) {
  if (hour >= 5 && hour < 11) {
    return {
      label: "Morning",
      Icon: Sunrise,
      headerClass: "from-amber-50/80 via-sky-50/50 to-white",
      chipClass: "border-amber-200/70 bg-amber-50/80 text-amber-800",
      iconClass: "text-amber-500",
    };
  }
  if (hour >= 11 && hour < 17) {
    return {
      label: "Daylight",
      Icon: Sun,
      headerClass: "from-sky-50/80 via-white to-white",
      chipClass: "border-sky-200/70 bg-sky-50/80 text-sky-800",
      iconClass: "text-sky-500",
    };
  }
  if (hour >= 17 && hour < 21) {
    return {
      label: "Evening",
      Icon: Sunset,
      headerClass: "from-orange-50/70 via-indigo-50/40 to-white",
      chipClass: "border-orange-200/70 bg-orange-50/80 text-orange-800",
      iconClass: "text-orange-500",
    };
  }
  return {
    label: "Night",
    Icon: Moon,
    headerClass: "from-indigo-50/80 via-slate-50/60 to-white",
    chipClass: "border-indigo-200/70 bg-indigo-50/80 text-indigo-800",
    iconClass: "text-indigo-500",
  };
}

function formatRelativeZmanTime(date: Date, now: Date) {
  const minutes = Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 60_000));
  if (minutes <= 1) return "now";
  if (minutes < 60) return `in ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `in ${hours} hr`;
  return `in ${hours} hr ${remainingMinutes} min`;
}

function getZmanContext(now: Date | null, zmanim: DayZmanim | null | undefined) {
  if (!now || !zmanim) return null;
  const hour = getHourInTimeZone(now, zmanim.tzid);
  const currentName =
    zmanim.periods.find((period) => period.startHour <= hour && period.endHour > hour)?.name ?? null;
  const upcoming = zmanim.periods
    .filter((period) => period.boundaryTime && period.boundaryTime.getTime() > now.getTime())
    .sort((a, b) => (a.boundaryTime?.getTime() ?? 0) - (b.boundaryTime?.getTime() ?? 0))[0];

  if (upcoming?.boundaryTime) {
    return {
      currentName,
      nextLabel: `Next: ${upcoming.name} ${formatRelativeZmanTime(upcoming.boundaryTime, now)}`,
    };
  }

  return {
    currentName,
    nextLabel: null,
  };
}

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
  locationLabel,
  locationTimeZone,
  timeFormat,
  zmanim,
  locationHref = "/settings?tab=calendar",
  actionsSlot,
}: CalendarHeaderProps) {
  const jumpInputType = view === "month" ? "month" : "date";
  const jumpLabel = view === "month" ? "Choose month" : "Choose date";
  const jumpInputRef = useRef<HTMLInputElement | null>(null);

  const iso = toIsoDate(selectedDate);
  const jumpValue = view === "month" ? iso.slice(0, 7) : iso;
  const cityName = formatCityName(locationLabel);
  const [now, setNow] = useState<Date | null>(null);
  const ambient = useMemo(() => getAmbientContext(now ? getHourInTimeZone(now, locationTimeZone) : 12), [now, locationTimeZone]);
  const localTime = now ? formatTimeInZone(now, locationTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone, timeFormat) : null;
  const zmanContext = useMemo(() => getZmanContext(now, zmanim), [now, zmanim]);
  const AmbientIcon = ambient.Icon;

  useEffect(() => {
    setNow(new Date());
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

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
    <header className={cn("overflow-hidden rounded-3xl border border-line bg-gradient-to-br px-4 py-3 shadow-soft transition-colors md:px-5", ambient.headerClass)}>
      <div className="grid gap-x-4 gap-y-2.5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 lg:row-start-1">
          <h1 className="min-w-0 truncate text-2xl font-extrabold leading-tight text-text">
            {title}
          </h1>
          {hebrewYear && (
            <span className="shrink-0 text-sm font-semibold text-text-muted">{hebrewYear}</span>
          )}

          <div className="flex items-center gap-1 rounded-full border border-line bg-white/70 p-1 shadow-soft">
            <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full px-0" onClick={onPrev} aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 rounded-full px-2.5 text-[13px]" onClick={onToday}>Today</Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full px-0" onClick={onNext} aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={openJumpPicker}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition hover:bg-brand-soft/50 hover:text-text"
              aria-label={jumpLabel}
              title={jumpLabel}
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 lg:row-start-1 lg:justify-end lg:self-center">
          <Link
            href={locationHref}
            className={cn(
              "group inline-flex max-w-full items-center gap-2 text-lg font-bold leading-tight transition md:text-xl",
              locationLabel ? "text-text hover:text-brand" : "text-brand",
            )}
            aria-label="Change calendar location"
            title="Change calendar location"
          >
            <MapPin className="h-5 w-5 shrink-0 text-text-muted transition group-hover:text-brand" />
            <span className="truncate">{cityName}</span>
          </Link>
          {localTime ? (
            <>
              <span className="hidden h-1 w-1 rounded-full bg-text-subtle sm:inline-block" />
              <span className="text-sm font-bold text-text-muted">{localTime}</span>
            </>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-3 lg:row-start-2 lg:self-center">
          <SegmentedTabs value={view} onValueChange={onViewChange} options={[...options]} size="sm" />
          {subtitle ? (
            <p className="min-w-0 text-sm text-text-muted">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:row-start-2 lg:justify-end lg:self-center">
          <div className={cn("inline-flex h-9 max-w-full items-center gap-2 rounded-full border px-3 text-[12px] font-bold shadow-soft", ambient.chipClass)}>
            <AmbientIcon className={cn("h-4 w-4", ambient.iconClass)} />
            {zmanContext?.nextLabel ? (
              <span className="min-w-0 truncate">{zmanContext.nextLabel}</span>
            ) : (
              <span>{ambient.label}</span>
            )}
          </div>
          {actionsSlot}
        </div>
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
    </header>
  );
}
