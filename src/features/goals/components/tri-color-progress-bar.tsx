"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

interface TriColorProgressBarProps {
  /** Number of completed units */
  done: number;
  /** Number of missed units (shown red, only when ifUnfinished === "track-failure") */
  missed: number;
  /** Total applicable units in the period */
  total: number;
  className?: string;
}

export function TriColorProgressBar({ done, missed, total, className }: TriColorProgressBarProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  if (total === 0) {
    return (
      <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)} />
    );
  }

  const donePct = animated ? Math.min(100, (done / total) * 100) : 0;
  const missedPct = animated ? Math.min(100 - donePct, (missed / total) * 100) : 0;
  const remainingPct = 100 - donePct - missedPct;

  return (
    <div className={cn("flex h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      {/* Done — green */}
      <div
        className="h-full bg-success transition-[width] duration-700 ease-out"
        style={{ width: `${donePct}%` }}
      />
      {/* Missed — red */}
      {missedPct > 0 && (
        <div
          className="h-full bg-penalty transition-[width] duration-700 ease-out"
          style={{ width: `${missedPct}%` }}
        />
      )}
      {/* Remaining — faint (already shown by the background track) */}
    </div>
  );
}
