"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { GoalRow } from "@/features/goals/components/goal-row";
import { NewGoalForm } from "@/features/goals/components/new-goal-form";
import { ProjectGoalCard } from "@/features/goals/components/project-goal-card";
import type { Milestone } from "@/features/goals/types/goal";
import {
  computeRollupProgress,
  computeCrossperiodProgress,
  buildExcludedDates,
  getPeriodBoundsForCadence,
} from "@/features/goals/lib/goal-progress";
import { endOfWeek, parseIsoDate, startOfDay, startOfWeek, toIsoDate } from "@/lib/date";
import {
  GOALS_STORAGE_UPDATED_EVENT,
  loadGoals,
  saveGoals,
  type GoalsStorageUpdatedDetail,
} from "@/features/goals/lib/goal-store";
import {
  DAY_ASSIGNMENTS_STORAGE_UPDATED_EVENT,
  loadDayAssignments,
  saveDayAssignments,
  getPersistableDayAssignments,
  type DayAssignmentsStorageUpdatedDetail,
  type DayAssignment,
} from "@/features/planner/lib/day-assignment-store";
import { materializePlannerWeekAssignments } from "@/features/planner/lib/materialize-goal-assignments";
import { toggleGoalDate } from "@/features/goals/lib/goal-mutations";
import { getDailyBacklogEntries } from "@/features/goals/lib/daily-backlog";
import type { Goal, GoalCadence } from "@/features/goals/types/goal";
import type { RollupProgress } from "@/features/goals/lib/goal-progress";
import { HDate } from "@hebcal/core";
import { useCalendarPreferences } from "@/features/settings/hooks/use-calendar-preferences";
import { AddGoalsModal } from "@/features/goals/components/add-goals-modal";
import { useGoalsSync } from "@/features/goals/hooks/use-goals-sync";
import { ProjectGoalsView } from "@/features/goals/components/project-goals-view";

type ActiveFilter = GoalCadence | "seasonal";

const CADENCE_OPTIONS: { label: string; value: ActiveFilter }[] = [
  { label: "Projects", value: "one-time" },
  { label: "Seasonal", value: "seasonal" },
  { label: "Yearly", value: "yearly" },
  { label: "Monthly", value: "monthly" },
  { label: "Weekly", value: "weekly" },
  { label: "Daily", value: "daily" },
];

const CADENCE_CONFIG: Record<GoalCadence, { label: string; short: string; rollups: GoalCadence[] }> = {
  "one-time": { label: "Project", short: "once", rollups: [] },
  project: { label: "Project", short: "project", rollups: ["monthly", "weekly", "daily"] },
  seasonal: { label: "Seasonal", short: "season", rollups: ["daily"] },
  yearly: { label: "Yearly", short: "year", rollups: ["monthly", "weekly", "daily"] },
  monthly: { label: "Monthly", short: "month", rollups: ["weekly", "daily"] },
  weekly: { label: "Weekly", short: "week", rollups: ["daily"] },
  daily: { label: "Daily", short: "day", rollups: [] },
};


