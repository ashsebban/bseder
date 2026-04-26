"use client";

import { useState, useEffect, useRef } from "react";
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
import { useCalendarPreferences } from "@/features/settings/hooks/use-calendar-preferences";
import { OMER_GOAL_ID, syncOmerGoalInList } from "@/features/calendar/lib/omer-goal";
import { AddGoalsModal } from "@/features/goals/components/add-goals-modal";
import { fetchApi, isAbortError } from "@/lib/api-client";

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
  yearly: { label: "Yearly", short: "year", rollups: ["monthly", "weekly", "daily"] },
  monthly: { label: "Monthly", short: "month", rollups: ["weekly", "daily"] },
  weekly: { label: "Weekly", short: "week", rollups: ["daily"] },
  daily: { label: "Daily", short: "day", rollups: [] },
};


export function GoalsWorkspace({ storageScope }: { storageScope: string }) {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("daily");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dayAssignments, setDayAssignments] = useState<DayAssignment[]>([]);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [serverHydrated, setServerHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCadence, setDrawerCadence] = useState<GoalCadence>("daily");
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [packsDrawerOpen, setPacksDrawerOpen] = useState(false);
  const goalsSaveControllerRef = useRef<AbortController | null>(null);
  const assignmentsSaveControllerRef = useRef<AbortController | null>(null);
  const goalsSnapshotRef = useRef("[]");
  const assignmentsSnapshotRef = useRef("[]");

  const { preferences, updatePreference } = useCalendarPreferences(undefined, storageScope);

  useEffect(() => {
    goalsSnapshotRef.current = JSON.stringify(goals);
  }, [goals]);

  useEffect(() => {
    assignmentsSnapshotRef.current = JSON.stringify(dayAssignments);
  }, [dayAssignments]);

  // Load from localStorage after mount
  useEffect(() => {
    if (!storageScope) {
      setGoals([]);
      setDayAssignments([]);
      setStorageLoaded(false);
      setServerHydrated(false);
      return;
    }
    setGoals(loadGoals(storageScope));
    setDayAssignments(loadDayAssignments(storageScope));
    setStorageLoaded(true);
    setServerHydrated(false);
  }, [storageScope]);

  // Persist goals whenever they change (after initial load)
  useEffect(() => {
    if (storageLoaded && storageScope) saveGoals(storageScope, goals);
  }, [goals, storageLoaded, storageScope]);

  useEffect(() => {
    if (!storageScope) return;

    function handleGoalsUpdated(event: Event) {
      const detail = (event as CustomEvent<GoalsStorageUpdatedDetail>).detail;
      if (!detail || detail.storageScope !== storageScope) return;
      const nextSnapshot = JSON.stringify(detail.goals);
      if (nextSnapshot === goalsSnapshotRef.current) return;
      setGoals(detail.goals);
    }

    function handleAssignmentsUpdated(event: Event) {
      const detail = (event as CustomEvent<DayAssignmentsStorageUpdatedDetail>).detail;
      if (!detail || detail.storageScope !== storageScope) return;
      const nextSnapshot = JSON.stringify(detail.assignments);
      if (nextSnapshot === assignmentsSnapshotRef.current) return;
      setDayAssignments(detail.assignments);
    }

    window.addEventListener(GOALS_STORAGE_UPDATED_EVENT, handleGoalsUpdated as EventListener);
    window.addEventListener(DAY_ASSIGNMENTS_STORAGE_UPDATED_EVENT, handleAssignmentsUpdated as EventListener);
    return () => {
      window.removeEventListener(GOALS_STORAGE_UPDATED_EVENT, handleGoalsUpdated as EventListener);
      window.removeEventListener(DAY_ASSIGNMENTS_STORAGE_UPDATED_EVENT, handleAssignmentsUpdated as EventListener);
    };
  }, [storageScope]);

  // On mount: fetch from server after localStorage hydration — server wins
  useEffect(() => {
    if (!storageLoaded || !storageScope) return;
    let cancelled = false;

    (async () => {
      const [goalsResult, assignmentsResult] = await Promise.allSettled([
        fetchApi<{ goals: Goal[] }>("/api/goals"),
        fetchApi<{ assignments: DayAssignment[] }>("/api/assignments"),
      ]);

      if (cancelled) return;

      if (goalsResult.status === "fulfilled" && Array.isArray(goalsResult.value.goals)) {
        setGoals(goalsResult.value.goals);
        saveGoals(storageScope, goalsResult.value.goals);
      } else if (goalsResult.status === "rejected") {
        console.error("[goals-workspace] fetch goals failed:", goalsResult.reason);
      }

      if (assignmentsResult.status === "fulfilled" && Array.isArray(assignmentsResult.value.assignments)) {
        setDayAssignments(assignmentsResult.value.assignments);
        saveDayAssignments(storageScope, assignmentsResult.value.assignments);
      } else if (assignmentsResult.status === "rejected") {
        console.error("[goals-workspace] fetch assignments failed:", assignmentsResult.reason);
      }

      setServerHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [storageLoaded, storageScope]);

  // On goals change: debounced save to server
  useEffect(() => {
    if (!storageLoaded || !serverHydrated) return;
    const t = setTimeout(() => {
      goalsSaveControllerRef.current?.abort();
      const controller = new AbortController();
      goalsSaveControllerRef.current = controller;
      fetchApi("/api/goals", {
        method: "PUT",
        body: JSON.stringify({ goals }),
        signal: controller.signal,
      })
        .catch((err) => {
          if (!isAbortError(err)) {
            console.error("[goals-workspace] save goals failed:", err);
          }
        })
        .finally(() => {
          if (goalsSaveControllerRef.current === controller) {
            goalsSaveControllerRef.current = null;
          }
        });
    }, 2000);
    return () => clearTimeout(t);
  }, [goals, storageLoaded, serverHydrated]);

  // Safety net: flush latest goals when the tab/window is being closed.
  useEffect(() => {
    if (!storageLoaded || !serverHydrated) return;
    const handleBeforeUnload = () => {
      const payload = JSON.stringify({ goals });
      navigator.sendBeacon("/api/goals", payload);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [goals, storageLoaded, serverHydrated]);

  // On assignments change: debounced save to server
  useEffect(() => {
    if (!storageLoaded || !serverHydrated) return;
    const t = setTimeout(() => {
      const persistableAssignments = getPersistableDayAssignments(dayAssignments);
      assignmentsSaveControllerRef.current?.abort();
      const controller = new AbortController();
      assignmentsSaveControllerRef.current = controller;
      fetchApi("/api/assignments", {
        method: "PUT",
        body: JSON.stringify({ assignments: persistableAssignments }),
        signal: controller.signal,
      })
        .catch((err) => {
          if (!isAbortError(err)) {
            console.error("[goals-workspace] save assignments failed:", err);
          }
        })
        .finally(() => {
          if (assignmentsSaveControllerRef.current === controller) {
            assignmentsSaveControllerRef.current = null;
          }
        });
    }, 2000);
    return () => clearTimeout(t);
  }, [dayAssignments, storageLoaded, serverHydrated]);

  useEffect(() => () => {
    goalsSaveControllerRef.current?.abort();
    assignmentsSaveControllerRef.current?.abort();
  }, []);

  // Keep Omer goal dates current (only updates if the goal is already in the list)
  useEffect(() => {
    if (!storageLoaded) return;
    setGoals((prev) => syncOmerGoalInList(prev, prev.some((g) => g.id === OMER_GOAL_ID), today));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageLoaded]);

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
    setDayAssignments((prev) => {
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
      const updatedAssignments = materializePlannerWeekAssignments(nextGoals, prev, today, excludedByGoal);
      if (updatedAssignments !== prev) saveDayAssignments(storageScope, updatedAssignments);
      return updatedAssignments;
    });
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

  function fmtEndDate(iso: string) {
    const date = parseIsoDate(iso);
    if (!date) return iso;
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${date.getDate()} ${months[date.getMonth()]}`;
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
          {activeFilter === "one-time" ? (() => {
            // Projects = non-adhoc one-time goals; adhoc tasks belong to the day view only
            const projects = directGoals.filter((g) => !g.adhoc);
            return projects.length > 0 ? (
              <>
                <h3 className="mb-3 text-base font-semibold text-text">Projects</h3>
                <div className="space-y-3">
                  {projects.map((goal) => {
                    const childGoal = goals.find(
                      (g) => g.parentGoalId === goal.id && g.cadence !== "one-time",
                    );
                    return (
                      <ProjectGoalCard
                        key={goal.id}
                        goal={goal}
                        childGoal={childGoal}
                        onUpdateProgress={handleUpdateProgress}
                        onUpdateMilestones={handleUpdateMilestones}
                        onSaveChildGoal={handleSave}
                        onEdit={() => handleEdit(goal)}
                        onDelete={() => handleDelete(goal.id)}
                      />
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="py-6 text-center text-sm text-text-subtle">
                No projects yet. Create one to track long-term goals with milestones.
              </p>
            );
          })() : activeFilter === "seasonal" ? (
            directGoals.length > 0 ? (
              <>
                <h3 className="mb-1 text-base font-semibold text-text">Seasonal goals</h3>
                <div className="divide-y divide-line/40">
                  {directGoals.map((goal) => (
                    <GoalRow
                      key={goal.id}
                      goal={goal}
                      showMenu
                      rollupProgress={getRollupProgress(goal, goal.cadence)}
                      dailyBacklogEntries={getDailyBacklogEntries(goal, today)}
                      onResolveBacklogDate={(isoDate) => handleToggleDate(goal.id, isoDate)}
                      detailReferenceDate={today}
                      detailOverride={
                        goal.endDate
                          ? (goal.startDate && goal.startDate !== goal.endDate
                              ? `${fmtEndDate(goal.startDate)} – ${fmtEndDate(goal.endDate)}`
                              : `${fmtEndDate(goal.endDate)}`)
                          : undefined
                      }
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
                No active seasonal goals.
              </p>
            )
          ) : directGoals.length > 0 ? (
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
          return (
            <div
              key={cadence}
              className="mt-4 rounded-2xl border border-slate-200/60 bg-slate-50/80 p-4"
            >
              <p className="mb-2 border-l-2 border-brand/30 pl-2 text-xs font-semibold uppercase tracking-[0.22em] text-brand">
                From {CADENCE_CONFIG[cadence].label} Goals
              </p>
              <div className="divide-y divide-slate-100">
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
