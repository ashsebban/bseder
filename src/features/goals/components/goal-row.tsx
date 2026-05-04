"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { TriColorProgressBar } from "@/features/goals/components/tri-color-progress-bar";
import { KillStreakModal } from "@/components/ui/modal";
import { DailyBacklogBadge } from "@/features/planner/components/daily-backlog-badge";
import { GoalOriginPill } from "@/features/goals/components/goal-origin-pill";
import type { DailyBacklogEntry } from "@/features/goals/lib/daily-backlog";
import { todayIso } from "@/lib/date";
import { buildGoalDetailText, computeCurrentStreak } from "@/features/goals/lib/goal-progress";
import { getGoalOccurrenceDateForPlannerDate } from "@/features/calendar/lib/goal-day";
import type { Goal } from "@/features/goals/types/goal";
import type { RollupProgress } from "@/features/goals/lib/goal-progress";

interface GoalRowProps {
  goal: Goal;
  showMenu?: boolean;
  rollupProgress?: RollupProgress;
  detailOverride?: string;
  onDelete?: () => void;
  onEdit?: () => void;
  onUpdateProgress?: (newValue: number) => void;
  onToggleDate?: (isoDate: string) => void;
  dailyBacklogEntries?: DailyBacklogEntry[];
  onResolveBacklogDate?: (isoDate: string) => void;
  detailReferenceDate?: Date;
  onKillStreakAction?: (action: "forgive" | "backlog" | "track-failure" | "kill-streak" | "start-again" | "false-accusation") => void;
  doneLabel?: string;
  notDoneLabel?: string;
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
  dailyBacklogEntries = [],
  onResolveBacklogDate,
  detailReferenceDate,
  onKillStreakAction,
  doneLabel,
  notDoneLabel,
}: GoalRowProps) {
  const [updatingProgress, setUpdatingProgress] = useState(false);
  const [inputValue, setInputValue] = useState(String(goal.current ?? 0));
  const [killStreakOpen, setKillStreakOpen] = useState(false);

  const todayIsoStr = getGoalOccurrenceDateForPlannerDate(goal, todayIso(), { now: new Date() });
  const isBinaryGoal = goal.type === "binary";
  const isDone = isBinaryGoal && (rollupProgress
    ? rollupProgress.done >= 1
    : (goal.completedDates?.includes(todayIsoStr) ?? false));

  const isDirectQuantified = !isBinaryGoal && !!onUpdateProgress;
  const detail = detailOverride ?? (() => {
    if (isDirectQuantified) return null;
    if (isBinaryGoal && goal.cadence !== "daily" && rollupProgress?.total) {
      return `Ongoing • ${rollupProgress.done >= 1 ? "done" : "not done"}`;
    }
    return buildGoalDetailText(goal, detailReferenceDate);
  })();
  const refDate = detailReferenceDate ?? new Date();
  const streak = isBinaryGoal && goal.cadence === "daily" ? computeCurrentStreak(goal, refDate) : 0;
  const unit = goal.targetUnit ? ` ${goal.targetUnit}` : "";

  // Quantified rollups already arrive in display units, so GoalRow should render
  // rollup values as-is. Direct editable sections still use raw current/target
  // because the inline Add control writes to goal.current.
  const useRollupNumbers = !isBinaryGoal && !!rollupProgress && rollupProgress.total > 0 &&
    !isDirectQuantified;

  const numericLabel = (() => {
    if (isBinaryGoal) return null;
    if (useRollupNumbers && rollupProgress) {
      return `${rollupProgress.done}/${rollupProgress.total}${unit}`;
    }
    if (goal.current === undefined && goal.target === undefined) return null;
    const cur = goal.current ?? 0;
    if (goal.target !== undefined) return `${cur}/${goal.target}${unit}`;
    return `${cur}${unit}`;
  })();
  const binaryRollupLabel = isBinaryGoal && rollupProgress && rollupProgress.total > 0
    ? `${rollupProgress.done}/${rollupProgress.total}`
    : null;

  function handleUpdateConfirm() {
    const newVal = Number(inputValue);
    if (isNaN(newVal)) return;
    if (goal.ifUnfinished === "kill-streak" && rollupProgress && newVal < rollupProgress.elapsed) {
      setKillStreakOpen(true);
      return;
    }
    onUpdateProgress?.(newVal);
    setUpdatingProgress(false);
  }

  function handleKillStreakAction(action: "forgive" | "backlog" | "track-failure" | "kill-streak" | "start-again" | "false-accusation") {
    setKillStreakOpen(false);
    setUpdatingProgress(false);
    onKillStreakAction?.(action);
  }

  const progressBar = (() => {
    if (!isBinaryGoal) {
      if (useRollupNumbers && rollupProgress) {
        return (
          <TriColorProgressBar
            done={rollupProgress.done}
            missed={0}
            total={rollupProgress.total}
            className="w-full"
          />
        );
      }
      if (goal.target !== undefined) {
        const cur = goal.current ?? 0;
        return (
          <TriColorProgressBar
            done={Math.min(cur, goal.target)}
            missed={0}
            total={goal.target}
            className="w-full"
          />
        );
      }
      return null;
    }
    if (!rollupProgress) return null;
    return (
      <TriColorProgressBar
        done={rollupProgress.done}
        missed={rollupProgress.missed}
        total={rollupProgress.total}
        className="w-full"
      />
    );
  })();

  return (
    <div className="group py-2.5">
      <div className="flex items-center gap-3">
        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold text-text">{goal.title}</span>
            {streak >= 1 ? (
              <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-600">
                🔥 {streak}
              </span>
            ) : null}
            <GoalOriginPill goal={goal} />
            <DailyBacklogBadge
              goalTitle={goal.title}
              entries={dailyBacklogEntries}
              onResolveDate={onResolveBacklogDate}
            />
          </div>
          {detail ? (
            <p className="mt-0.5 truncate text-xs text-text-muted">{detail}</p>
          ) : null}
        </div>

        {/* Right side */}
        <div className="grid shrink-0 grid-cols-[7rem_5.75rem_6.5rem_3.25rem] items-center gap-3 md:grid-cols-[10rem_7rem_7rem_3.5rem]">
          <div className="min-w-0">{progressBar}</div>

          {updatingProgress ? (
            <div className="col-span-2 flex min-w-0 justify-end">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={goal.target !== undefined ? goal.target + (goal.backlog ?? 0) : undefined}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdateConfirm();
                    if (e.key === "Escape") setUpdatingProgress(false);
                  }}
                  className="w-20 rounded-lg border border-line bg-white px-2 py-1 text-sm font-medium text-text focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/15"
                  autoFocus
                />
                {goal.targetUnit ? (
                  <span className="text-sm font-medium text-text-muted">{goal.targetUnit}</span>
                ) : null}
                <button
                  type="button"
                  onClick={handleUpdateConfirm}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white transition hover:bg-brand/90"
                  aria-label="Confirm"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setUpdatingProgress(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-surface text-text-muted transition hover:bg-surface-muted"
                  aria-label="Cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="min-w-0 text-right">
                {binaryRollupLabel ? (
                  <span className="text-sm font-semibold tabular-nums text-text-muted">{binaryRollupLabel}</span>
                ) : numericLabel ? (
                  <span className="text-sm font-semibold tabular-nums text-text-muted">{numericLabel}</span>
                ) : null}
              </div>

              <div className="flex min-w-0 justify-start">
            {/* Binary: labeled pill button */}
            {isBinaryGoal && onToggleDate ? (
              <button
                type="button"
                onClick={() => onToggleDate(todayIsoStr)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-150 ${
                  isDone
                    ? "border-success/40 bg-success/10 text-success hover:bg-success/20"
                    : "border-line bg-white text-text-muted hover:border-brand/40 hover:text-brand"
                }`}
              >
                {isDone ? (
                  <>
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                    {doneLabel ?? "Done"}
                  </>
                ) : (
                  notDoneLabel ?? "Mark done"
                )}
              </button>
            ) : onUpdateProgress ? (
              /* Quantified: add-progress button */
              <button
                type="button"
                onClick={() => { setInputValue(String(goal.current ?? 0)); setUpdatingProgress(true); }}
                className="flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold text-text-muted transition hover:border-brand/40 hover:text-brand"
                title="Update progress"
              >
                <Plus className="h-3 w-3" />
                Update
              </button>
            ) : null}
              </div>
            </>
          )}

          {/* Hover-reveal edit + delete */}
          <div className="flex items-center justify-end gap-0.5">
            {showMenu && !updatingProgress ? (
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                {onEdit ? (
                  <button
                    type="button"
                    onClick={onEdit}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-text-subtle transition hover:bg-surface-muted hover:text-text"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {onDelete ? (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-text-subtle transition hover:bg-red-50 hover:text-red-500"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Backlog chip */}
      {goal.backlog && goal.backlog > 0 && goal.type !== "binary" ? (
        <div className="mt-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            Backlog: {goal.backlog} {goal.targetUnit ?? "units"}
          </span>
        </div>
      ) : null}

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
