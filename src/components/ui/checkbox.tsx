"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

type CheckboxSize = "xs" | "sm" | "md";

const sizeClasses: Record<CheckboxSize, { box: string; icon: string }> = {
  xs: { box: "h-3 w-3", icon: "h-2 w-2" },
  sm: { box: "h-4 w-4", icon: "h-2.5 w-2.5" },
  md: { box: "h-5 w-5", icon: "h-3 w-3" },
};

export interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  size?: CheckboxSize;
  className?: string;
  uncheckedClassName?: string;
  checkedClassName?: string;
  "aria-label"?: string;
}

export function Checkbox({
  checked,
  onChange,
  size = "md",
  className,
  uncheckedClassName,
  checkedClassName,
  "aria-label": ariaLabel,
}: CheckboxProps) {
  const sizeClass = sizeClasses[size];

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onChange();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      aria-label={ariaLabel ?? (checked ? "Mark incomplete" : "Mark complete")}
      aria-pressed={checked}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
        sizeClass.box,
        checked
          ? cn("border-success bg-success", checkedClassName)
          : cn("border-slate-300 bg-white hover:border-brand/50", uncheckedClassName),
        className,
      )}
    >
      {checked && <Check className={cn("text-white", sizeClass.icon)} strokeWidth={3} />}
    </button>
  );
}
