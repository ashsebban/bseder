"use client";

import { useEffect, useState } from "react";
import { defaultCalendarPreferences, CALENDAR_PREFERENCES_STORAGE_KEY } from "@/features/settings/lib/calendar-preferences";
import type { CalendarPreferences } from "@/features/settings/types/calendar-preferences";

function isBrowser() {
  return typeof window !== "undefined";
}

export function useCalendarPreferences() {
  const [preferences, setPreferences] = useState<CalendarPreferences>(defaultCalendarPreferences);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!isBrowser()) return;
    try {
      const raw = window.localStorage.getItem(CALENDAR_PREFERENCES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CalendarPreferences>;
        // Fall back to default locationKey if saved value is empty (pre-default era)
        if (!parsed.locationKey) parsed.locationKey = defaultCalendarPreferences.locationKey;
        setPreferences({ ...defaultCalendarPreferences, ...parsed });
      }
    } catch {
      // Ignore malformed saved preferences and fall back to defaults.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isBrowser() || !hydrated) return;
    window.localStorage.setItem(CALENDAR_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  }, [hydrated, preferences]);

  const updatePreference = <K extends keyof CalendarPreferences>(key: K, value: CalendarPreferences[K]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  return {
    preferences,
    hydrated,
    updatePreference,
    resetPreferences: () => setPreferences(defaultCalendarPreferences),
  };
}
