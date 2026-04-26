"use client";

import { useEffect, useState } from "react";
import {
  defaultCalendarPreferences,
  loadCalendarPreferencesFromStorage,
  saveCalendarPreferencesToStorage,
} from "@/features/settings/lib/calendar-preferences";
import { normalizeCalendarPreferences } from "@/features/settings/lib/calendar-preference-utils";
import type { CalendarPreferences } from "@/features/settings/types/calendar-preferences";

function isBrowser() {
  return typeof window !== "undefined";
}

export function useCalendarPreferences(
  initialPreferences?: Partial<CalendarPreferences>,
  storageScope?: string,
) {
  const [preferences, setPreferencesState] = useState<CalendarPreferences>(
    normalizeCalendarPreferences(initialPreferences ?? defaultCalendarPreferences),
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!isBrowser()) return;
    if (!storageScope) {
      setPreferencesState(normalizeCalendarPreferences(initialPreferences ?? defaultCalendarPreferences));
      setHydrated(false);
      return;
    }

    try {
      const parsed = loadCalendarPreferencesFromStorage(storageScope);
      if (parsed) {
        setPreferencesState(normalizeCalendarPreferences({
          ...(initialPreferences ?? {}),
          ...parsed,
        }));
      } else if (initialPreferences) {
        setPreferencesState(normalizeCalendarPreferences(initialPreferences));
      }
    } catch {
      // Ignore malformed saved preferences and fall back to defaults.
    } finally {
      setHydrated(true);
    }
  }, [initialPreferences, storageScope]);

  useEffect(() => {
    if (!isBrowser() || !hydrated || !storageScope) return;
    saveCalendarPreferencesToStorage(storageScope, preferences);
  }, [hydrated, preferences, storageScope]);

  const setPreferences = (next: CalendarPreferences | ((current: CalendarPreferences) => CalendarPreferences)) => {
    setPreferencesState((current) => normalizeCalendarPreferences(
      typeof next === "function" ? next(current) : next,
    ));
  };

  const updatePreference = <K extends keyof CalendarPreferences>(key: K, value: CalendarPreferences[K]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  return {
    preferences,
    hydrated,
    setPreferences,
    updatePreference,
    resetPreferences: () => setPreferences(defaultCalendarPreferences),
  };
}
