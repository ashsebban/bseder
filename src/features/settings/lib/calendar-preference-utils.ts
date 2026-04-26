import type { UserPreferences } from "@prisma/client";
import { defaultCalendarPreferences } from "@/features/settings/lib/calendar-preferences";
import type { CalendarPreferences, CalendarTimeFormat, HavdalahOpinion } from "@/features/settings/types/calendar-preferences";

function isTimeFormat(value: unknown): value is CalendarTimeFormat {
  return value === "12h" || value === "24h";
}

function isHavdalahOpinion(value: unknown): value is HavdalahOpinion {
  return value === "tzeit-8_5" || value === "42" || value === "50" || value === "72";
}

function isDefaultView(value: unknown): value is CalendarPreferences["defaultView"] {
  return value === "month" || value === "week" || value === "day";
}

function isTimelineSnapMins(value: unknown): value is CalendarPreferences["timelineSnapMins"] {
  return value === 5 || value === 15 || value === 30 || value === 60;
}

function isTimelineDefaultDurationMins(value: unknown): value is CalendarPreferences["timelineDefaultDurationMins"] {
  return value === 15 || value === 30 || value === 45 || value === 60 || value === 90 || value === 120;
}

export function normalizeCalendarPreferences(raw: Partial<CalendarPreferences>): CalendarPreferences {
  return {
    ...defaultCalendarPreferences,
    ...raw,
    locationKey: raw.locationKey || defaultCalendarPreferences.locationKey,
    timeFormat: isTimeFormat(raw.timeFormat) ? raw.timeFormat : defaultCalendarPreferences.timeFormat,
    havdalahOpinion: isHavdalahOpinion(raw.havdalahOpinion) ? raw.havdalahOpinion : defaultCalendarPreferences.havdalahOpinion,
    weekStartsOn: raw.weekStartsOn === 1 ? 1 : 0,
    defaultView: isDefaultView(raw.defaultView) ? raw.defaultView : defaultCalendarPreferences.defaultView,
    timelineSnapMins: isTimelineSnapMins(raw.timelineSnapMins) ? raw.timelineSnapMins : defaultCalendarPreferences.timelineSnapMins,
    timelineDefaultDurationMins: isTimelineDefaultDurationMins(raw.timelineDefaultDurationMins)
      ? raw.timelineDefaultDurationMins
      : defaultCalendarPreferences.timelineDefaultDurationMins,
    showHebrewDates: raw.showHebrewDates ?? defaultCalendarPreferences.showHebrewDates,
    showParsha: raw.showParsha ?? defaultCalendarPreferences.showParsha,
    showOutsideMonthDays: raw.showOutsideMonthDays ?? defaultCalendarPreferences.showOutsideMonthDays,
    showModernHolidays: raw.showModernHolidays ?? defaultCalendarPreferences.showModernHolidays,
    showRoshChodesh: raw.showRoshChodesh ?? defaultCalendarPreferences.showRoshChodesh,
    customLocation: raw.customLocation,
  };
}

export function calendarPreferencesFromUserPreferences(preferences: UserPreferences | null | undefined): Partial<CalendarPreferences> {
  if (!preferences) return {};

  return normalizeCalendarPreferences({
    locationKey: preferences.locationKey,
    timeFormat: isTimeFormat(preferences.timeFormat) ? preferences.timeFormat : undefined,
    showHebrewDates: preferences.showHebrewDates,
    weekStartsOn: preferences.weekStartsOn === 1 ? 1 : 0,
    defaultView: isDefaultView(preferences.defaultView) ? preferences.defaultView : undefined,
    showParsha: preferences.showParsha,
    showRoshChodesh: preferences.showRoshChodesh,
    showModernHolidays: preferences.showModernHolidays,
    showOutsideMonthDays: preferences.showOutsideMonthDays,
    havdalahOpinion: isHavdalahOpinion(preferences.havdalahOpinion) ? preferences.havdalahOpinion : undefined,
    timelineSnapMins: isTimelineSnapMins(preferences.timelineSnapMins) ? preferences.timelineSnapMins : undefined,
    timelineDefaultDurationMins: isTimelineDefaultDurationMins(preferences.timelineDefaultDurationMins)
      ? preferences.timelineDefaultDurationMins
      : undefined,
  });
}

export function toPersistedCalendarPreferences(preferences: CalendarPreferences) {
  return {
    locationKey: preferences.locationKey,
    timeFormat: preferences.timeFormat,
    showHebrewDates: preferences.showHebrewDates,
    weekStartsOn: preferences.weekStartsOn,
    defaultView: preferences.defaultView,
    showParsha: preferences.showParsha,
    showRoshChodesh: preferences.showRoshChodesh,
    showModernHolidays: preferences.showModernHolidays,
    showOutsideMonthDays: preferences.showOutsideMonthDays,
    havdalahOpinion: preferences.havdalahOpinion,
    timelineSnapMins: preferences.timelineSnapMins,
    timelineDefaultDurationMins: preferences.timelineDefaultDurationMins,
  };
}
