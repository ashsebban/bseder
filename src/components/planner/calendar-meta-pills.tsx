import { cn } from "@/lib/cn";
import type { CalendarDayMetadata } from "@/features/calendar/types/calendar";

export interface CalendarMetaPill {
  key: string;
  label: string;
  time: string;
}

export type CalendarMetaPillsDensity = "compact" | "comfortable" | "inline";

export function buildCalendarMetaPills(
  meta: CalendarDayMetadata | undefined,
  {
    maxItems = 2,
    candleLabel = "Candles",
  }: {
    maxItems?: number;
    candleLabel?: string;
  } = {},
): CalendarMetaPill[] {
  if (!meta) return [];

  const pills: CalendarMetaPill[] = [];
  if (meta.fastBegins) pills.push({ key: "fast", label: "Fast", time: meta.fastBegins });
  if (meta.candleLighting) pills.push({ key: "candles", label: candleLabel, time: meta.candleLighting });
  if (meta.shabbosEnds && pills.length < maxItems) pills.push({ key: "ends", label: "Ends", time: meta.shabbosEnds });
  return pills.slice(0, maxItems);
}

export function CalendarMetaPills({
  pills,
  density = "comfortable",
  orientation = "vertical",
  align = "end",
  className,
}: {
  pills: CalendarMetaPill[];
  density?: CalendarMetaPillsDensity;
  orientation?: "vertical" | "horizontal";
  align?: "start" | "end";
  className?: string;
}) {
  if (pills.length === 0) return null;

  const containerClassName = cn(
    "flex",
    orientation === "vertical"
      ? cn("flex-col", align === "end" ? "items-end" : "items-start", density === "compact" ? "gap-[3px]" : "gap-1.5")
      : cn("flex-wrap items-center gap-2", align === "end" && "justify-end"),
    className,
  );

  const pillClassName = cn(
    "flex items-center rounded-full border border-brand/15 bg-brand/[0.06]",
    density === "compact" && "gap-1 px-1.5 py-[3px]",
    density === "comfortable" && "gap-1.5 px-2.5 py-1",
    density === "inline" && "gap-1.5 px-2 py-0.5",
  );

  const labelClassName = cn(
    "font-bold uppercase tracking-wide text-brand/65",
    density === "compact" && "text-[7.5px]",
    density === "comfortable" && "text-[9px]",
    density === "inline" && "text-[9px]",
  );

  const timeClassName = cn(
    "tabular-nums font-semibold text-slate-700",
    density === "compact" && "whitespace-nowrap text-[9.5px]",
    density === "comfortable" && "text-[11px]",
    density === "inline" && "text-[11px]",
  );

  return (
    <div className={containerClassName}>
      {pills.map((pill) => (
        <div key={pill.key} className={pillClassName}>
          <span className={labelClassName}>{pill.label}</span>
          <span className={timeClassName}>{pill.time}</span>
        </div>
      ))}
    </div>
  );
}
