"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

interface GoalProgressBarProps {
  value: number; // 0–100
  className?: string;
}

export function GoalProgressBar({ value, className }: GoalProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Small delay so the transition is visible on mount
    const timer = setTimeout(() => setDisplayValue(clamped), 80);
    return () => clearTimeout(timer);
  }, [clamped]);

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-[width,background-color] duration-700 ease-out",
          displayValue >= 100 ? "bg-success" : "bg-brand",
        )}
        style={{ width: `${displayValue}%` }}
      />
    </div>
  );
}
