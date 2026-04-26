"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { TriColorProgressBar } from "@/features/goals/components/tri-color-progress-bar";
import { KillStreakModal } from "@/components/ui/modal";
import { DailyBacklogBadge } from "@/components/planner/daily-backlog-badge";
import type { DailyBacklogEntry } from "@/features/goals/lib/daily-backlog";
import { todayIso } from "@/lib/date";
import { buildGoalDetailText, computeCurrentStreak } from "@/features/goals/lib/goal-progress";
import { isPrebuiltGoal, isCustomizedPrebuilt } from "@/features/goals/lib/prebuilt-goals";
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
}: GoalRowProps) {
  const [updatingProgress, setUpdatingProgress] = useState(false);
  const [inputValue, setInputValue] = useState(String(goal.current ?? 0));
  const [killStreakOpen, setKillStreakOpen] = useState(false);

  const todayIsoStr = todayIso();
  const isBinaryGoal = goal.type === "binary";
  const isDone = isBinaryGoal && (rollupProgress
    ? rollupProgress.done >= 1
    : (goal.completedDates?.includes(todayIsoStr) ?? false));

  const detail = detailOverride ?? buildGoalDetailText(goal, detailReferenceDate);
  const refDate = detailReferenceDate ?? new Date();
  const streak = isBinaryGoal && goal.cadence === "daily" ? computeCurrentStreak(goal, refDate) : 0;
  const prebuilt = isPrebuiltGoal(goal.id);
  const customized = prebuilt && isCustomizedPrebuilt(goal);

  const unit = goal.targetUnit ? ` ${goal.targetUnit}` : "";

  // Quantified rollups already arrive in display units (including daily quantified
  // weekly/monthly/yearly rollups), so GoalRow should render rollup values as-is.
  // Daily quantified in direct section (onUpdateProgress present): still raw current/target.
  const isDirectSection = !!onUpdateProgress;
  const useRollupNumbers = !isBinaryGoal && !!rollupProgress && rollupProgress.total > 0 &&
    (goal.cadence !== "daily" || !isDirectSection);

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
            {prebuilt ? (
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${customized ? "bg-amber-100 text-amber-700" : "bg-brand-soft text-brand"}`}>
                {customized ? "Custom" : "Official"}
              </span>
            ) : null}
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
        <div className="flex shrink-0 items-center gap-2">
          {(() => {
            if (!isBinaryGoal) {
              if (useRollupNumbers && rollupProgress) {
                return (
                  <TriColorProgressBar
                    done={rollupProgress.done}
                    missed={0}
                    total={rollupProgress.total}
                    className="w-28 md:w-40"
                  />
                );
              }
              if (goal.target !== undefined) {
                // Daily quantified in direct section: bar = raw current/target
                const cur = goal.current ?? 0;
                return (
                  <TriColorProgressBar
                    done={Math.min(cur, goal.target)}
                    missed={0}
                    total={goal.target}
                    className="w-28 md:w-40"
                  />
                );
              }
              return null;
            }
            // Binary goals: bar uses rollup occurrence counts
            if (rollupProgress) {
              return (
                <TriColorProgressBar
                  done={rollupProgress.done}
                  missed={rollupProgress.missed}
                  total={rollupProgress.total}
                  className="w-28 md:w-40"
                />
              );
            }
            return null;
          })()}

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
                  Done
                </>
              ) : (
                "Mark done"
              )}
            </button>
          ) : isBinaryGoal ? (
            /* Binary in rollup — just show done indicator */
            rollupProgress && rollupProgress.total > 0 ? (
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${rollupProgress.done >= 1 ? "bg-success/10 text-success" : "bg-surface-muted text-text-subtle"}`}>
                {rollupProgress.done >= 1 ? <Check className="h-3 w-3" strokeWidth={2.5} /> : null}
                {`${rollupProgress.done}/${rollupProgress.total}`}
              </span>
            ) : null
          ) : updatingProgress ? (
            /* Quantified inline input */
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
                className="w-16 rounded-lg border border-line bg-white px-2 py-1 text-sm font-medium text-text focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/15"
                autoFocus
              />
              {goal.targetUnit ? (
                <span className="text-xs text-text-muted">{goal.targetUnit}</span>
              ) : null}
              <button
                type="button"
                onClick={handleUpdateConfirm}
                className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand text-white transition hover:bg-brand/90"
                aria-label="Confirm"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setUpdatingProgress(false)}
                className="flex h-6 w-6 items-center justify-center rounded-lg border border-line bg-surface text-text-muted transition hover:bg-surface-muted"
                aria-label="Cancel"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : onUpdateProgress ? (
            /* Quantified: numeric label + add-progress button */
            <div className="flex items-center gap-1.5">
              {numericLabel ? (
                <span className="text-sm font-semibold tabular-nums text-text-muted">{numericLabel}</span>
              ) : null}
              <button
                type="button"
                onClick={() => { setInputValue(String(goal.current ?? 0)); setUpdatingProgress(true); }}
                className="flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold text-text-muted transition hover:border-brand/40 hover:text-brand"
                title="Add progress"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>
          ) : (
            /* Quantified rollup — static numeric label */
            numericLabel ? (
              <span className="text-sm font-semibold tabular-nums text-text-muted">{numericLabel}</span>
            ) : null
          )}

          {/* Hover-reveal edit + delete */}
          {showMenu ? (
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
