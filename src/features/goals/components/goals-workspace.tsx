"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { GoalRow } from "@/features/goals/components/goal-row";
import { NewGoalForm } from "@/features/goals/components/new-goal-form";
import {
  computeRollupProgress,
  computeCrossperiodProgress,
  getPeriodBoundsForCadence,
} from "@/features/goals/lib/goal-progress";
import { startOfDay } from "@/lib/date";
import { saveGoals, loadGoals } from "@/features/goals/lib/goal-store";
import { loadDayAssignments, type DayAssignment } from "@/features/planner/lib/day-assignment-store";
import { toggleGoalDate } from "@/features/goals/lib/goal-mutations";
import type { Goal, GoalCadence } from "@/features/goals/types/goal";
import type { RollupProgress } from "@/features/goals/lib/goal-progress";

const CADENCE_OPTIONS: { label: string; value: GoalCadence }[] = [
  { label: "One-time", value: "one-time" },
  { label: "Yearly", value: "yearly" },
  { label: "Monthly", value: "monthly" },
  { label: "Weekly", value: "weekly" },
  { label: "Daily", value: "daily" },
];

const CADENCE_LABELS: Record<GoalCadence, string> = {
  "one-time": "One-time",
  yearly: "Yearly",
  monthly: "Monthly",
  weekly: "Weekly",
  daily: "Daily",
};

const CADENCE_SHORT: Record<GoalCadence, string> = {
  "one-time": "once",
  yearly: "year",
  monthly: "month",
  weekly: "week",
  daily: "day",
};

/** Which cadences roll up into which views */
const ROLLUP_SECTIONS: Partial<Record<GoalCadence, GoalCadence[]>> = {
  monthly: ["weekly", "daily"],
  weekly: ["daily"],
  yearly: ["monthly", "weekly", "daily"],
};


export function GoalsWorkspace() {
  const [activeFilter, setActiveFilter] = useState<GoalCadence>("monthly");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dayAssignments, setDayAssignments] = useState<DayAssignment[]>([]);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCadence, setDrawerCadence] = useState<GoalCadence>(activeFilter);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Load from localStorage after mount
  useEffect(() => {
    setGoals(loadGoals());
    setDayAssignments(loadDayAssignments());
    setStorageLoaded(true);
  }, []);

  // Persist goals whenever they change (after initial load)
  useEffect(() => {
    if (storageLoaded) saveGoals(goals);
  }, [goals, storageLoaded]);

