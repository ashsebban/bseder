import { cn } from "@/lib/cn";
import { isCustomizedPrebuilt, isPrebuiltGoal } from "@/features/goals/lib/prebuilt-goals";
import type { Goal } from "@/features/goals/types/goal";

type GoalOriginTone = "preset" | "edited" | "custom" | "task";

const TONE_CLASSES: Record<GoalOriginTone, string> = {
  preset: "bg-brand-soft text-brand",
  edited: "bg-amber-100 text-amber-700",
  custom: "bg-surface-muted text-text-muted",
  task: "bg-slate-100 text-slate-600",
};

export function getGoalOriginLabel(goal: Goal): { label: string; tone: GoalOriginTone } {
  if (goal.adhoc) return { label: "Task", tone: "task" };
  if (isPrebuiltGoal(goal.id)) {
    return isCustomizedPrebuilt(goal)
      ? { label: "Modified", tone: "edited" }
      : { label: "Preset", tone: "preset" };
  }
  return { label: "Custom", tone: "custom" };
}

export function GoalOriginPill({
  goal,
  className,
}: {
  goal: Goal;
  className?: string;
}) {
  const origin = getGoalOriginLabel(goal);

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        TONE_CLASSES[origin.tone],
        className,
      )}
    >
      {origin.label}
    </span>
  );
}