export function GoalsWorkspace({ storageScope, initialOpenCadence }: { storageScope: string; initialOpenCadence?: string }) {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("daily");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCadence, setDrawerCadence] = useState<GoalCadence>("daily");
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [packsDrawerOpen, setPacksDrawerOpen] = useState(false);
  const [expandedRollups, setExpandedRollups] = useState<Partial<Record<GoalCadence, boolean>>>({});
  const [upcomingExpanded, setUpcomingExpanded] = useState(false);

  const { preferences, updatePreference } = useCalendarPreferences(undefined, storageScope);
  const { goals, setGoals, dayAssignments, setDayAssignments, storageLoaded } = useGoalsSync(storageScope);

  useEffect(() => {
    if (!initialOpenCadence) return;
    const valid = ["daily", "weekly", "monthly", "yearly", "one-time", "seasonal"];
    if (!valid.includes(initialOpenCadence)) return;
    const filter = initialOpenCadence as ActiveFilter;
    setActiveFilter(filter);
    setDrawerCadence(filter === "seasonal" ? "daily" : filter as GoalCadence);
    setEditingGoal(null);
    setDrawerOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const today = startOfDay(new Date());
  const todayIso = toIsoDate(today);

  const seasonalGoals = goals.filter(
    (g) => !!g.endDate && g.endDate >= todayIso && g.status !== "paused" && g.status !== "done",
  );
  const directGoals = activeFilter === "seasonal"
    ? seasonalGoals
    : goals.filter((g) => g.cadence === activeFilter && !g.endDate);
  const rollupCadences = activeFilter === "seasonal" ? [] : CADENCE_CONFIG[activeFilter as GoalCadence].rollups;

  const newGoalLabel = activeFilter === "seasonal" ? "New Seasonal Goal" : `New ${CADENCE_CONFIG[activeFilter as GoalCadence].label} Goal`;
  const drawerTitle = editingGoal
    ? `Edit ${CADENCE_CONFIG[editingGoal.cadence].label} Goal`
    : activeFilter === "seasonal"
    ? "New Seasonal Goal"
    : `New ${CADENCE_CONFIG[activeFilter as GoalCadence].label} Goal`;

  function openDrawer() {
    setDrawerCadence(activeFilter === "seasonal" ? "daily" : activeFilter);
    setEditingGoal(null);
    setDrawerOpen(true);
  }

  function toggleRollupSection(cadence: GoalCadence) {
    setExpandedRollups((prev) => ({ ...prev, [cadence]: !(prev[cadence] ?? false) }));
  }

  function handleSave(goal: Goal) {
    const nextGoals = (() => {
      const idx = goals.findIndex((g) => g.id === goal.id);
      if (idx >= 0) {
        const updated = [...goals];
        updated[idx] = goal;
        return updated;
      }
      return [...goals, goal];
    })();

    setGoals(nextGoals);
    const weekStart = startOfWeek(today);
    const weekEnd = endOfWeek(today);
    const excludedByGoal = new Map<string, Set<string>>();
    for (const nextGoal of nextGoals) {
      if (!nextGoal.excludes?.categories?.length && !nextGoal.excludes?.individual?.length) continue;
      excludedByGoal.set(
        nextGoal.id,
        buildExcludedDates(
          weekStart,
          weekEnd,
          nextGoal.excludes?.categories ?? [],
          nextGoal.excludes?.individual ?? [],
        ),
      );
    }
    const updatedAssignments = materializePlannerWeekAssignments(nextGoals, dayAssignments, today, excludedByGoal);
    if (updatedAssignments !== dayAssignments) {
      setDayAssignments(updatedAssignments);
      saveDayAssignments(storageScope, updatedAssignments);
    }
  }

  function handleDelete(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  function handleAddPackGoal(goal: Goal) {
    if (!storageLoaded) return;
    setGoals((prev) => {
      const filtered = prev.filter((g) => g.id !== goal.id);
      return [goal, ...filtered];
    });
  }

  function handleRemovePackGoal(goalId: string) {
    if (!storageLoaded) return;
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
  }

  function handleEdit(goal: Goal) {
    setEditingGoal(goal);
    setDrawerCadence(goal.cadence);
    setDrawerOpen(true);
  }

  function handleUpdateProgress(id: string, newValue: number) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const cap = g.noGettingAhead && g.target !== undefined
          ? g.target + (g.backlog ?? 0)
          : Infinity;
        return { ...g, current: Math.min(newValue, cap) };
      }),
    );
  }

  function handleUpdateMilestones(id: string, milestones: Milestone[]) {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, milestones } : g)),
    );
  }

  function handleToggleDate(id: string, isoDate: string) {
    setGoals((prev) => toggleGoalDate(prev, id, isoDate));
  }

  function handleToggleBinaryPeriod(id: string) {
    const goal = goals.find((g) => g.id === id);
    if (!goal) return;
    const { start, end } = getPeriodBoundsForCadence(goal.cadence);
    const startIso = toIsoDate(start);
    const endIso = toIsoDate(end);
    const todayStr = toIsoDate(today);
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const hasAny = (g.completedDates ?? []).some((d) => d >= startIso && d < endIso);
        if (hasAny) {
          return { ...g, completedDates: (g.completedDates ?? []).filter((d) => d < startIso || d >= endIso) };
        }
        return { ...g, completedDates: [...(g.completedDates ?? []), todayStr] };
      }),
    );
  }

  function handleKillStreakAction(
    goal: Goal,
    action: "forgive" | "backlog" | "track-failure" | "kill-streak" | "start-again" | "false-accusation",
  ) {
    const { start, end } = getPeriodBoundsForCadence(activeFilter === "seasonal" ? goal.cadence : activeFilter);
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goal.id) return g;
        switch (action) {
          case "forgive":
            return { ...g, onMiss: "ignore" as const, carryover: "drop" as const };
          case "backlog": {
            const rollup = computeRollupProgress(g, start, end, today, dayAssignments);
            const missed = Math.max(0, rollup.elapsed - (g.current ?? 0));
            return { ...g, onMiss: "track" as const, carryover: "backlog" as const, backlog: (g.backlog ?? 0) + missed };
          }
          case "track-failure":
            return { ...g, onMiss: "track" as const, carryover: "drop" as const };
          case "kill-streak":
            return { ...g, status: "killed" as const };
          case "start-again":
            return { ...g, status: "ongoing" as const, current: 0, completedDates: [], startDate: todayIso };
          case "false-accusation":
            return { ...g, current: (g.current ?? 0) + 1 };
          default:
            return g;
        }
      }),
    );
  }

  function handleReviveGoal(id: string) {
    setGoals((prev) => prev.map((g) => g.id === id ? { ...g, status: "ongoing" as const } : g));
  }

  function handleRestartGoal(id: string) {
    setGoals((prev) => prev.map((g) =>
      g.id === id ? { ...g, status: "ongoing" as const, current: 0, completedDates: [], startDate: todayIso } : g,
    ));
  }

  function getRollupProgress(goal: Goal, viewCadence: GoalCadence): RollupProgress {
    return computeCrossperiodProgress(goal, viewCadence, today, dayAssignments);
  }

  function getSeasonalProgress(goal: Goal): RollupProgress {
    if (!goal.startDate || !goal.endDate) return getRollupProgress(goal, goal.cadence);
    const start = parseIsoDate(goal.startDate);
    const endInclusive = parseIsoDate(goal.endDate);
    if (!start || !endInclusive) return getRollupProgress(goal, goal.cadence);
    const end = new Date(endInclusive);
    end.setDate(end.getDate() + 1); // periodEnd is exclusive in computeRollupProgress
    return computeRollupProgress(goal, start, end, today, dayAssignments);
  }

  function fmtEndDate(iso: string) {
    const date = parseIsoDate(iso);
    if (!date) return iso;
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  }

  function toHebrewDateStr(iso: string): string {
    const date = parseIsoDate(iso);
    if (!date) return iso;
    const parts = new HDate(date).renderGematriya(true).trim().split(/\s+/);
    return preferences.hebrewDateIncludeYear ? parts.join(" ") : parts.slice(0, -1).join(" ");
  }

  function fmtDateRange(start: string | undefined, end: string | undefined): string | undefined {
    if (!end) return undefined;
    const engStart = start && start !== end ? fmtEndDate(start) : null;
    const engEnd = fmtEndDate(end);
    const eng = engStart ? `${engStart} – ${engEnd}` : engEnd;

    if (!preferences.showHebrewDatesOnGoals) return eng;

    const hebEnd = toHebrewDateStr(end);
    const heb = start && start !== end ? `${toHebrewDateStr(start)} – ${hebEnd}` : hebEnd;

    if (preferences.hebrewDateFormat === "hebrew") return heb;
    if (preferences.hebrewDateFormat === "both") return `${eng} · ${heb}`;
    return eng;
  }

  return (
    <>
      <Card className="p-5 md:p-6">
        {/* Card header row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2 className="text-xl font-bold tracking-tight text-text">Goals by timeframe</h2>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPacksDrawerOpen(true)}>
              Browse Goals
            </Button>
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
          {activeFilter === "one-time" ? (
            <ProjectGoalsView
              directGoals={directGoals}
              goals={goals}
              handleUpdateProgress={handleUpdateProgress}
              handleUpdateMilestones={handleUpdateMilestones}
              handleSave={handleSave}
              handleEdit={handleEdit}
              handleDelete={handleDelete}
            />
          ) : activeFilter === "seasonal" ? (() => {
            const liveGoals = directGoals.filter((g) => !g.startDate || g.startDate <= todayIso);
            const upcomingGoals = directGoals
              .filter((g) => g.startDate && g.startDate > todayIso)
              .sort((a, b) => (a.startDate! < b.startDate! ? -1 : 1));
            const dateRange = (g: Goal) => fmtDateRange(g.startDate, g.endDate);
            return liveGoals.length === 0 && upcomingGoals.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-subtle">No active seasonal goals.</p>
            ) : (
              <>
                {liveGoals.length > 0 && (
                  <>
                    <h3 className="mb-1 text-base font-semibold text-text">Seasonal goals</h3>
                    <div className="divide-y divide-line/40">
                      {liveGoals.map((goal) => {
                        const sp = getSeasonalProgress(goal);
                        const range = dateRange(goal);
                        return (
                          <GoalRow
                            key={goal.id}
                            goal={goal}
                            showMenu
                            rollupProgress={sp}
                            dailyBacklogEntries={getDailyBacklogEntries(goal, today)}
                            onResolveBacklogDate={(isoDate) => handleToggleDate(goal.id, isoDate)}
                            detailReferenceDate={today}
                            detailOverride={range}
                            onDelete={() => handleDelete(goal.id)}
                            onEdit={() => handleEdit(goal)}
                            onUpdateProgress={(v) => handleUpdateProgress(goal.id, v)}
                            onToggleDate={
                              goal.type === "binary" && goal.cadence !== "daily"
                                ? (_date) => handleToggleBinaryPeriod(goal.id)
                                : (date) => handleToggleDate(goal.id, date)
                            }
                            doneLabel={goal.cadence === "daily" ? "Today ✓" : undefined}
                            notDoneLabel={goal.cadence === "daily" ? "Mark today" : undefined}
                            onKillStreakAction={(action) => handleKillStreakAction(goal, action)}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
                {upcomingGoals.length > 0 && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setUpcomingExpanded((v) => !v)}
                      className="flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text transition-colors"
                    >
                      <svg
                        width="12" height="12" viewBox="0 0 12 12" fill="none"
                        className={`transition-transform duration-150 ${upcomingExpanded ? "rotate-90" : ""}`}
                      >
                        <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Upcoming ({upcomingGoals.length})
                    </button>
                    {upcomingExpanded && (
                      <div className="mt-2 divide-y divide-line/40">
                        {upcomingGoals.map((goal) => (
                          <GoalRow
                            key={goal.id}
                            goal={goal}
                            showMenu
                            detailOverride={dateRange(goal)}
                            onDelete={() => handleDelete(goal.id)}
                            onEdit={() => handleEdit(goal)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()
          : directGoals.length > 0 ? (
            <>
              <h3 className="mb-1 text-base font-semibold text-text">
                {CADENCE_CONFIG[activeFilter as GoalCadence].label} goals
              </h3>
              <div className="divide-y divide-line/40">
                {directGoals.map((goal) => (
                  <GoalRow
                    key={goal.id}
                    goal={goal}
                    showMenu
                    rollupProgress={getRollupProgress(goal, activeFilter as GoalCadence)}
                    dailyBacklogEntries={getDailyBacklogEntries(goal, today)}
                    onResolveBacklogDate={(isoDate) => handleToggleDate(goal.id, isoDate)}
                    detailReferenceDate={today}
                    onDelete={() => handleDelete(goal.id)}
                    onEdit={() => handleEdit(goal)}
                    onUpdateProgress={(v) => handleUpdateProgress(goal.id, v)}
                    onToggleDate={
                      goal.type === "binary" && goal.cadence !== "daily"
                        ? (_date) => handleToggleBinaryPeriod(goal.id)
                        : (date) => handleToggleDate(goal.id, date)
                    }
                    onKillStreakAction={(action) => handleKillStreakAction(goal, action)}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-text-subtle">
              No {CADENCE_CONFIG[activeFilter as GoalCadence].label.toLowerCase()} goals yet.
            </p>
          )}
        </div>

        {/* Roll-up sections (computed from lower-cadence goals) */}
        {rollupCadences.map((cadence: GoalCadence) => {
          const rollupGoals = goals.filter((g) => g.cadence === cadence && !g.endDate);
          if (rollupGoals.length === 0) return null;
          const isExpanded = expandedRollups[cadence] ?? false;
          const sectionId = `rollup-${activeFilter}-${cadence}`;
          const countLabel = `${rollupGoals.length} ${rollupGoals.length === 1 ? "goal" : "goals"}`;
          return (
            <div
              key={cadence}
              className="mt-4 overflow-hidden rounded-2xl border border-line/70 bg-surface-muted/45"
            >
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={sectionId}
                onClick={() => toggleRollupSection(cadence)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/60"
              >
                <span className="min-w-0">
                  <span className="block border-l-2 border-brand/30 pl-2 text-xs font-semibold uppercase tracking-[0.22em] text-brand">
                    From {CADENCE_CONFIG[cadence].label} Goals
                  </span>
                  <span className="mt-1 block pl-2 text-xs font-medium text-text-subtle">
                    {countLabel} roll up into this view
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-text-muted shadow-soft">
                  {isExpanded ? "Hide" : "Show"}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </span>
              </button>
              {isExpanded ? (
                <div id={sectionId} className="divide-y divide-line/50 border-t border-line/60 px-4 pb-2">
                  {rollupGoals.map((goal) => (
                    <GoalRow
                      key={goal.id}
                      goal={goal}
                      showMenu={false}
                      rollupProgress={getRollupProgress(goal, activeFilter as GoalCadence)}
                      dailyBacklogEntries={getDailyBacklogEntries(goal, today)}
                      onResolveBacklogDate={(isoDate) => handleToggleDate(goal.id, isoDate)}
                      detailReferenceDate={today}
                      detailOverride={
                        goal.cadence !== "daily" && goal.type === "quantified" && goal.target
                          ? `${goal.target}${goal.targetUnit ? ` ${goal.targetUnit}` : ""}/${CADENCE_CONFIG[goal.cadence].short}`
                          : undefined
                      }
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        {/* Killed goals section */}
        {(() => {
          const killedGoals = goals.filter((g) => g.status === "killed" && (
            activeFilter === "seasonal" ? !!g.endDate : g.cadence === (activeFilter as GoalCadence)
          ));
          if (killedGoals.length === 0) return null;
          return (
            <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50/40 p-4">
              <h4 className="mb-3 text-sm font-semibold text-orange-700">Ended ({killedGoals.length})</h4>
              <div className="space-y-2">
                {killedGoals.map((goal) => (
                  <div key={goal.id} className="flex items-center justify-between gap-3 rounded-xl border border-orange-100 bg-white px-3 py-2.5 shadow-soft">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text">{goal.title}</p>
                      <p className="text-xs text-text-subtle">Streak ended</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button type="button" onClick={() => handleReviveGoal(goal.id)}
                        className="rounded-lg border border-brand/30 bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand transition hover:bg-brand/15"
                        title="I actually did it — restore the streak"
                      >
                        Revive
                      </button>
                      <button type="button" onClick={() => handleRestartGoal(goal.id)}
                        className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-text-muted transition hover:border-brand/30 hover:text-text"
                        title="Start fresh from today"
                      >
                        Restart
                      </button>
                      <button type="button" onClick={() => handleDelete(goal.id)}
                        className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-text-subtle transition hover:border-red-200 hover:text-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </Card>

      {/* New / edit goal drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={drawerTitle}>
        <NewGoalForm
          key={editingGoal?.id ?? `new-${drawerCadence}`}
          defaultCadence={drawerCadence}
          existingGoal={editingGoal ?? undefined}
          onSave={handleSave}
          onClose={() => setDrawerOpen(false)}
          allowCadenceChange={!editingGoal && activeFilter === "seasonal"}
        />
      </Drawer>

      {/* Add goals modal */}
      <AddGoalsModal
        open={packsDrawerOpen}
        onClose={() => setPacksDrawerOpen(false)}
        goals={goals}
        today={today}
        onAddGoal={handleAddPackGoal}
        onRemoveGoal={handleRemovePackGoal}
        onEdit={(goal) => {
          setPacksDrawerOpen(false);
          handleEdit(goal);
        }}
        updatePreference={updatePreference}
        setGoals={setGoals}
      />
    </>
  );
}
