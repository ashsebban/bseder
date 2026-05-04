import type { UserPreferences } from "@prisma/client";
import { defaultCalendarPreferences } from "@/features/settings/lib/calendar-preferences";
import type {
  CalendarPreferences,
  CalendarTimeFormat,
  HavdalahOpinion,
  Nusach,
  HavdalahMode,
  ObservanceLevel,
  HebrewDateFormat,
} from "@/features/settings/types/calendar-preferences";

function isTimeFormat(value: unknown): value is CalendarTimeFormat {
  return value === "12h" || value === "24h";
}

function isHavdalahOpinion(value: unknown): value is HavdalahOpinion {
  return value === "tzeit-8_5" || value === "42" || value === "50" || value === "72";
}

function isNusach(value: unknown): value is Nusach {
  return value === "ashkenaz" || value === "sfard" || value === "sephardi" || value === "temanim" || value === "chabad" || value === "custom";
}

function isHavdalahMode(value: unknown): value is HavdalahMode {
  return value === "nusach" || value === "custom";
}

function isObservanceLevel(value: unknown): value is ObservanceLevel {
  return value === "shabbos" || value === "not-shabbos" || value === "mixed" || value === "unknown";
}

function isHebrewDateFormat(value: unknown): value is HebrewDateFormat {
  return value === "english" || value === "hebrew" || value === "both";
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
    nusach: isNusach(raw.nusach) ? raw.nusach : defaultCalendarPreferences.nusach,
    havdalahMode: isHavdalahMode(raw.havdalahMode) ? raw.havdalahMode : defaultCalendarPreferences.havdalahMode,
    observanceLevel: isObservanceLevel(raw.observanceLevel) ? raw.observanceLevel : defaultCalendarPreferences.observanceLevel,
    timeFormat: isTimeFormat(raw.timeFormat) ? raw.timeFormat : defaultCalendarPreferences.timeFormat,
    havdalahOpinion: isHavdalahOpinion(raw.havdalahOpinion) ? raw.havdalahOpinion : defaultCalendarPreferences.havdalahOpinion,
    weekStartsOn: 0,
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
    showHebrewDatesOnGoals: raw.showHebrewDatesOnGoals ?? defaultCalendarPreferences.showHebrewDatesOnGoals,
    hebrewDateFormat: isHebrewDateFormat(raw.hebrewDateFormat) ? raw.hebrewDateFormat : defaultCalendarPreferences.hebrewDateFormat,
    hebrewDateIncludeYear: raw.hebrewDateIncludeYear ?? defaultCalendarPreferences.hebrewDateIncludeYear,
    customLocation: raw.customLocation,
  };
}

export function calendarPreferencesFromUserPreferences(preferences: UserPreferences | null | undefined): Partial<CalendarPreferences> {
  if (!preferences) return {};

  return normalizeCalendarPreferences({
    locationKey: preferences.locationKey,
    nusach: isNusach(preferences.nusach) ? preferences.nusach : undefined,
    havdalahMode: isHavdalahMode(preferences.havdalahMode) ? preferences.havdalahMode : undefined,
    observanceLevel: isObservanceLevel(preferences.observanceLevel) ? preferences.observanceLevel : undefined,
    timeFormat: isTimeFormat(preferences.timeFormat) ? preferences.timeFormat : undefined,
    showHebrewDates: preferences.showHebrewDates,
    weekStartsOn: 0,
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
    showHebrewDatesOnGoals: preferences.showHebrewDatesOnGoals,
    hebrewDateFormat: isHebrewDateFormat(preferences.hebrewDateFormat) ? preferences.hebrewDateFormat : undefined,
    hebrewDateIncludeYear: preferences.hebrewDateIncludeYear,
  });
}

export function toPersistedCalendarPreferences(preferences: CalendarPreferences) {
  return {
    locationKey: preferences.locationKey,
    nusach: preferences.nusach,
    havdalahMode: preferences.havdalahMode,
    observanceLevel: preferences.observanceLevel,
    timeFormat: preferences.timeFormat,
    showHebrewDates: preferences.showHebrewDates,
    weekStartsOn: 0,
    defaultView: preferences.defaultView,
    showParsha: preferences.showParsha,
    showRoshChodesh: preferences.showRoshChodesh,
    showModernHolidays: preferences.showModernHolidays,
    showOutsideMonthDays: preferences.showOutsideMonthDays,
    havdalahOpinion: preferences.havdalahOpinion,
    timelineSnapMins: preferences.timelineSnapMins,
    timelineDefaultDurationMins: preferences.timelineDefaultDurationMins,
    showHebrewDatesOnGoals: preferences.showHebrewDatesOnGoals,
    hebrewDateFormat: preferences.hebrewDateFormat,
    hebrewDateIncludeYear: preferences.hebrewDateIncludeYear,
  };
}
