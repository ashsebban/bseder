"use client";

import { X, Settings2 } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  HOLIDAY_CATEGORIES,
  HOLIDAY_GROUPS,
  getIndividualKeysForCategories,
} from "@/features/goals/lib/holiday-catalog";

function getItemLabel(key: string): string {
  for (const group of HOLIDAY_GROUPS) {
    const item = group.items.find((i) => i.key === key);
    if (item) return item.label;
  }
  return key.replace(/_/g, " ");
}

export interface HolidayExcludes {
  categories: string[];
  individual: string[];
}

interface HolidayChipSelectProps {
  value: HolidayExcludes;
  onChange: (value: HolidayExcludes) => void;
  onCustomize: () => void;
}

export function HolidayChipSelect({ value, onChange, onCustomize }: HolidayChipSelectProps) {
  /** Chip state derived from individual[] — the single source of truth */
  function chipState(catKey: string): "active" | "partial" | "inactive" {
    const members = getIndividualKeysForCategories([catKey]);
    if (members.length === 0) return "inactive";
    const selected = members.filter((k) => value.individual.includes(k)).length;
    if (selected === members.length) return "active";
    if (selected > 0) return "partial";
    return "inactive";
  }

  function toggleCategory(catKey: string) {
    const members = getIndividualKeysForCategories([catKey]);
    const allSelected = members.length > 0 && members.every((k) => value.individual.includes(k));
    if (allSelected) {
      // Deselect: remove all members from individual + remove from categories
      onChange({
        categories: value.categories.filter((c) => c !== catKey),
        individual: value.individual.filter((k) => !members.includes(k)),
      });
    } else {
      // Select: add all missing members to individual + add to categories
      const newIndividual = [...value.individual];
      for (const k of members) {
        if (!newIndividual.includes(k)) newIndividual.push(k);
      }
      onChange({
        categories: value.categories.includes(catKey) ? value.categories : [...value.categories, catKey],
        individual: newIndividual,
      });
    }
  }

  // Individual items not covered by any fully-active category chip
  const activeCatMembers = new Set(
    HOLIDAY_CATEGORIES.map((c) => c.key)
      .filter((k) => chipState(k) === "active")
      .flatMap((k) => getIndividualKeysForCategories([k])),
  );
  const customIndividual = value.individual.filter((k) => !activeCatMembers.has(k));

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {HOLIDAY_CATEGORIES.map((cat) => {
          const state = chipState(cat.key);
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => toggleCategory(cat.key)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition",
                state === "active"
                  ? "border-brand/40 bg-brand-soft text-brand"
                  : state === "partial"
                    ? "border-brand/30 bg-brand-soft/50 text-brand/70"
                    : "border-line bg-surface text-text-muted hover:border-brand/30 hover:text-text",
              )}
            >
              {cat.label}
              {state !== "inactive" && <X className="h-3 w-3" />}
            </button>
          );
        })}
      </div>

      {customIndividual.length > 0 ? (
        <p className="text-xs text-text-muted">
          Also excluding: {customIndividual.map(getItemLabel).join(", ")}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onCustomize}
        className="flex items-center gap-1.5 text-xs font-semibold text-brand/70 transition hover:text-brand"
      >
        <Settings2 className="h-3.5 w-3.5" />
        {value.individual.length > 0 ? "Edit individual holidays…" : "Customize individual holidays…"}
      </button>
    </div>
  );
}
