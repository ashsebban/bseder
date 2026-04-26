"use client";

import { cn } from "@/lib/cn";
import type { HavdalahOpinion } from "@/features/onboarding/lib/observance-utils";

interface HavdalahPickerProps {
  value: HavdalahOpinion;
  onChange: (havdalah: HavdalahOpinion) => void;
}

const HAVDALAH_OPTIONS: { value: HavdalahOpinion; label: string; sublabel: string }[] = [
  { value: "tzeit-8_5", label: "Tzeit (8.5°)", sublabel: "Most common" },
  { value: "42", label: "42 min", sublabel: "After shekia" },
  { value: "50", label: "50 min", sublabel: "After shekia" },
  { value: "72", label: "72 min", sublabel: "Baal HaTanya" },
];

export function HavdalahPicker({ value, onChange }: HavdalahPickerProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-text">When does Shabbos end for you?</p>
      <div className="flex overflow-hidden rounded-xl border border-line/60 bg-canvas p-0.5 gap-0.5">
        {HAVDALAH_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 rounded-lg px-2 py-2 text-center transition-colors",
              value === opt.value
                ? "bg-surface shadow-sm text-brand"
                : "text-text-subtle hover:text-text",
            )}
          >
            <p className="text-[12.5px] font-semibold leading-tight">{opt.label}</p>
            <p className={cn("mt-0.5 text-[10px] leading-tight", value === opt.value ? "text-brand/60" : "text-text-subtle")}>{opt.sublabel}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
