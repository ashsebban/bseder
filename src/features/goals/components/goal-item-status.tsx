"use client";

import { cn } from "@/lib/cn";
import type { GoalTimeState } from "@/features/calendar/lib/goal-time-window";

export type GoalItemStatus =
  | "available"
  | "not-yet"
  | "due-soon"
  | "missed"
  | "completed"
  | "completed-late"
  | "backlog"
  | "behind-pace";

const STATUS_LABELS: Record<Exclude<GoalItemStatus, "available" | "completed">, string> = {
  "not-yet": "Not yet",
  "due-soon": "Due soon",
  missed: "Missed",
  "completed-late": "Late",
  backlog: "Owed",
  "behind-pace": "Behind",
};

export function getGoalItemStatus({
  completed,
  completedAfterWindow,
  timeState,
  countdownUrgent,
  isPast,
}: {
  completed: boolean;
  completedAfterWindow?: boolean;
  timeState: GoalTimeState;
  countdownUrgent?: boolean;
  isPast?: boolean;
}): GoalItemStatus {
  if (completed) return completedAfterWindow ? "completed-late" : "completed";
  if (isPast) return "missed";
  if (timeState === "expired") return "missed";
  if (timeState === "not-yet") return "not-yet";
  if (countdownUrgent) return "due-soon";
  return "available";
}

export function goalStatusRowClass(status: GoalItemStatus): string {
  if (status === "missed") return "border border-rose-100/70 bg-rose-50/20 hover:bg-rose-50/35";
  if (status === "due-soon") return "border border-amber-100/80 bg-amber-50/25 hover:bg-amber-50/45";
  if (status === "not-yet") return "opacity-50 hover:opacity-70";
  if (status === "completed-late") return "bg-emerald-50/20 hover:bg-emerald-50/35";
  if (status === "completed") return "bg-emerald-50/30 hover:bg-emerald-50/50";
  if (status === "backlog") return "border border-indigo-100/80 bg-indigo-50/30 hover:bg-indigo-50/50";
  if (status === "behind-pace") return "border border-amber-100/70 bg-amber-50/20 hover:bg-amber-50/35";
  return "hover:bg-slate-50";
}

export function goalStatusTitleClass(status: GoalItemStatus): string {
  if (status === "completed" || status === "completed-late") {
    return "text-slate-400 line-through decoration-slate-300";
  }
  if (status === "missed") return "text-slate-700";
  if (status === "not-yet") return "text-slate-500";
  return "text-slate-800";
}

export function goalStatusSubtitleClass(status: GoalItemStatus): string {
  if (status === "missed") return "text-rose-400";
  if (status === "due-soon" || status === "behind-pace") return "text-amber-500";
  if (status === "completed-late") return "text-slate-400";
  if (status === "backlog") return "text-indigo-500";
  return "text-slate-400";
}

export function goalStatusCheckboxClass(status: GoalItemStatus, checked: boolean): string | undefined {
  if (checked) return undefined;
  if (status === "missed") return "border-rose-200 bg-rose-50/50 hover:border-rose-300";
  if (status === "due-soon") return "border-amber-200 bg-amber-50/50 hover:border-amber-300";
  if (status === "not-yet") return "border-slate-200/70 bg-transparent";
  return undefined;
}

export function GoalStatusPill({
  status,
  label,
  className,
}: {
  status: GoalItemStatus;
  label?: string;
  className?: string;
}) {
  if (status === "available" || status === "completed") return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-[2px] text-[9.5px] font-semibold tracking-wide",
        status === "missed" && "bg-rose-50 text-rose-500",
        (status === "due-soon" || status === "behind-pace") && "bg-amber-50 text-amber-500",
        status === "completed-late" && "bg-slate-100/80 text-slate-400",
        status === "not-yet" && "bg-slate-50 text-slate-400",
        status === "backlog" && "bg-indigo-50 text-indigo-500",
        className,
      )}
    >
      {label ?? STATUS_LABELS[status]}
    </span>
  );
}
