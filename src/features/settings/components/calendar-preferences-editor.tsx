"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { CalendarPreferences, CalendarTimeFormat } from "@/features/settings/types/calendar-preferences";
import type { CalendarView } from "@/features/calendar/types/calendar";

type SaveState = "idle" | "saving" | "saved" | "error";

interface CalendarPreferencesEditorProps {
  preferences: CalendarPreferences;
  onPreferenceChange: <K extends keyof CalendarPreferences>(key: K, value: CalendarPreferences[K]) => void;
  onReset?: () => void;
  saveState?: SaveState;
  variant?: "menu" | "page";
  title?: string;
  subtitle?: string;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-text-subtle">
      {children}
    </p>
  );
}

function SelectRow({ label, children, widthClassName = "w-[136px]" }: { label: string; children: React.ReactNode; widthClassName?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/50 py-1 last:border-b-0">
      <span className="text-[12.5px] font-medium text-text">{label}</span>
      <div className={`${widthClassName} shrink-0`}>{children}</div>
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
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/50 py-1.5 last:border-b-0">
      <div>
        <p className="text-[13px] font-medium text-text">{label}</p>
        {description ? <p className="text-[10.5px] text-text-subtle">{description}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SaveStateLabel({ saveState }: { saveState?: SaveState }) {
  if (saveState === "saving") return <span className="text-[11px] text-text-subtle">Saving…</span>;
  if (saveState === "saved") return <span className="text-[11px] text-success">Saved</span>;
  if (saveState === "error") return <span className="text-[11px] text-red-500">Couldn&apos;t save</span>;
  return null;
}

export function CalendarPreferencesEditor({
  preferences,
  onPreferenceChange,
  onReset,
  saveState = "idle",
  variant = "menu",
  title = "Calendar Settings",
  subtitle,
}: CalendarPreferencesEditorProps) {
  const widthClassName = variant === "page" ? "w-[176px]" : "w-[136px]";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between border-b border-line/60 pb-2">
        <div>
          <h3 className="text-sm font-bold text-text">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[11px] text-text-subtle">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <SaveStateLabel saveState={saveState} />
          {onReset ? (
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={onReset}>
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      <SectionLabel>Calendar</SectionLabel>
      <SelectRow label="Default view" widthClassName={widthClassName}>
        <Select
          className="h-8 w-full rounded-lg px-3 pr-8 text-[12.5px]"
          value={preferences.defaultView}
          onChange={(event) => onPreferenceChange("defaultView", event.target.value as CalendarView)}
        >
          <option value="month">Monthly</option>
          <option value="week">Weekly</option>
          <option value="day">Daily</option>
        </Select>
      </SelectRow>

      <SectionLabel>Times</SectionLabel>
      <SelectRow label="Time format" widthClassName={widthClassName}>
        <Select
          className="h-8 w-full rounded-lg px-3 pr-8 text-[12.5px]"
          value={preferences.timeFormat}
          onChange={(event) => onPreferenceChange("timeFormat", event.target.value as CalendarTimeFormat)}
        >
          <option value="12h">12-hour</option>
          <option value="24h">24-hour</option>
        </Select>
      </SelectRow>

      <SectionLabel>Display</SectionLabel>
      <ToggleRow
        label="Hebrew dates"
        checked={preferences.showHebrewDates}
        onCheckedChange={(value) => onPreferenceChange("showHebrewDates", value)}
      />
      <ToggleRow
        label="Weekly parsha"
        checked={preferences.showParsha}
        onCheckedChange={(value) => onPreferenceChange("showParsha", value)}
      />
      <ToggleRow
        label="Outside-month days"
        checked={preferences.showOutsideMonthDays}
        onCheckedChange={(value) => onPreferenceChange("showOutsideMonthDays", value)}
      />
      <ToggleRow
        label="Rosh Chodesh"
        checked={preferences.showRoshChodesh}
        onCheckedChange={(value) => onPreferenceChange("showRoshChodesh", value)}
      />

      <SectionLabel>Holidays</SectionLabel>
      <ToggleRow
        label="Modern holidays"
        description="Yom HaAtzma'ut, Yom HaShoah, Yom Yerushalayim…"
        checked={preferences.showModernHolidays}
        onCheckedChange={(value) => onPreferenceChange("showModernHolidays", value)}
      />
    </div>
  );
}
