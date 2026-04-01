import { Zmanim } from "@hebcal/core";
import type { Location } from "@hebcal/core";
import type { CalendarTimeFormat } from "@/features/settings/types/calendar-preferences";

export interface DayZmanim {
  periods: ZmanPeriod[];
  tzid: string;
}

export interface ZmanPeriod {
  name: string;
  color: string;
  startHour: number;   // fractional (e.g. 5.7 = 5:42am)
  endHour: number;
  boundaryTime: Date | null;  // the Date that starts this period
}

export interface HourZmanInfo {
  color: string;
  periodName: string;
  boundaries: { label: string; time: Date }[];
}

// ── Period color map ──────────────────────────────────────────────────────────
const PERIOD_COLORS: Record<string, string> = {
  "Night":                "#1e2d5e",
  "Alot HaShachar":       "#5b21b6",
  "Misheyakir":           "#7c3aed",
  "Netz HaChama":         "#f59e0b",
  "Sof Zman Shema":       "#ef4444",
  "Sof Zman Tefilla":     "#f97316",
  "Chatzot":              "#eab308",
  "Mincha Gedola":        "#22c55e",
  "Mincha Ketana":        "#16a34a",
  "Plag HaMincha":        "#fb923c",
  "Shkiyah":              "#dc2626",
  "Bein HaShmashot":      "#b91c1c",
  "Tzais HaKochavim":     "#1e2d5e",
};

function safeCall(fn: () => Date): Date | null {
  try { return fn(); } catch { return null; }
}

function toFractionalHour(dt: Date | null, tzid: string): number | null {
  if (!dt) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: false,
      timeZone: tzid,
    }).formatToParts(dt);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    // Intl hour12:false returns 24 for midnight — normalize to 0
    return (h === 24 ? 0 : h) + m / 60;
  } catch {
    return null;
  }
}

export function formatZmanTime(date: Date, tzid: string, timeFormat: CalendarTimeFormat): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat === "12h",
    timeZone: tzid,
  }).format(date);
}

export function computeDayZmanim(
  date: Date,
  location: Location,
  timeFormat: CalendarTimeFormat,
): DayZmanim | null {
  try {
    const tzid = location.getTzid();
    const z = new Zmanim(location, date, false);

    const alot     = safeCall(() => z.alotHaShachar());
    const mish     = safeCall(() => z.misheyakir());
    const netz     = safeCall(() => z.sunrise());
    const szShema  = safeCall(() => z.sofZmanShma());
    const szTfilla = safeCall(() => z.sofZmanTfilla());
    const chatzot  = safeCall(() => z.chatzot());
    const minGed   = safeCall(() => z.minchaGedola());
    const minKet   = safeCall(() => z.minchaKetana());
    const plag     = safeCall(() => z.plagHaMincha());
    const shkiya   = safeCall(() => z.sunset());
    // Bein HaShmashot: ~13.5 min after shkiyah (most common opinion)
    const beinHash = shkiya ? new Date(shkiya.getTime() + 13.5 * 60_000) : null;
    const tzeit    = safeCall(() => z.tzeit());

    // Ordered boundary list; frac=0 and frac=24 are sentinels
    const rawBoundaries: { frac: number | null; name: string; date: Date | null }[] = [
      { frac: 0,                                 name: "Night",             date: null },
      { frac: toFractionalHour(alot, tzid),      name: "Alot HaShachar",   date: alot },
      { frac: toFractionalHour(mish, tzid),      name: "Misheyakir",       date: mish },
      { frac: toFractionalHour(netz, tzid),      name: "Netz HaChama",     date: netz },
      { frac: toFractionalHour(szShema, tzid),   name: "Sof Zman Shema",   date: szShema },
      { frac: toFractionalHour(szTfilla, tzid),  name: "Sof Zman Tefilla", date: szTfilla },
      { frac: toFractionalHour(chatzot, tzid),   name: "Chatzot",          date: chatzot },
      { frac: toFractionalHour(minGed, tzid),    name: "Mincha Gedola",    date: minGed },
      { frac: toFractionalHour(minKet, tzid),    name: "Mincha Ketana",    date: minKet },
      { frac: toFractionalHour(plag, tzid),      name: "Plag HaMincha",    date: plag },
      { frac: toFractionalHour(shkiya, tzid),    name: "Shkiyah",          date: shkiya },
      { frac: toFractionalHour(beinHash, tzid),  name: "Bein HaShmashot",  date: beinHash },
      { frac: toFractionalHour(tzeit, tzid),     name: "Tzais HaKochavim", date: tzeit },
      { frac: 24,                                name: "END",               date: null },
    ];

    // Filter out null fracs (failed computations), keep sentinels, sort ascending
    const boundaries = rawBoundaries
      .filter((b): b is { frac: number; name: string; date: Date | null } => b.frac !== null)
      .sort((a, b) => a.frac - b.frac);

    // Build periods from consecutive boundary pairs
    const periods: ZmanPeriod[] = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      const curr = boundaries[i];
      const next = boundaries[i + 1];
      if (curr.name === "END") break;
      periods.push({
        name: curr.name,
        color: PERIOD_COLORS[curr.name] ?? "#1e2d5e",
        startHour: curr.frac,
        endHour: next.frac,
        boundaryTime: curr.date,
      });
    }

    return { periods, tzid };
  } catch {
    return null;
  }
}

export function getHourZmanInfo(hour: number, dayZmanim: DayZmanim): HourZmanInfo {
  const period =
    dayZmanim.periods.find((p) => p.startHour <= hour && p.endHour > hour) ??
    dayZmanim.periods[dayZmanim.periods.length - 1];

  // Boundaries that fall within [hour, hour + 1) — for tooltip
  const boundaries: { label: string; time: Date }[] = [];
  for (const p of dayZmanim.periods) {
    if (
      p.boundaryTime !== null &&
      p.startHour >= hour &&
      p.startHour < hour + 1 &&
      p.name !== "Night"
    ) {
      boundaries.push({ label: p.name, time: p.boundaryTime });
    }
  }

  return {
    color: period?.color ?? "#1e2d5e",
    periodName: period?.name ?? "Night",
    boundaries,
  };
}
