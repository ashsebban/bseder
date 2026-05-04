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
}: {
  completed: boolean;
  completedAfterWindow?: boolean;
  timeState: GoalTimeState;
  countdownUrgent?: boolean;
}): GoalItemStatus {
  if (completed) return completedAfterWindow ? "completed-late" : "completed";
  if (timeState === "expired") return "missed";
  if (timeState === "not-yet") return "not-yet";
  if (countdownUrgent) return "due-soon";
  return "available";
}

export function goalStatusRowClass(status: GoalItemStatus): string {
  if (status === "missed") return "border border-red-100/80 bg-red-50/25 hover:bg-red-50/45";
  if (status === "due-soon") return "border border-amber-100 bg-amber-50/35 hover:bg-amber-50/55";
  if (status === "not-yet") return "opacity-55 hover:bg-slate-50";
  if (status === "completed-late") return "border border-amber-100 bg-amber-50/25";
  if (status === "completed") return "bg-emerald-50/35 hover:bg-emerald-50/55";
  if (status === "backlog") return "border border-blue-100 bg-blue-50/45 hover:bg-blue-50/65";
  if (status === "behind-pace") return "border border-amber-100 bg-slate-50/80 hover:bg-amber-50/35";
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
  if (status === "missed") return "font-semibold text-red-500";
  if (status === "due-soon" || status === "completed-late" || status === "behind-pace") {
    return "font-semibold text-amber-500";
  }
  if (status === "backlog") return "font-semibold text-blue-600";
  return "text-slate-400";
}

export function goalStatusCheckboxClass(status: GoalItemStatus, checked: boolean): string | undefined {
  if (checked) return undefined;
  if (status === "missed") return "border-red-200 bg-red-50 hover:border-red-300";
  if (status === "due-soon") return "border-amber-200 bg-amber-50 hover:border-amber-300";
  if (status === "not-yet") return "border-slate-200 bg-slate-50";
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
        "shrink-0 rounded-full px-2 py-[2px] text-[9.5px] font-bold",
        status === "missed" && "bg-red-50 text-red-600",
        (status === "due-soon" || status === "completed-late" || status === "behind-pace") && "bg-amber-50 text-amber-700",
        status === "not-yet" && "bg-slate-100 text-slate-500",
        status === "backlog" && "bg-blue-50 text-blue-700",
        className,
      )}
    >
      {label ?? STATUS_LABELS[status]}
    </span>
  );
}
