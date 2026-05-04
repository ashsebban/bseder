"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { updateCalendarPreferences } from "@/features/settings/actions/settings-actions";
import { defaultCalendarPreferences } from "@/features/settings/lib/calendar-preferences";
import { toPersistedCalendarPreferences } from "@/features/settings/lib/calendar-preference-utils";
import { useCalendarPreferences } from "@/features/settings/hooks/use-calendar-preferences";
import type { CalendarPreferences } from "@/features/settings/types/calendar-preferences";

type SaveState = "idle" | "saving" | "saved" | "error";

export function useSyncedCalendarPreferences(
  initialPreferences?: Partial<CalendarPreferences>,
  storageScope?: string,
) {
  const { preferences, hydrated, setPreferences } = useCalendarPreferences(initialPreferences, storageScope);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistPreferences = useCallback((next: CalendarPreferences) => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

    setSaveState("saving");
    persistTimerRef.current = setTimeout(async () => {
      const result = await updateCalendarPreferences(toPersistedCalendarPreferences(next));
      setSaveState(result.error ? "error" : "saved");

      resetTimerRef.current = setTimeout(() => {
        setSaveState("idle");
      }, 1600);
    }, 250);
  }, []);

  const updatePreference = useCallback(<K extends keyof CalendarPreferences>(key: K, value: CalendarPreferences[K]) => {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      persistPreferences(next);
      return next;
    });
  }, [persistPreferences, setPreferences]);

  const resetPreferences = useCallback(() => {
    setPreferences(defaultCalendarPreferences);
    persistPreferences(defaultCalendarPreferences);
  }, [persistPreferences, setPreferences]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  return {
    preferences,
    hydrated,
    updatePreference,
    resetPreferences,
    saveState,
  };
}
