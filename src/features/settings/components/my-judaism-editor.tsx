"use client";

import { CalendarLocationField } from "@/features/settings/components/calendar-location-field";
import { Select } from "@/components/ui/select";
import { NUSACH_HAVDALAH } from "@/features/settings/lib/calendar-preferences";
import type {
  CalendarPreferences,
  HavdalahOpinion,
  HavdalahMode,
  Nusach,
  ObservanceLevel,
} from "@/features/settings/types/calendar-preferences";

const observanceLevelOptions: { value: ObservanceLevel; label: string }[] = [
  { value: "shabbos",     label: "Shomer Shabbat" },
  { value: "mixed",       label: "Partially observant" },
  { value: "not-shabbos", label: "Not Shabbat observant" },
  { value: "unknown",     label: "Prefer not to say" },
];

const nusachOptions: { value: Nusach; label: string; description: string }[] = [
  { value: "ashkenaz",  label: "Ashkenaz",           description: "Western European / Yekke" },
  { value: "sfard",     label: "Sfard / Chassidish",  description: "Nusach Sfard (Ashkenazic Chassidic)" },
  { value: "sephardi",  label: "Sephardi / Mizrachi", description: "Eastern / Middle Eastern tradition" },
  { value: "temanim",   label: "Temanim",             description: "Yemenite tradition" },
  { value: "chabad",    label: "Chabad",              description: "Chabad-Lubavitch nusach" },
  { value: "custom",    label: "Custom",              description: "Set havdalah manually below" },
];

const havdalahOptions: { value: HavdalahOpinion; label: string }[] = [
  { value: "tzeit-8_5", label: "Tzeit (8.5°)" },
  { value: "42",        label: "42 min after sunset" },
  { value: "50",        label: "50 min after sunset" },
  { value: "72",        label: "72 min after sunset" },
];

const HAVDALAH_LABELS: Record<HavdalahOpinion, string> = {
  "tzeit-8_5": "Tzeit (8.5°)",
  "42":        "42 min after sunset",
  "50":        "50 min after sunset",
  "72":        "72 min after sunset",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-text-subtle">
      {children}
    </p>
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

interface MyJudaismEditorProps {
  preferences: CalendarPreferences;
  onPreferenceChange: <K extends keyof CalendarPreferences>(key: K, value: CalendarPreferences[K]) => void;
}

export function MyJudaismEditor({ preferences, onPreferenceChange }: MyJudaismEditorProps) {
  const effectiveHavdalah = NUSACH_HAVDALAH[preferences.nusach];
  const effectiveLabel = HAVDALAH_LABELS[effectiveHavdalah];
  const currentNusach = nusachOptions.find((n) => n.value === preferences.nusach);

  return (
    <div className="space-y-2">
      <SectionLabel>Observance</SectionLabel>
      <SelectRow label="Observance level">
        <Select
          className="h-8 w-full rounded-lg px-3 pr-8 text-[12.5px]"
          value={preferences.observanceLevel}
          onChange={(e) => onPreferenceChange("observanceLevel", e.target.value as ObservanceLevel)}
        >
          {observanceLevelOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      </SelectRow>

      <SectionLabel>Nusach</SectionLabel>
      <SelectRow label="Nusach" description={currentNusach?.description}>
        <Select
          className="h-8 w-full rounded-lg px-3 pr-8 text-[12.5px]"
          value={preferences.nusach}
          onChange={(e) => onPreferenceChange("nusach", e.target.value as Nusach)}
        >
          {nusachOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      </SelectRow>

      <SectionLabel>Location</SectionLabel>
      <div className="border-b border-line/50 py-2">
        <CalendarLocationField
          value={{ locationKey: preferences.locationKey, customLocation: preferences.customLocation }}
          onChange={(next) => {
            onPreferenceChange("locationKey", next.locationKey);
            onPreferenceChange("customLocation", next.customLocation);
          }}
          variant="compact"
          allowBlankPreset
        />
      </div>

      <SectionLabel>Shabbat Ends</SectionLabel>

      {/* Mode toggle */}
      <div className="flex gap-2 border-b border-line/50 py-2">
        {(["nusach", "custom"] as HavdalahMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onPreferenceChange("havdalahMode", mode)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              preferences.havdalahMode === mode
                ? "border-brand/40 bg-brand-soft text-brand"
                : "border-line bg-surface text-text-muted hover:border-brand/20 hover:text-text"
            }`}
          >
            {mode === "nusach" ? "Nusach-based" : "Custom"}
          </button>
        ))}
      </div>

      {preferences.havdalahMode === "nusach" ? (
        <p className="rounded-xl bg-surface-muted px-4 py-2.5 text-sm text-text-muted">
          Based on <span className="font-semibold text-text">{currentNusach?.label}</span>: {effectiveLabel}
        </p>
      ) : (
        <SelectRow label="Shabbat ends">
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
      )}
    </div>
  );
}
