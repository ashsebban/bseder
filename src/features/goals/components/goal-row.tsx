"use client";

import { useState } from "react";
import { MoreHorizontal, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoalProgressBar } from "@/features/goals/components/goal-progress-bar";
import { TriColorProgressBar } from "@/features/goals/components/tri-color-progress-bar";
import { KillStreakModal } from "@/components/ui/modal";
import { todayIso } from "@/lib/date";
import {
  buildGoalDetailText,
  computeSimpleProgressPercent,
} from "@/features/goals/lib/goal-progress";
import type { Goal } from "@/features/goals/types/goal";
import type { RollupProgress } from "@/features/goals/lib/goal-progress";

interface GoalRowProps {
  goal: Goal;
  showMenu?: boolean;
  /** Pre-computed roll-up data. When provided, uses TriColorProgressBar. */
  rollupProgress?: RollupProgress;
  /** Override the auto-generated detail text (used in rollup sections). */
  detailOverride?: string;
  onDelete?: () => void;
  onEdit?: () => void;
  onUpdateProgress?: (newValue: number) => void;
  /** Toggle today's date in/out of completedDates — for binary daily !allowCatchup goals */
  onToggleDate?: (isoDate: string) => void;
  onKillStreakAction?: (action: "forgive" | "backlog" | "track-failure" | "kill-streak" | "start-again" | "false-accusation") => void;
}

export function GoalRow({
  goal,
  showMenu = false,
  rollupProgress,
  detailOverride,
  onDelete,
  onEdit,
  onUpdateProgress,
  onToggleDate,
  onKillStreakAction,
}: GoalRowProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [updatingProgress, setUpdatingProgress] = useState(false);
  const [inputValue, setInputValue] = useState(String(goal.current ?? 0));
  const [killStreakOpen, setKillStreakOpen] = useState(false);

  const todayIsoStr = todayIso(); // local time — no UTC shift
  const isBinaryToggle = goal.cadence === "daily" && goal.type === "binary";
  const isDoneToday = isBinaryToggle && (goal.completedDates?.includes(todayIsoStr) ?? false);

  const detail = detailOverride ?? buildGoalDetailText(goal);

  function handleUpdateConfirm() {
    const newVal = Number(inputValue);
    if (isNaN(newVal)) return;

    // Kill streak check: if missed days would occur
    if (
      goal.ifUnfinished === "kill-streak" &&
      rollupProgress &&
      newVal < rollupProgress.elapsed
    ) {
      setKillStreakOpen(true);
      return;
    }

    onUpdateProgress?.(newVal);
    setUpdatingProgress(false);
    setActionsOpen(false);
  }

  function handleKillStreakAction(action: "forgive" | "backlog" | "track-failure" | "kill-streak" | "start-again" | "false-accusation") {
    setKillStreakOpen(false);
    setUpdatingProgress(false);
    setActionsOpen(false);
    onKillStreakAction?.(action);
  }

  return (
    <div className="py-3">
      {/* Main row */}
      <div className="flex items-center gap-4">
        {/* Left: title + detail */}
        <div className="min-w-0 flex-1">
          <span className="font-semibold text-text">{goal.title}</span>
          {detail ? (
            <span className="ml-2 text-sm text-text-muted">{detail}</span>
          ) : null}
        </div>

        {/* Right: progress bar + percentage + optional menu */}
        <div className="flex shrink-0 items-center gap-3">
          {rollupProgress ? (
            <TriColorProgressBar
              done={rollupProgress.done}
              missed={rollupProgress.missed}
              total={rollupProgress.total}
              className="w-40 md:w-56"
            />
          ) : (
            <GoalProgressBar value={computeSimpleProgressPercent(goal)} className="w-40 md:w-56" />
          )}
          <span className="min-w-[2.8rem] text-right text-sm font-semibold tabular-nums text-text-muted">
            {rollupProgress
              ? rollupProgress.total > 0
                ? `${rollupProgress.done}/${rollupProgress.total}`
                : "–"
              : `${computeSimpleProgressPercent(goal)}%`}
          </span>
          {showMenu ? (
            <Button
              variant="ghost"
              size="sm"
              className="px-1.5 text-text-subtle"
              onClick={() => {
                setActionsOpen((o) => !o);
                setUpdatingProgress(false);
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Backlog chip */}
      {goal.backlog && goal.backlog > 0 ? (
        <div className="mt-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            Backlog: {goal.backlog} {goal.targetUnit ?? "units"}
          </span>
        </div>
      ) : null}

      {/* Action bar */}
      {actionsOpen && !updatingProgress ? (
        <div className="mt-2 flex items-center gap-2">
          {onEdit ? (
            <button
              type="button"
              onClick={() => { onEdit(); setActionsOpen(false); }}
              className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-text transition hover:bg-surface-muted"
            >
              Edit
            </button>
          ) : null}
          {isBinaryToggle && onToggleDate ? (
            <button
              type="button"
              onClick={() => { onToggleDate(todayIsoStr); setActionsOpen(false); }}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${isDoneToday ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100" : "border-brand/30 bg-brand-soft/60 text-brand hover:bg-brand-soft"}`}
            >
              {isDoneToday ? "Undo today" : "Mark done today"}
            </button>
          ) : !isBinaryToggle && onUpdateProgress && !rollupProgress ? (
            <button
              type="button"
              onClick={() => {
                setInputValue(String(goal.current ?? 0));
                setUpdatingProgress(true);
              }}
              className="rounded-xl border border-brand/30 bg-brand-soft/60 px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand-soft"
            >
              Update Progress
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={() => { onDelete(); setActionsOpen(false); }}
              className="ml-auto rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Update progress input */}
      {updatingProgress ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs font-semibold text-text-muted">Current:</span>
          <input
            type="number"
            min={0}
            max={goal.noGettingAhead && goal.target !== undefined ? goal.target + (goal.backlog ?? 0) : undefined}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-20 rounded-xl border border-line bg-white px-3 py-1.5 text-sm font-medium text-text shadow-soft focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/15"
            autoFocus
          />
          {goal.targetUnit ? (
            <span className="text-xs text-text-muted">{goal.targetUnit}</span>
          ) : null}
          <button
            type="button"
            onClick={handleUpdateConfirm}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand/90"
            aria-label="Confirm"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setUpdatingProgress(false); setActionsOpen(false); }}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-surface text-text-muted transition hover:bg-surface-muted"
            aria-label="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {/* Kill Streak confirmation modal */}
      <KillStreakModal
        open={killStreakOpen}
        goalTitle={goal.title}
        onForgive={() => handleKillStreakAction("forgive")}
        onBacklog={() => handleKillStreakAction("backlog")}
        onTrackFailure={() => handleKillStreakAction("track-failure")}
        onKillStreak={() => handleKillStreakAction("kill-streak")}
        onStartAgain={() => handleKillStreakAction("start-again")}
        onFalseAccusation={() => handleKillStreakAction("false-accusation")}
      />
    </div>
  );
}
