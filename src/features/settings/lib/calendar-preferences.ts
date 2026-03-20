import type { CalendarPreferences, HavdalahOpinion } from "@/features/settings/types/calendar-preferences";

export const CALENDAR_PREFERENCES_STORAGE_KEY = "planner.calendar-preferences.v1";

export const defaultCalendarPreferences: CalendarPreferences = {
  locationKey: "",
  timeFormat: "24h",
  showHebrewDates: false,
  havdalahOpinion: "tzeit-8_5",
  showParsha: true,
  showOutsideMonthDays: true,
  showModernHolidays: true,
  weekStartsOn: 0,
  defaultView: "month",
  showRoshChodesh: true,
  showOmer: true,
  timelineSnapMins: 15,
  timelineDefaultDurationMins: 60,
};

export function getHavdalahOptions(opinion: HavdalahOpinion) {
  switch (opinion) {
    case "42":
      return { havdalahMins: 42 };
    case "50":
      return { havdalahMins: 50 };
    case "72":
      return { havdalahMins: 72 };
    case "tzeit-8_5":
    default:
      return { havdalahDeg: 8.5 };
  }
}
