import * as React from "react";
import { cn } from "@/lib/cn";

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Switch({ checked, onCheckedChange, className, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15",
        checked ? "border-brand/30 bg-brand" : "border-line bg-surfaceMuted",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "absolute left-1 h-5 w-5 rounded-full bg-white shadow-soft transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}
