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
  size?: "md" | "sm";
}

export function SegmentedTabs<T extends string>({
  value,
  onValueChange,
  options,
  className,
  size = "md",
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
              "rounded-full font-semibold transition",
              size === "sm" ? "px-4 py-2 text-[13px] md:text-[14px]" : "px-5 py-3 text-base",
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
