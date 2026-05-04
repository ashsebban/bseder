import { CandleLightingEvent, HavdalahEvent, HDate, HebrewCalendar, OmerEvent, flags } from "@hebcal/core";

const HOLIDAY_FLAG_MASK =
  flags.CHAG |
  flags.EREV |
  flags.CHOL_HAMOED |
  flags.ROSH_CHODESH |
  flags.MAJOR_FAST |
  flags.MINOR_FAST |
  flags.MINOR_HOLIDAY |
  flags.MODERN_HOLIDAY |
  flags.SPECIAL_SHABBAT |
  flags.CHANUKAH_CANDLES;
import type { CalendarDayMetadata } from "@/features/calendar/types/calendar";
import { resolveLocation } from "@/features/calendar/lib/locations";
import { toIsoDate } from "@/lib/date";
import { formatTimeInZone } from "@/features/calendar/lib/time-format";
import type { CalendarPreferences } from "@/features/settings/types/calendar-preferences";
import { getHavdalahOptions, getEffectiveHavdalahOpinion } from "@/features/settings/lib/calendar-preferences";

function stripParshaPrefix(value: string) {
  return value.replace(/^Parashat\s+/i, "").trim();
}

/** Returns just the Hebrew year in gematria notation (e.g. "תשפ״ו") for a given date. */
export function getHebrewYearLabel(date: Date): string {
  const full = new HDate(date).renderGematriya(true).trim().split(/\s+/);
  return full[full.length - 1];
}

export function buildJewishTimesByDate(start: Date, end: Date, preferences: CalendarPreferences) {
  const metadataByDate = new Map<string, CalendarDayMetadata>();

  // ── Hebrew dates (always) ──────────────────────────────────────────────────
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = new Date(cursor);
    const dateKey = toIsoDate(date);
    metadataByDate.set(dateKey, {
      hebrewDateLabel: preferences.showHebrewDates
        ? new HDate(date).renderGematriya(true).trim().split(/\s+/).slice(0, -1).join(" ")
        : undefined,
    });
  }

  // ── Base events: holidays, parsha, omer (no location required) ────────────
  const baseEvents = HebrewCalendar.calendar({ start, end, sedrot: true, omer: true });

  for (const event of baseEvents) {
    const dateKey = toIsoDate(event.getDate().greg());
    const existing = metadataByDate.get(dateKey) ?? {};

    if (event instanceof OmerEvent) {
      existing.omerDay = event.omer;
      metadataByDate.set(dateKey, existing);
      continue;
    }

    if (preferences.showParsha && event.getDesc().startsWith("Parashat ")) {
      existing.parsha = stripParshaPrefix(event.render("en"));
      metadataByDate.set(dateKey, existing);
      continue;
    }

    if (event.getFlags() & HOLIDAY_FLAG_MASK) {
      if (!preferences.showModernHolidays && (event.getFlags() & flags.MODERN_HOLIDAY)) continue;
      if (!preferences.showRoshChodesh && (event.getFlags() & flags.ROSH_CHODESH)) continue;
      const rendered = event.render("en");
      if (!rendered.startsWith("Fast begins") && !rendered.startsWith("Fast ends")) {
        if (!existing.holidays) existing.holidays = [];
        if (!existing.holidays.includes(rendered)) existing.holidays.push(rendered);
      }
      metadataByDate.set(dateKey, existing);
    }
  }

  // ── Location-dependent: candle lighting, havdalah, fast times ─────────────
  const location = resolveLocation(preferences);
  if (!location) return metadataByDate;

  const locationEvents = HebrewCalendar.calendar({
    start,
    end,
    candlelighting: true,
    sedrot: true,
    omer: true,
    location,
    hour12: preferences.timeFormat === "12h",
    ...getHavdalahOptions(getEffectiveHavdalahOpinion(preferences)),
  });

  for (const event of locationEvents) {
    const dateKey = toIsoDate(event.getDate().greg());
    const existing = metadataByDate.get(dateKey) ?? {};

    if (event instanceof CandleLightingEvent) {
      existing.candleLighting = formatTimeInZone(event.eventTime, event.location.getTzid(), preferences.timeFormat);
      metadataByDate.set(dateKey, existing);
      continue;
    }

    if (event instanceof HavdalahEvent) {
      existing.shabbosEnds = formatTimeInZone(event.eventTime, event.location.getTzid(), preferences.timeFormat);
      metadataByDate.set(dateKey, existing);
      continue;
    }

    if (preferences.showParsha && event.getDesc().startsWith("Parashat ")) {
      existing.parsha = stripParshaPrefix(event.render("en"));
      metadataByDate.set(dateKey, existing);
      continue;
    }

    if (event.getFlags() & HOLIDAY_FLAG_MASK) {
      if (!preferences.showModernHolidays && (event.getFlags() & flags.MODERN_HOLIDAY)) continue;
      if (!preferences.showRoshChodesh && (event.getFlags() & flags.ROSH_CHODESH)) continue;
      const rendered = event.render("en");
      const timed = event as { eventTime?: Date; location?: { getTzid: () => string } };
      if (rendered.startsWith("Fast begins")) {
        existing.fastBegins =
          timed.eventTime instanceof Date && timed.location
            ? formatTimeInZone(timed.eventTime, timed.location.getTzid(), preferences.timeFormat)
            : rendered.replace(/^Fast begins[:\s]*/i, "").trim();
      } else if (rendered.startsWith("Fast ends")) {
        existing.fastEnds =
          timed.eventTime instanceof Date && timed.location
            ? formatTimeInZone(timed.eventTime, timed.location.getTzid(), preferences.timeFormat)
            : rendered.replace(/^Fast ends[:\s]*/i, "").trim();
      } else {
        if (!existing.holidays) existing.holidays = [];
        if (!existing.holidays.includes(rendered)) existing.holidays.push(rendered);
      }
      metadataByDate.set(dateKey, existing);
    }
  }

  return metadataByDate;
}
