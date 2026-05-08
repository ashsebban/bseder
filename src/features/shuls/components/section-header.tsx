"use client";

import type { ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  count: number;
  countControl?: ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function SectionHeader({ icon: Icon, title, count, countControl, collapsed, onToggle }: SectionHeaderProps) {
  const content = (
    <>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">{title}</p>
        {countControl ?? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-bold text-slate-400 ring-1 ring-slate-200/70">
            {count}
          </span>
        )}
      </div>
      {onToggle && (
        <ChevronRight
          className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", !collapsed && "rotate-90")}
          aria-hidden="true"
        />
      )}
    </>
  );

  const className = cn(
    "flex w-full items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-left",
    onToggle && "cursor-pointer transition hover:bg-slate-100/70",
  );

  if (!onToggle) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={className}
    >
      {content}
    </button>
  );
}
