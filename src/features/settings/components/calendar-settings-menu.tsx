"use client";

import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CalendarPreferencesEditor } from "@/features/settings/components/calendar-preferences-editor";
import type { CalendarPreferences } from "@/features/settings/types/calendar-preferences";

interface CalendarSettingsMenuProps {
  preferences: CalendarPreferences;
  onPreferenceChange: <K extends keyof CalendarPreferences>(key: K, value: CalendarPreferences[K]) => void;
  onReset: () => void;
  saveState?: "idle" | "saving" | "saved" | "error";
}

export function CalendarSettingsMenu({
  preferences,
  onPreferenceChange,
  onReset,
  saveState,
}: CalendarSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target as Node)) setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={panelRef} className="relative">
      <Button variant="secondary" size="sm" className="px-2.5" onClick={() => setOpen((value) => !value)}>
        <Settings2 className="h-4 w-4" />
      </Button>

      {open ? (
        <Card className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[min(22rem,calc(100vw-2rem))] border-line/80 p-4 shadow-panel">
          <CalendarPreferencesEditor
            preferences={preferences}
            onPreferenceChange={onPreferenceChange}
            onReset={onReset}
            saveState={saveState}
            variant="menu"
          />
        </Card>
      ) : null}
    </div>
  );
}