const today = startOfDay(new Date());

  const directGoals = goals.filter((g) => g.cadence === activeFilter);
  const rollupCadences = ROLLUP_SECTIONS[activeFilter] ?? [];

  const newGoalLabel = `New ${CADENCE_LABELS[activeFilter]} Goal`;
  const drawerTitle = editingGoal
    ? `Edit ${CADENCE_LABELS[editingGoal.cadence]} Goal`
    : `New ${CADENCE_LABELS[drawerCadence]} Goal`;

  function openDrawer() {
    setDrawerCadence(activeFilter);
    setEditingGoal(null);
    setDrawerOpen(true);
  }

  function handleSave(goal: Goal) {
    setGoals((prev) => {
      const idx = prev.findIndex((g) => g.id === goal.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = goal;
        return updated;
      }
      return [...prev, goal];
    });
  }

  function handleDelete(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  function handleEdit(goal: Goal) {
    setEditingGoal(goal);
    setDrawerCadence(goal.cadence);
    setDrawerOpen(true);
  }

  function handleUpdateProgress(id: string, newValue: number) {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, current: newValue } : g)),
    );
  }

  function handleToggleDate(id: string, isoDate: string) {
    setGoals((prev) => toggleGoalDate(prev, id, isoDate));
  }

  function handleKillStreakAction(
    goal: Goal,
    action: "forgive" | "backlog" | "track-failure" | "kill-streak" | "start-again" | "false-accusation",
  ) {
    const { start, end } = getPeriodBoundsForCadence(activeFilter);
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goal.id) return g;
        switch (action) {
          case "forgive":
            return { ...g, ifUnfinished: "forgive" as const };
          case "backlog": {
            const rollup = computeRollupProgress(g, start, end, today, dayAssignments);
            const missed = Math.max(0, rollup.elapsed - (g.current ?? 0));
            return { ...g, ifUnfinished: "backlog" as const, backlog: (g.backlog ?? 0) + missed };
          }
          case "track-failure":
            return { ...g, ifUnfinished: "track-failure" as const };
          case "kill-streak":
            return { ...g, current: 0, status: "paused" as const };
          case "start-again":
            return { ...g, current: 0 };
          case "false-accusation":
            return { ...g, current: (g.current ?? 0) + 1 };
          default:
            return g;
        }
      }),
    );
  }

  function getRollupProgress(goal: Goal, viewCadence: GoalCadence): RollupProgress {
    return computeCrossperiodProgress(goal, viewCadence, today, dayAssignments);
  }

  return (
    <>
      <Card className="p-5 md:p-6">
        {/* Card header row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2 className="text-xl font-bold tracking-tight text-text">Goals by timeframe</h2>
          <div className="flex items-center gap-2">
<Button variant="primary" size="sm" onClick={openDrawer}>
              {newGoalLabel}
            </Button>
          </div>
        </div>

        {/* Timeframe filter pills */}
        <div className="mt-4 flex flex-wrap gap-2">
          {CADENCE_OPTIONS.map((option) => {
            const active = option.value === activeFilter;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setActiveFilter(option.value)}
                className={
                  active
                    ? "rounded-full border border-brand/40 bg-brand-soft px-4 py-1.5 text-sm font-semibold text-brand"
                    : "rounded-full border border-line px-4 py-1.5 text-sm font-semibold text-text-muted transition hover:border-brand/30 hover:text-text"
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {/* Direct goals */}
        <div className="mt-5">
          {directGoals.length > 0 ? (
            <>
              <h3 className="mb-1 text-base font-semibold text-text">
                {CADENCE_LABELS[activeFilter]} goals
              </h3>
              <div className="divide-y divide-line/40">
                {directGoals.map((goal) => (
                  <GoalRow
                    key={goal.id}
                    goal={goal}
                    showMenu
                    rollupProgress={getRollupProgress(goal, activeFilter)}
                    onDelete={() => handleDelete(goal.id)}
                    onEdit={() => handleEdit(goal)}
                    onUpdateProgress={(v) => handleUpdateProgress(goal.id, v)}
                    onToggleDate={(date) => handleToggleDate(goal.id, date)}
                    onKillStreakAction={(action) => handleKillStreakAction(goal, action)}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-text-subtle">
              No {CADENCE_LABELS[activeFilter].toLowerCase()} goals yet.
            </p>
          )}
        </div>

        {/* Roll-up sections (computed from lower-cadence goals) */}
        {rollupCadences.map((cadence) => {
          const rollupGoals = goals.filter((g) => g.cadence === cadence);
          if (rollupGoals.length === 0) return null;
          return (
            <div
              key={cadence}
              className="mt-4 rounded-2xl border border-line/50 bg-surface-muted/40 p-4"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-brand">
                From {CADENCE_LABELS[cadence]} Goals
              </p>
              <div className="divide-y divide-line/30">
                {rollupGoals.map((goal) => (
                  <GoalRow
                    key={goal.id}
                    goal={goal}
                    showMenu={false}
                    rollupProgress={getRollupProgress(goal, activeFilter)}
                    detailOverride={
                      goal.cadence !== "daily" && goal.type === "quantified" && goal.target
                        ? `${goal.target}${goal.targetUnit ? ` ${goal.targetUnit}` : ""}/${CADENCE_SHORT[goal.cadence]}`
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}
      </Card>

      {/* New / edit goal drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={drawerTitle}>
        <NewGoalForm
          key={editingGoal?.id ?? "new"}
          defaultCadence={drawerCadence}
          existingGoal={editingGoal ?? undefined}
          onSave={handleSave}
          onClose={() => setDrawerOpen(false)}
        />
      </Drawer>
    </>
  );
}
