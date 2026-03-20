"use client";

import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { HOLIDAY_GROUPS } from "@/features/goals/lib/holiday-catalog";
import type { HolidayExcludes } from "@/features/goals/components/holiday-chip-select";

interface HolidayCustomPanelProps {
  value: HolidayExcludes;
  onChange: (value: HolidayExcludes) => void;
  onBack: () => void;
}

export function HolidayCustomDrawer({ value, onChange, onBack }: HolidayCustomPanelProps) {
  function toggleItem(key: string) {
    const isSelected = value.individual.includes(key);
    onChange({
      ...value,
      individual: isSelected
        ? value.individual.filter((k) => k !== key)
        : [...value.individual, key],
    });
  }

  function toggleGroup(groupKey: string) {
    const group = HOLIDAY_GROUPS.find((g) => g.key === groupKey);
    if (!group) return;
    const groupItemKeys = group.items.map((i) => i.key);
    const allSelected = groupItemKeys.every((k) => value.individual.includes(k));
    onChange({
      ...value,
      individual: allSelected
        ? value.individual.filter((k) => !groupItemKeys.includes(k))
        : [...new Set([...value.individual, ...groupItemKeys])],
    });
  }

  const selectedCount = value.individual.length;

  return (
    <div className="flex flex-col">
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-text-muted transition hover:text-text"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        {selectedCount > 0 ? (
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            {selectedCount} selected
          </span>
        ) : null}
      </div>

      <p className="mb-4 text-xs text-text-subtle">
        Select individual holidays to exclude. These override the category chips.
      </p>

      <div className="space-y-5">
        {HOLIDAY_GROUPS.map((group) => {
          const groupKeys = group.items.map((i) => i.key);
          const selectedInGroup = groupKeys.filter((k) => value.individual.includes(k)).length;
          const allInGroup = selectedInGroup === groupKeys.length;

          return (
            <div key={group.key}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand/70">
                  {group.label}
                </span>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="text-[10px] font-semibold text-text-muted underline underline-offset-2 transition hover:text-text"
                >
                  {allInGroup ? "Deselect all" : "Select all"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {group.items.map((item) => {
                  const checked = value.individual.includes(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleItem(item.key)}
                      className={cn(
                        "flex items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition",
                        checked
                          ? "border-brand/40 bg-brand-soft/60 text-brand"
                          : "border-line bg-surface text-text hover:border-brand/30 hover:bg-surface-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[8px] font-bold",
                          checked ? "border-brand bg-brand text-white" : "border-line bg-surface",
                        )}
                      >
                        {checked ? "✓" : ""}
                      </span>
                      <span className="text-xs font-medium leading-tight">
                        {item.label}
                        {item.days ? (
                          <span className="ml-1 text-[10px] font-normal text-text-subtle">
                            ({item.days}d)
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mt-6 w-full rounded-2xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90"
      >
        Done{selectedCount > 0 ? ` (${selectedCount})` : ""}
      </button>
    </div>
  );
}
