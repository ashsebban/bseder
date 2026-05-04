"use client";

import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { CalendarPreferences, HebrewDateFormat } from "@/features/settings/types/calendar-preferences";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-text-subtle">
      {children}
    </p>
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

function SelectRow({
  label,
  description,
  children,
  widthClassName = "w-[176px]",
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  widthClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/50 py-1.5 last:border-b-0">
      <div>
        <p className="text-[12.5px] font-medium text-text">{label}</p>
        {description ? <p className="text-[10.5px] text-text-subtle">{description}</p> : null}
      </div>
      <div className={`${widthClassName} shrink-0`}>{children}</div>
    </div>
  );
}

interface GoalsPreferencesEditorProps {
  preferences: CalendarPreferences;
  onPreferenceChange: <K extends keyof CalendarPreferences>(key: K, value: CalendarPreferences[K]) => void;
}

export function GoalsPreferencesEditor({ preferences, onPreferenceChange }: GoalsPreferencesEditorProps) {
  return (
    <div className="space-y-2">
      <SectionLabel>Date Display</SectionLabel>
      <ToggleRow
        label="Show Hebrew dates on goals"
        description="Adds Hebrew date ranges to seasonal goal details"
        checked={preferences.showHebrewDatesOnGoals}
        onCheckedChange={(value) => onPreferenceChange("showHebrewDatesOnGoals", value)}
      />

      {preferences.showHebrewDatesOnGoals && (
        <>
          <SelectRow label="Date format" description="Which date style to display">
            <Select
              className="h-8 w-full rounded-lg px-3 pr-8 text-[12.5px]"
              value={preferences.hebrewDateFormat}
              onChange={(e) => onPreferenceChange("hebrewDateFormat", e.target.value as HebrewDateFormat)}
            >
              <option value="english">English only</option>
              <option value="hebrew">Hebrew only</option>
              <option value="both">Both (English · Hebrew)</option>
            </Select>
          </SelectRow>
          <ToggleRow
            label="Include Hebrew year"
            description='E.g. "כ״ה כסלו תשפ״ו" instead of "כ״ה כסלו"'
            checked={preferences.hebrewDateIncludeYear}
            onCheckedChange={(value) => onPreferenceChange("hebrewDateIncludeYear", value)}
          />
        </>
      )}
    </div>
  );
}
