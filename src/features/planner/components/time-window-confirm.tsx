"use client";

import { PlannerModalCard } from "@/features/planner/components/planner-modal-card";
import type { GoalTimeCaveat } from "@/features/calendar/lib/goal-time-window";
import type { Goal } from "@/features/goals/types/goal";

/**
 * Confirmation modal shown whenever a user marks a goal complete outside
 * its time window (too early = "not yet", or too late = "expired").
 * Single source of truth — used by DayFocus, TodaysFocusWidget, etc.
 */
export function TimeWindowConfirm({
  goal,
  timeState,
  caveat,
  onConfirm,
  onCancel,
}: {
  goal: Goal;
  timeState: "not-yet" | "expired";
  caveat?: GoalTimeCaveat;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isEarly = timeState === "not-yet";
  const isCaveat = isEarly && caveat?.kind === "repeat-night-shema";

  return (
    <PlannerModalCard
      title={isCaveat ? "Early Ma'ariv" : isEarly ? "Too early" : "Missed window"}
      subtitle={<span className="font-semibold">{goal.title}</span>}
      onClose={onCancel}
      widthClassName="w-80"
      actions={[
        { label: "Cancel", onClick: onCancel, variant: "secondary" },
        { label: isCaveat ? "Mark Ma'ariv done" : "Mark done anyway", onClick: onConfirm, variant: "primary" },
      ]}
    >
      <p className="mt-3 text-[13px] leading-5 text-slate-500">
        {isCaveat
          ? `${caveat.description} ${caveat.title} will be added for later.`
          : isEarly
          ? "This goal's time window hasn't started yet. Mark it done anyway?"
          : "This goal's time window has passed. Mark it done anyway?"}
      </p>
    </PlannerModalCard>
  );
}
