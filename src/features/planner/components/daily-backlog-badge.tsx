"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { parseIsoDate } from "@/lib/date";
import { Modal } from "@/components/ui/modal";
import type { DailyBacklogEntry } from "@/features/goals/lib/daily-backlog";

function formatEntryDate(isoDate: string): string {
  return (parseIsoDate(isoDate) ?? new Date()).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface DailyBacklogBadgeProps {
  goalTitle: string;
  entries: DailyBacklogEntry[];
  onResolveDate?: (isoDate: string) => void;
  className?: string;
  compact?: boolean;
}

export function DailyBacklogBadge({
  goalTitle,
  entries,
  onResolveDate,
  className,
  compact = false,
}: DailyBacklogBadgeProps) {
  const [open, setOpen] = useState(false);
  const sortedEntries = useMemo(() => [...entries].sort((left, right) => left.date.localeCompare(right.date)), [entries]);

  if (sortedEntries.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        className={cn(
          "shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-[1px] text-[10px] font-semibold text-amber-700 transition hover:bg-amber-100",
          compact && "px-1.5 text-[9px]",
          className,
        )}
        title={`${sortedEntries.length} missed ${sortedEntries.length === 1 ? "day" : "days"} carried over`}
      >
        +{sortedEntries.length}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${goalTitle} backlog`}
        description="Missed days roll over until you catch them up."
        panelClassName="max-w-lg"
      >
        <div className="space-y-3">
          {sortedEntries.map((entry) => (
            <div
              key={entry.date}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">
                  {entry.label ?? formatEntryDate(entry.date)}
                </p>
                {entry.label ? (
                  <p className="mt-0.5 text-xs text-text-muted">{formatEntryDate(entry.date)}</p>
                ) : null}
              </div>
              {onResolveDate ? (
                <button
                  type="button"
                  onClick={() => onResolveDate(entry.date)}
                  className="shrink-0 rounded-xl border border-brand/20 bg-brand-soft/60 px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand-soft"
                >
                  Mark caught up
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
