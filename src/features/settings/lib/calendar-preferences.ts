import type { CalendarPreferences, HavdalahOpinion, Nusach } from "@/features/settings/types/calendar-preferences";
import { buildScopedStorageKey, purgeLegacyPlannerStorage } from "../../../lib/user-scoped-browser-storage";

export const CALENDAR_PREFERENCES_STORAGE_KEY = "planner.calendar-preferences.v1";

export const NUSACH_HAVDALAH: Record<Nusach, HavdalahOpinion> = {
  ashkenaz: "42",
  sfard: "72",
  sephardi: "tzeit-8_5",
  temanim: "tzeit-8_5",
  chabad: "50",
  custom: "tzeit-8_5",
};

export function getEffectiveHavdalahOpinion(
  preferences: Pick<CalendarPreferences, "nusach" | "havdalahMode" | "havdalahOpinion">,
): HavdalahOpinion {
  if (preferences.havdalahMode === "nusach") {
    return NUSACH_HAVDALAH[preferences.nusach];
  }
  return preferences.havdalahOpinion;
}

export const defaultCalendarPreferences: CalendarPreferences = {
  locationKey: "new-york",
  nusach: "ashkenaz",
  havdalahMode: "nusach",
  observanceLevel: "unknown",
  timeFormat: "12h",
  showHebrewDates: true,
  havdalahOpinion: "tzeit-8_5",
  showParsha: true,
  showOutsideMonthDays: true,
  showModernHolidays: false,
  weekStartsOn: 0,
  defaultView: "week",
  showRoshChodesh: true,
  timelineSnapMins: 15,
  timelineDefaultDurationMins: 30,
  showHebrewDatesOnGoals: false,
  hebrewDateFormat: "english",
  hebrewDateIncludeYear: false,
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

export function getScopedCalendarPreferencesStorageKey(storageScope: string): string {
  return buildScopedStorageKey(CALENDAR_PREFERENCES_STORAGE_KEY, storageScope);
}

export function loadCalendarPreferencesFromStorage(storageScope: string): Partial<CalendarPreferences> | null {
  if (typeof window === "undefined") return null;
  try {
    purgeLegacyPlannerStorage();
    const raw = window.localStorage.getItem(getScopedCalendarPreferencesStorageKey(storageScope));
    if (!raw) return null;
    return JSON.parse(raw) as Partial<CalendarPreferences>;
  } catch {
    return null;
  }
}

export function saveCalendarPreferencesToStorage(
  storageScope: string,
  preferences: Partial<CalendarPreferences>,
): void {
  if (typeof window === "undefined") return;
  try {
    purgeLegacyPlannerStorage();
    window.localStorage.setItem(
      getScopedCalendarPreferencesStorageKey(storageScope),
      JSON.stringify(preferences),
    );
  } catch {
    // Ignore localStorage failures.
  }
}

export function clearCalendarPreferencesStorage(storageScope: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getScopedCalendarPreferencesStorageKey(storageScope));
  } catch {
    // Ignore localStorage failures.
  }
}
