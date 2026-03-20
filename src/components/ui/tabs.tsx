import * as React from "react";
import { cn } from "@/lib/cn";

export interface TabOption<T extends string> {
  label: string;
  value: T;
}

interface TabsProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: TabOption<T>[];
  className?: string;
}

export function SegmentedTabs<T extends string>({
  value,
  onValueChange,
  options,
  className,
}: TabsProps<T>) {
  return (
    <div className={cn("inline-flex rounded-full border border-line bg-surface-muted p-1", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onValueChange(option.value)}
            className={cn(
              "rounded-full px-5 py-3 text-base font-semibold transition",
              active
                ? "bg-white text-text shadow-soft"
                : "text-text-muted hover:text-text",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
