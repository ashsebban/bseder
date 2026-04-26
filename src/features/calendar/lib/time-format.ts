import type { CalendarTimeFormat } from "../../settings/types/calendar-preferences";

export function parseHHMM(timeStr: string): number {
  if (!timeStr) return NaN;
  const colonIdx = timeStr.indexOf(":");
  if (colonIdx === -1) return NaN;
  const h = parseInt(timeStr.slice(0, colonIdx), 10);
  const m = parseInt(timeStr.slice(colonIdx + 1), 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m;
}

export function formatMinutesAsTime(totalMins: number, format: CalendarTimeFormat): string {
  const minsInDay = 24 * 60;
  const normalized = ((totalMins % minsInDay) + minsInDay) % minsInDay;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  const mm = m.toString().padStart(2, "0");

  if (format === "24h") {
    return `${h.toString().padStart(2, "0")}:${mm}`;
  }

  const period = h < 12 ? "am" : "pm";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${period}` : `${h12}:${mm}${period}`;
}

export function formatHourLabel(hour: number, format: CalendarTimeFormat): string {
  return formatMinutesAsTime(hour * 60, format);
}

export function formatClockTime(timeStr: string | undefined, format: CalendarTimeFormat): string | undefined {
  if (!timeStr) return undefined;
  const mins = parseHHMM(timeStr);
  return Number.isNaN(mins) ? timeStr : formatMinutesAsTime(mins, format);
}

export function formatTimeInZone(
  date: Date,
  timeZone: string,
  timeFormat: CalendarTimeFormat,
): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: timeFormat === "24h" ? "2-digit" : "numeric",
    minute: "2-digit",
    hour12: timeFormat === "12h",
    hourCycle: timeFormat === "24h" ? "h23" : "h12",
    timeZone,
  }).format(date);
}
