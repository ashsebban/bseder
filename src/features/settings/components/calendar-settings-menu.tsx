"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { calendarLocationOptions } from "@/features/calendar/lib/locations";
import type { CalendarPreferences, CalendarTimeFormat, HavdalahOpinion } from "@/features/settings/types/calendar-preferences";
import type { CalendarView } from "@/features/calendar/types/calendar";

interface CalendarSettingsMenuProps {
  preferences: CalendarPreferences;
  onPreferenceChange: <K extends keyof CalendarPreferences>(key: K, value: CalendarPreferences[K]) => void;
  onReset: () => void;
}

const havdalahOptions: { value: HavdalahOpinion; label: string }[] = [
  { value: "tzeit-8_5", label: "Tzeit (8.5°)" },
  { value: "42", label: "42 min" },
  { value: "50", label: "50 min" },
  { value: "72", label: "72 min" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-text-subtle">
      {children}
    </p>
  );
}

function SelectRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/50 py-1 last:border-b-0">
      <span className="text-[12.5px] font-medium text-text">{label}</span>
      <div className="w-[136px] shrink-0">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/50 py-1.5 last:border-b-0">
      <div>
        <p className="text-[13px] font-medium text-text">{label}</p>
        {description && <p className="text-[10.5px] text-text-subtle">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function CalendarSettingsMenu({
  preferences,
  onPreferenceChange,
  onReset,
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
      <Button variant="secondary" size="sm" className="px-2.5" onClick={() => setOpen((v) => !v)}>
        <Settings2 className="h-4 w-4" />
      </Button>

      {open ? (
        <Card className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[min(22rem,calc(100vw-2rem))] border-line/80 p-4 shadow-panel">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line/60 pb-2">
            <h3 className="text-sm font-bold text-text">Calendar Settings</h3>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={onReset}>
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          </div>

          {/* Week */}
          <SectionLabel>Week</SectionLabel>
          <SelectRow label="Starts on">
            <Select
              className="h-8 w-full rounded-lg px-3 pr-8 text-[12.5px]"
              value={String(preferences.weekStartsOn)}
              onChange={(e) => onPreferenceChange("weekStartsOn", Number(e.target.value) as 0 | 1)}
            >
              <option value="0">Sunday</option>
              <option value="1">Monday</option>
            </Select>
          </SelectRow>
          <SelectRow label="Default view">
            <Select
              className="h-8 w-full rounded-lg px-3 pr-8 text-[12.5px]"
              value={preferences.defaultView}
              onChange={(e) => onPreferenceChange("defaultView", e.target.value as CalendarView)}
            >
              <option value="month">Monthly</option>
              <option value="week">Weekly</option>
              <option value="day">Daily</option>
            </Select>
          </SelectRow>

          {/* Times & Location */}
          <SectionLabel>Times & Location</SectionLabel>
          <SelectRow label="Location">
            <Select
              className="h-8 w-full rounded-lg px-3 pr-8 text-[12.5px]"
              value={preferences.locationKey}
              onChange={(e) => onPreferenceChange("locationKey", e.target.value)}
            >
              <option value="">No location</option>
              {calendarLocationOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </Select>
          </SelectRow>
          <SelectRow label="Time format">
            <Select
              className="h-8 w-full rounded-lg px-3 pr-8 text-[12.5px]"
              value={preferences.timeFormat}
              onChange={(e) => onPreferenceChange("timeFormat", e.target.value as CalendarTimeFormat)}
            >
              <option value="12h">12-hour</option>
              <option value="24h">24-hour</option>
            </Select>
          </SelectRow>
          <SelectRow label="Shabbos ends">
            <Select
              className="h-8 w-full rounded-lg px-3 pr-8 text-[12.5px]"
              value={preferences.havdalahOpinion}
              onChange={(e) => onPreferenceChange("havdalahOpinion", e.target.value as HavdalahOpinion)}
            >
              {havdalahOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </SelectRow>

          {/* Display */}
          <SectionLabel>Display</SectionLabel>
          <ToggleRow
            label="Hebrew dates"
            checked={preferences.showHebrewDates}
            onCheckedChange={(v) => onPreferenceChange("showHebrewDates", v)}
          />
          <ToggleRow
            label="Weekly parsha"
            checked={preferences.showParsha}
            onCheckedChange={(v) => onPreferenceChange("showParsha", v)}
          />
          <ToggleRow
            label="Outside-month days"
            checked={preferences.showOutsideMonthDays}
            onCheckedChange={(v) => onPreferenceChange("showOutsideMonthDays", v)}
          />
          <ToggleRow
            label="Rosh Chodesh"
            checked={preferences.showRoshChodesh}
            onCheckedChange={(v) => onPreferenceChange("showRoshChodesh", v)}
          />
          <ToggleRow
            label="Omer count"
            description="Show day of Sefirat HaOmer · auto-adds to daily checklist"
            checked={preferences.showOmer}
            onCheckedChange={(v) => onPreferenceChange("showOmer", v)}
          />

          {/* Holidays */}
          <SectionLabel>Holidays</SectionLabel>
          <ToggleRow
            label="Modern holidays"
            description="Yom HaAtzma'ut, Yom HaShoah, Yom Yerushalayim…"
            checked={preferences.showModernHolidays}
            onCheckedChange={(v) => onPreferenceChange("showModernHolidays", v)}
          />
        </Card>
      ) : null}
    </div>
  );
}
