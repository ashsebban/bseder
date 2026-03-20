import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
}

export function Select({ className, wrapperClassName, children, ...props }: SelectProps) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        className={cn(
          "h-12 w-full appearance-none rounded-2xl border border-line bg-white px-4 pr-11 text-base font-medium text-text shadow-soft transition focus:border-brand/40 focus:outline-none focus:ring-4 focus:ring-brand/15",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
    </div>
  );
}
