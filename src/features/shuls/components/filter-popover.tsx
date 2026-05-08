"use client";

import { Moon, RotateCcw, Sun, Sunrise, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Prayer } from "@/features/shuls/types/minyan";
import { getPrayerLabel } from "@/features/shuls/lib/prayer-detector";

const PRAYER_ICONS: Record<Prayer, typeof Moon> = {
  shacharit: Sunrise,
  mincha: Sun,
  maariv: Moon,
};

const NUSACH_LABELS: Record<ShulFilters["nusach"], string> = {
  all: "All",
  ashkenaz: "Ashkenaz",
  sfard: "Sfard",
};

export interface ShulFilters {
  prayer: Prayer;
  nusach: "all" | "ashkenaz" | "sfard";
  distanceMi: 0.5 | 1 | 2 | 5;
  showShulsWithoutTimes: boolean;
}

interface FilterPopoverProps {
  open: boolean;
  filters: ShulFilters;
  onChange: (next: ShulFilters) => void;
  onClose: () => void;
  onResetSmartDefaults: () => void;
}

export function FilterPopover({
  open,
  filters,
  onChange,
  onClose,
  onResetSmartDefaults,
}: FilterPopoverProps) {
  if (!open) return null;

  const update = <K extends keyof ShulFilters>(key: K, value: ShulFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <>
      <div className="fixed inset-0 z-[1900] bg-black/10" onClick={onClose} />
      <div
        className="fixed left-1/2 top-32 z-[2000] w-[min(380px,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-4 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Shul filters"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-bold text-slate-800">Filters</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
            aria-label="Close filters"
            title="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mb-4">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Prayer</p>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
            {(["shacharit", "mincha", "maariv"] as Prayer[]).map((prayer) => {
              const Icon = PRAYER_ICONS[prayer];
              return (
                <button
                  key={prayer}
                  type="button"
                  onClick={() => update("prayer", prayer)}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-[12px] font-semibold transition",
                    filters.prayer === prayer ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {getPrayerLabel(prayer)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Nusach</p>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
            {(["all", "ashkenaz", "sfard"] as const).map((nusach) => (
              <button
                key={nusach}
                type="button"
                onClick={() => update("nusach", nusach)}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-[12px] font-semibold capitalize transition",
                  filters.nusach === nusach ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700",
                )}
              >
                {NUSACH_LABELS[nusach]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Distance</p>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
            {([0.5, 1, 2, 5] as const).map((distance) => (
              <button
                key={distance}
                type="button"
                onClick={() => update("distanceMi", distance)}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-[12px] font-semibold transition",
                  filters.distanceMi === distance ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700",
                )}
              >
                {distance} mi
              </button>
            ))}
          </div>
        </div>

        <label className="mb-4 flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <span className="text-[12px] font-medium text-slate-700">Show shuls without times</span>
          <input
            type="checkbox"
            checked={filters.showShulsWithoutTimes}
            onChange={(event) => update("showShulsWithoutTimes", event.target.checked)}
            className="h-4 w-4 accent-brand"
          />
        </label>

        <button
          type="button"
          onClick={onResetSmartDefaults}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-500 transition hover:border-brand/30 hover:text-brand"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Reset to smart defaults
        </button>
      </div>
    </>
  );
}
