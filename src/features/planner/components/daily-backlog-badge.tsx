"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
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
  const [localResolved, setLocalResolved] = useState<Set<string>>(new Set());

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => a.date.localeCompare(b.date)),
    [entries],
  );

  const pendingEntries = useMemo(
    () => sortedEntries.filter((e) => !localResolved.has(e.date)),
    [sortedEntries, localResolved],
  );

  const allDone = sortedEntries.length > 0 && pendingEntries.length === 0;

  // Reset local state on close so re-opening shows the current server state.
  useEffect(() => {
    if (!open) setLocalResolved(new Set());
  }, [open]);

  // Auto-close shortly after all entries are marked done.
  useEffect(() => {
    if (!allDone || !open) return;
    const t = setTimeout(() => setOpen(false), 1100);
    return () => clearTimeout(t);
  }, [allDone, open]);

  if (sortedEntries.length === 0) return null;

  function handleResolve(date: string) {
    setLocalResolved((prev) => new Set([...prev, date]));
    onResolveDate?.(date);
  }

  function handleResolveAll() {
    pendingEntries.forEach((e) => handleResolve(e.date));
  }

  const n = entries.length;

  return (
    <>
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); setOpen(true); }}
        onPointerDown={(event) => event.stopPropagation()}
        title={`${n} missed ${n === 1 ? "day" : "days"} — tap to catch up`}
        className={cn(
          "shrink-0 rounded-full border border-slate-200/80 bg-slate-100/70 px-2 py-[1px] text-[10px] font-medium text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-600",
          compact && "px-1.5 text-[9px]",
          className,
        )}
      >
        +{n}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={goalTitle}
        description={
          allDone
            ? "You're all caught up!"
            : `${n} ${n === 1 ? "day" : "days"} to catch up`
        }
        panelClassName="max-w-md"
        footer={
          !allDone && onResolveDate && pendingEntries.length > 1 ? (
            <button
              type="button"
              onClick={handleResolveAll}
              className="w-full rounded-2xl bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong"
            >
              Mark all done
            </button>
          ) : undefined
        }
      >
        {allDone ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-7 w-7 text-emerald-600" strokeWidth={2.5} />
            </div>
            <p className="text-sm text-text-muted">Closing…</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingEntries.map((entry) => (
              <div
                key={entry.date}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">
                    {entry.label ?? formatEntryDate(entry.date)}
                  </p>
                  {entry.label && (
                    <p className="mt-0.5 text-[11px] text-text-muted">{formatEntryDate(entry.date)}</p>
                  )}
                </div>
                {onResolveDate ? (
                  <button
                    type="button"
                    onClick={() => handleResolve(entry.date)}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl border border-brand/20 bg-brand-soft/60 px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand-soft"
                  >
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                    Done
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
