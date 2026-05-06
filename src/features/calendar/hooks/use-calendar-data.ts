"use client";

import { useState, useEffect, useCallback, useMemo, useLayoutEffect, useRef } from "react";
import type { Goal } from "@/features/goals/types/goal";
import type { DayAssignment } from "@/features/planner/lib/day-assignment-store";
import type { CalendarPreferences } from "@/features/settings/types/calendar-preferences";
import type { CalendarDayMetadata, CalendarView } from "@/features/calendar/types/calendar";
import { loadGoals, saveGoals } from "@/features/goals/lib/goal-store";
import {
  loadDayAssignments,
  saveDayAssignments,
  createAssignment,
  createDayAssignmentId,
  getPersistableDayAssignments,
  areDayAssignmentsEqual,
} from "@/features/planner/lib/day-assignment-store";
import { loadGoalOrder, saveGoalOrder, reorderGlobal } from "@/features/planner/lib/goal-order-store";
import { buildExcludedDates, computeDayProgress } from "@/features/goals/lib/goal-progress";
import { DAY_KEYS, isGoalApplicableOnDate } from "@/features/goals/lib/goal-applicability";
import { materializePlannerWeekAssignments } from "@/features/planner/lib/materialize-goal-assignments";
import { buildAssignmentDisplayGroups, parseSessionGroupActionId } from "@/features/planner/lib/day-assignment-groups";
import { buildJewishTimesByDate } from "@/features/calendar/lib/jewish-times";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, toIsoDate } from "@/lib/date";
import { computeRemainingCapacity } from "@/features/planner/lib/assignment-rules";
import { computePeriodKey } from "@/features/planner/lib/period-key";
import {
  applyQuantifiedAssignmentCompletion,
  reopenCollapsedSessionGroupAsSingleAssignment,
  resolveAssignmentsForAction,
  suggestedAssignmentAmount,
  sumAssignmentAmounts,
} from "@/features/calendar/lib/assignment-actions";
import { toggleGoalDate, updateParentProgress } from "@/features/goals/lib/goal-mutations";
import { computeDayZmanim } from "@/features/calendar/lib/zmanim";
import { resolveLocation } from "@/features/calendar/lib/locations";
import { getGoalTimePlacementForTime, getGoalTimeStateForNow, MAARIV_GOAL_ID, type GoalTimeCaveat } from "@/features/calendar/lib/goal-time-window";
import {
  getAssignmentOccurrenceDate,
  getGoalOccurrenceDateForPlannerDate,
} from "@/features/calendar/lib/goal-day";
import { syncTimeCaveatFollowup } from "@/features/calendar/lib/time-caveat-followups";
import { fetchApi, isAbortError } from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PendingAssignment {
  goalId: string;
  isoDate: string;
  maxAmount?: number;
  suggestedAmount?: number;
  replacedAutoDate?: string;
}

export interface PendingCompletion {
  id: string;
  defaultAmount: number;
  date: string;
}

export interface PendingDateCompletion {
  goalId: string;
  isoDate: string;
  defaultAmount: number;
  source: "checklist" | "default";
}

export type AmountPromptContext =
  | ({ kind: "assignment" } & PendingAssignment)
  | ({ kind: "completion" } & PendingCompletion)
  | ({ kind: "date-completion" } & PendingDateCompletion);

export interface UseCalendarDataReturn {
  goals: Goal[];
  /** Materialized planner assignments (auto-generated recurring + user-explicit) */
  assignments: DayAssignment[];
  goalOrder: string[];
  isLoading: boolean;
  excludedByGoal: Map<string, Set<string>>;
  metadataByDate: Map<string, CalendarDayMetadata>;
  amountPrompt: AmountPromptContext | null;
  capBlockedGoal: Goal | null;

  assign: (
    goalId: string,
    isoDate: string,
    targetAmount?: number,
    periodKey?: string,
    replacedAutoDate?: string,
    scheduledTime?: string,
    durationMins?: number,
  ) => void;
  assignWithTime: (goalId: string, isoDate: string, scheduledTime: string, durationMins: number) => void;
  assignReplacing: (goalId: string, isoDate: string, replacedAutoDate: string) => void;
  unassign: (actionId: string) => void;
  moveAssignment: (actionId: string, newIsoDate: string) => void;
  toggleAssignment: (assignmentId: string) => void;
  toggleDate: (goalId: string, isoDate: string, source?: "checklist" | "default") => void;
  setScheduledTime: (assignmentId: string, time: string | null) => void;
  unscheduleAssignment: (assignmentId: string) => void;
  setDuration: (assignmentId: string, durationMins: number) => void;
  reorderGoals: (prevIds: string[], nextIds: string[]) => void;
  renameGoal: (goalId: string, nextTitle: string) => void;
  addTask: (title: string, isoDate: string) => void;

  confirmAmountPrompt: (amount: number) => void;
  clearPending: () => void;
  /** Called from handleDragEnd in the component when a cap-blocked drag occurs */
  openCapBlockedModal: (goalId: string) => void;
  /** Called from handleDragEnd to request the quantified-amount modal */
  openAssignmentModal: (pa: PendingAssignment) => void;
  /** Create a completed assignment (alreadyDone timeline drop path in handleDragEnd) */
  assignAlreadyCompleted: (goalId: string, isoDate: string, periodKey: string | undefined, scheduledTime: string, durationMins: number) => void;
  syncTimeCaveatFollowup: (isoDate: string, caveat: GoalTimeCaveat | null) => void;
}

// ─── Module-level helpers ─────────────────────────────────────────────────────

function currentTimeString(): string {
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function getZmanimForDate(dateIso: string, preferences: CalendarPreferences) {
  const location = resolveLocation(preferences);
  if (!location) return null;
  return computeDayZmanim(new Date(`${dateIso}T00:00:00`), location, preferences.timeFormat);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCalendarData({
  storageScope,
  calendar,
  preferences,
}: {
  storageScope: string;
  calendar: { view: CalendarView; selectedDate: Date; selectedDateIso: string };
  preferences: CalendarPreferences;
}): UseCalendarDataReturn {
  // ── State ──────────────────────────────────────────────────────────────────
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dayAssignments, setDayAssignments] = useState<DayAssignment[]>([]);
  const [goalOrder, setGoalOrder] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [serverHydrated, setServerHydrated] = useState(false);
  const [amountPrompt, setAmountPrompt] = useState<AmountPromptContext | null>(null);
  const [capBlockedGoalId, setCapBlockedGoalId] = useState<string | null>(null);
  const goalsSaveControllerRef = useRef<AbortController | null>(null);
  const assignmentsSaveControllerRef = useRef<AbortController | null>(null);
  const goalsRef = useRef<Goal[]>([]);
  const dayAssignmentsRef = useRef<DayAssignment[]>([]);
  const serverHydratedRef = useRef(false);
  const isLoadedRef = useRef(false);

  // ── Derived ranges (cheap, computed inline) ────────────────────────────────
  const monthRangeStart = startOfWeek(startOfMonth(calendar.selectedDate), preferences.weekStartsOn);
  const monthRangeEnd = endOfWeek(endOfMonth(calendar.selectedDate), preferences.weekStartsOn);

  // ── Persist helpers ────────────────────────────────────────────────────────
  useLayoutEffect(() => { goalsRef.current = goals; });
  useLayoutEffect(() => { dayAssignmentsRef.current = dayAssignments; });
  useLayoutEffect(() => { serverHydratedRef.current = serverHydrated; });
  useLayoutEffect(() => { isLoadedRef.current = isLoaded; });

  const persistGoals = useCallback((next: Goal[]) => {
    if (!storageScope) return;
    saveGoals(storageScope, next);
  }, [storageScope]);

  const persistDayAssignments = useCallback((next: DayAssignment[]) => {
    if (!storageScope) return;
    saveDayAssignments(storageScope, next);
  }, [storageScope]);

  const persistGoalOrder = useCallback((next: string[]) => {
    if (!storageScope) return;
    saveGoalOrder(storageScope, next);
  }, [storageScope]);

  // ── Load from localStorage ─────────────────────────────────────────────────
  useEffect(() => {
    if (!storageScope) {
      setGoals([]);
      setDayAssignments([]);
      setGoalOrder([]);
      setIsLoaded(false);
      setServerHydrated(false);
      return;
    }
    setGoals(loadGoals(storageScope));
    setDayAssignments(loadDayAssignments(storageScope));
    setGoalOrder(loadGoalOrder(storageScope));
    setIsLoaded(true);
    setServerHydrated(false);
  }, [storageScope]);

  // ── Hydrate from server after local load; server is authoritative ──────────
  useEffect(() => {
    if (!isLoaded || !storageScope) return;
    let cancelled = false;

    (async () => {
      const [goalsResult, assignmentsResult] = await Promise.allSettled([
        fetchApi<{ goals: Goal[] }>("/api/goals"),
        fetchApi<{ assignments: DayAssignment[] }>("/api/assignments"),
      ]);

      if (cancelled) return;

      if (goalsResult.status === "fulfilled" && Array.isArray(goalsResult.value.goals)) {
        const serverGoals = goalsResult.value.goals;
        setGoals((current) => {
          const serverMap = new Map(serverGoals.map((g) => [g.id, g]));
          // Keep goals added locally while the fetch was in-flight.
          const localOnly = current.filter((g) => !serverMap.has(g.id));
          // For goals that exist on both sides, merge completedDates so a local completion
          // that hasn't reached the server yet (pre-hydration toggle) is not discarded.
          const merged = serverGoals.map((serverG) => {
            const localG = current.find((g) => g.id === serverG.id);
            if (!localG) return serverG;
            const serverDates = serverG.completedDates ?? [];
            const localDates = localG.completedDates ?? [];
            const localAhead = localDates.filter((d) => !serverDates.includes(d));
            if (localAhead.length === 0) return serverG;
            return { ...serverG, completedDates: [...serverDates, ...localAhead] };
          });
          return localOnly.length > 0 ? [...localOnly, ...merged] : merged;
        });
      } else if (goalsResult.status === "rejected") {
        console.warn("[use-calendar-data] server goals sync failed; keeping local goals:", goalsResult.reason);
      }

      if (assignmentsResult.status === "fulfilled" && Array.isArray(assignmentsResult.value.assignments)) {
        const serverAssignments = assignmentsResult.value.assignments;
        setDayAssignments((current) => {
          const serverIds = new Set(serverAssignments.map((a) => a.id));
          // Keep any assignments created locally while the fetch was in-flight.
          const localOnly = current.filter((a) => !serverIds.has(a.id));
          // For shared assignments, prefer the local version when it is completed and the
          // server version is not — the completion hasn't been flushed to the server yet.
          const merged = serverAssignments.map((serverA) => {
            const localA = current.find((a) => a.id === serverA.id);
            return localA?.completed && !serverA.completed ? localA : serverA;
          });
          return localOnly.length > 0 ? [...localOnly, ...merged] : merged;
        });
        // localStorage mirrors the merged state; let the state-change effect handle it.
      } else if (assignmentsResult.status === "rejected") {
        console.warn("[use-calendar-data] server assignments sync failed; keeping local assignments:", assignmentsResult.reason);
      }

      setServerHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, storageScope, persistGoals, persistDayAssignments]);

  // ── Derived: excluded dates per goal ───────────────────────────────────────
  const excludedByGoal = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const goal of goals) {
      if (!goal.excludes?.categories?.length && !goal.excludes?.individual?.length) continue;
      const excluded = buildExcludedDates(
        monthRangeStart,
        monthRangeEnd,
        goal.excludes.categories ?? [],
        goal.excludes.individual ?? [],
      );
      map.set(goal.id, excluded);
    }
    return map;
  // monthRangeStart/End are Date objects — use the stable primitives they derive from
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, calendar.selectedDateIso, preferences.weekStartsOn]);

  // ── Server sync (goals) ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
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
            console.error("[use-calendar-data] save goals failed:", err);
          }
        })
        .finally(() => {
          if (goalsSaveControllerRef.current === controller) {
            goalsSaveControllerRef.current = null;
          }
        });
    }, 2000);
    return () => clearTimeout(t);
  }, [goals, isLoaded]);

  // ── Server sync (assignments) ──────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
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
            console.error("[use-calendar-data] save assignments failed:", err);
          }
        })
        .finally(() => {
          if (assignmentsSaveControllerRef.current === controller) {
            assignmentsSaveControllerRef.current = null;
          }
        });
    }, 2000);
    return () => clearTimeout(t);
  }, [dayAssignments, isLoaded]);

  // Flush pending saves immediately when the page is hidden (reload, tab switch, close).
  // keepalive:true lets the fetch complete even as the document unloads.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== "hidden") return;
      if (!isLoadedRef.current || !serverHydratedRef.current) return;
      goalsSaveControllerRef.current?.abort();
      assignmentsSaveControllerRef.current?.abort();
      fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: goalsRef.current }),
        keepalive: true,
      }).catch(() => {});
      fetch("/api/assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments: getPersistableDayAssignments(dayAssignmentsRef.current) }),
        keepalive: true,
      }).catch(() => {});
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => () => {
    goalsSaveControllerRef.current?.abort();
    assignmentsSaveControllerRef.current?.abort();
  }, []);

  // ── Safety net: flush latest data on tab/window close ─────────────────────
  useEffect(() => {
    if (!isLoaded || !serverHydrated) return;
    const handleBeforeUnload = () => {
      const persistableAssignments = getPersistableDayAssignments(dayAssignments);
      navigator.sendBeacon("/api/goals", JSON.stringify({ goals }));
      navigator.sendBeacon("/api/assignments", JSON.stringify({ assignments: persistableAssignments }));
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [goals, dayAssignments, isLoaded, serverHydrated]);

  // ── Materialized planner assignments ───────────────────────────────────────
  const plannerDayAssignments = useMemo(
    () => materializePlannerWeekAssignments(goals, dayAssignments, calendar.selectedDate, excludedByGoal, {
      now: new Date(),
      getZmanimForDate: (isoDate) => getZmanimForDate(isoDate, preferences),
    }),
    [goals, dayAssignments, calendar.selectedDate, calendar.view, excludedByGoal, preferences],
  );

  useLayoutEffect(() => {
    if (areDayAssignmentsEqual(plannerDayAssignments, dayAssignments)) return;
    // Only update React state. Completion toggles call persistDayAssignments directly;
    // persisting derived/materialized state here would write intermediate values.
    setDayAssignments(plannerDayAssignments);
  }, [dayAssignments, plannerDayAssignments]);

  // ── Jewish times by date ───────────────────────────────────────────────────
  const jewishTimesByDate = useMemo(
    () => buildJewishTimesByDate(monthRangeStart, monthRangeEnd, preferences),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calendar.selectedDateIso, preferences],
  );

  // ── Calendar day metadata ──────────────────────────────────────────────────
  const metadataByDate = useMemo<Map<string, CalendarDayMetadata>>(() => {
    const merged = new Map(jewishTimesByDate);

    // 1. Daily goal progress (schedule-driven via completedDates)
    if (goals.length > 0) {
      const cursor = new Date(monthRangeStart);
      while (cursor <= monthRangeEnd) {
        const progress = computeDayProgress(goals, new Date(cursor), excludedByGoal, plannerDayAssignments);
        if (progress) {
          const iso = toIsoDate(cursor);
          const existing = merged.get(iso);
          merged.set(iso, { ...existing, progress });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    // 2. Assignment progress (intent-driven; skip daily — already counted above)
    const goalMap = new Map(goals.map((g) => [g.id, g]));
    const assignmentsByDate = new Map<string, DayAssignment[]>();
    for (const assignment of plannerDayAssignments) {
      if (assignment.skipped) continue;
      const goal = goalMap.get(assignment.goalId);
      if (!goal || goal.cadence === "daily") continue;
      const existing = assignmentsByDate.get(assignment.date) ?? [];
      existing.push(assignment);
      assignmentsByDate.set(assignment.date, existing);
    }
    for (const [date, assignments] of assignmentsByDate) {
      const visibleGroups = buildAssignmentDisplayGroups(assignments);
      const existing = merged.get(date);
      const base = existing?.progress ?? { completed: 0, total: 0, missed: 0 };
      merged.set(date, {
        ...existing,
        progress: {
          completed: base.completed + visibleGroups.filter((g) => g.representative.completed).length,
          total: base.total + visibleGroups.length,
          missed: base.missed,
        },
      });
    }

    // 3. Non-daily completedDates not covered by a DayAssignment
    const assignmentDatesByGoal = new Map<string, Set<string>>();
    for (const a of plannerDayAssignments) {
      if (!assignmentDatesByGoal.has(a.goalId)) assignmentDatesByGoal.set(a.goalId, new Set());
      assignmentDatesByGoal.get(a.goalId)!.add(a.date);
    }
    for (const goal of goals) {
      if (goal.cadence === "daily") continue;
      const coveredDates = assignmentDatesByGoal.get(goal.id) ?? new Set<string>();
      for (const dateStr of goal.completedDates ?? []) {
        if (coveredDates.has(dateStr)) continue;
        const existing = merged.get(dateStr);
        const base = existing?.progress ?? { completed: 0, total: 0, missed: 0 };
        merged.set(dateStr, {
          ...existing,
          progress: { completed: base.completed + 1, total: base.total + 1, missed: base.missed },
        });
      }
    }

    return merged;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jewishTimesByDate, goals, excludedByGoal, plannerDayAssignments, calendar.selectedDateIso, preferences.weekStartsOn]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const assign = useCallback((
    goalId: string,
    isoDate: string,
    targetAmount?: number,
    periodKey?: string,
    replacedAutoDate?: string,
    scheduledTime?: string,
    durationMins?: number,
  ) => {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    const occurrenceDate = getGoalOccurrenceDateForPlannerDate(goal, isoDate, {
      scheduledTime,
      zmanim: getZmanimForDate(isoDate, preferences),
    });
    if (!isGoalApplicableOnDate(goal, occurrenceDate, { excludedByGoal, mode: "manual" })) return;
    setDayAssignments((prev) => {
      const isDuplicate = goal.type !== "quantified" && prev.some(
        (a) => a.goalId === goalId && a.date === isoDate && getAssignmentOccurrenceDate(a) === occurrenceDate && !a.skipped,
      );
      if (isDuplicate) return prev;
      if (goal.noGettingAhead && goal.target !== undefined) {
        const remaining = computeRemainingCapacity(goal, prev, calendar.selectedDate);
        const replacedContribution = replacedAutoDate && goal.activeDays?.length && goal.target
          ? Math.ceil(goal.target / goal.activeDays.length)
          : 0;
        if ((targetAmount ?? 1) > remaining + replacedContribution) return prev;
      }
      const effectivePeriodKey = periodKey ?? computePeriodKey(goal.cadence, new Date(`${occurrenceDate}T00:00:00`));
      const updated = [
        ...prev,
        createAssignment(
          goalId,
          isoDate,
          targetAmount,
          effectivePeriodKey,
          replacedAutoDate,
          scheduledTime,
          durationMins,
          undefined,
          undefined,
          occurrenceDate === isoDate ? undefined : occurrenceDate,
        ),
      ];
      persistDayAssignments(updated);
      return updated;
    });
  }, [calendar.selectedDate, excludedByGoal, goals, persistDayAssignments, preferences]);

  const assignWithTime = useCallback((
    goalId: string,
    isoDate: string,
    scheduledTime: string,
    durationMins: number,
  ) => {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    const periodKey = computePeriodKey(goal.cadence, new Date(isoDate + "T00:00:00"));
    assign(goalId, isoDate, undefined, periodKey, undefined, scheduledTime, durationMins);
  }, [goals, assign]);

  const assignReplacing = useCallback((
    goalId: string,
    isoDate: string,
    replacedAutoDate: string,
  ) => {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    const periodKey = computePeriodKey(goal.cadence, new Date(isoDate + "T00:00:00"));
    assign(goalId, isoDate, undefined, periodKey, replacedAutoDate);
  }, [goals, assign]);

  const unassign = useCallback((actionId: string) => {
    const assignmentsToRemove = resolveAssignmentsForAction(plannerDayAssignments, actionId);
    if (assignmentsToRemove.length === 0) return;
    const goalId = assignmentsToRemove[0].goalId;
    const goal = goals.find((g) => g.id === goalId);
    if (goal?.lockInDays) return;
    const assignmentIdsToRemove = new Set(assignmentsToRemove.map((a) => a.id));
    const remainingAssignments = plannerDayAssignments.filter(
      (a) => a.goalId === goalId && !assignmentIdsToRemove.has(a.id),
    );
    setDayAssignments((prev) => {
      const filtered = prev.filter((a) => !assignmentIdsToRemove.has(a.id));
      const skipDates = new Set<string>();
      for (const a of assignmentsToRemove) {
        if (a.replacedAutoDate) skipDates.add(a.replacedAutoDate);
        if (a.generated) skipDates.add(a.date);
      }
      const skipRecords = [...skipDates]
        .filter((date) => !filtered.some((a) => a.goalId === goalId && a.date === date && a.skipped))
        .map((date): DayAssignment => ({
          id: createDayAssignmentId(),
          goalId,
          date,
          completed: false,
          skipped: true,
        }));
      const updated = skipRecords.length > 0 ? [...filtered, ...skipRecords] : filtered;
      persistDayAssignments(updated);
      return updated;
    });
    setGoals((gs) => {
      if (goal?.cadence === "one-time" && remainingAssignments.length === 0) {
        const synced = gs.filter((g) => g.id !== goalId);
        persistGoals(synced);
        return synced;
      }
      const datesToClear = new Set(
        assignmentsToRemove
          .map((a) => getAssignmentOccurrenceDate(a))
          .filter((date) =>
            goal?.completedDates?.includes(date) &&
            !remainingAssignments.some((a) => getAssignmentOccurrenceDate(a) === date && a.completed),
          ),
      );
      if (datesToClear.size > 0) {
        const synced = gs.map((g) =>
          g.id === goalId
            ? { ...g, completedDates: (g.completedDates ?? []).filter((d) => !datesToClear.has(d)) }
            : g,
        );
        persistGoals(synced);
        return synced;
      }
      return gs;
    });
  }, [goals, plannerDayAssignments, persistDayAssignments, persistGoals]);

  const moveAssignment = useCallback((actionId: string, newIsoDate: string) => {
    setDayAssignments((prev) => {
      const assignmentsToMove = resolveAssignmentsForAction(prev, actionId);
      if (assignmentsToMove.length === 0) return prev;
      const currentDate = assignmentsToMove[0].date;
      if (currentDate === newIsoDate && assignmentsToMove.every((a) => a.date === newIsoDate)) return prev;
      const goal = goals.find((g) => g.id === assignmentsToMove[0].goalId);
      if (!goal) return prev;
      const firstOccurrenceDate = getGoalOccurrenceDateForPlannerDate(goal, newIsoDate, {
        scheduledTime: assignmentsToMove[0].scheduledTime,
        zmanim: getZmanimForDate(newIsoDate, preferences),
      });
      if (!isGoalApplicableOnDate(goal, firstOccurrenceDate, { excludedByGoal, mode: "manual" })) return prev;
      const assignmentIdsToMove = new Set(assignmentsToMove.map((a) => a.id));
      const replacedOwner = assignmentsToMove.find((a) => a.replacedAutoDate);
      let replacedAutoDate = replacedOwner?.replacedAutoDate;
      if (!replacedAutoDate && goal.cadence === "weekly" && goal.activeDays?.length) {
        const srcDayKey = DAY_KEYS[new Date(currentDate + "T00:00:00").getDay()];
        if (goal.activeDays.includes(srcDayKey)) replacedAutoDate = currentDate;
      }
      const replacedOwnerId = replacedOwner?.id ?? assignmentsToMove[0].id;
      const updated = prev.map((a) => {
        if (!assignmentIdsToMove.has(a.id)) return a;
        const occurrenceDate = getGoalOccurrenceDateForPlannerDate(goal, newIsoDate, {
          scheduledTime: a.scheduledTime,
          zmanim: getZmanimForDate(newIsoDate, preferences),
        });
        if (a.id === replacedOwnerId) {
          return {
            ...a,
            date: newIsoDate,
            occurrenceDate: occurrenceDate === newIsoDate ? undefined : occurrenceDate,
            replacedAutoDate,
          };
        }
        return {
          ...a,
          date: newIsoDate,
          occurrenceDate: occurrenceDate === newIsoDate ? undefined : occurrenceDate,
          replacedAutoDate: undefined,
        };
      });
      persistDayAssignments(updated);
      return updated;
    });
  }, [excludedByGoal, goals, persistDayAssignments, preferences]);

  const syncCaveatFollowup = useCallback((isoDate: string, caveat: GoalTimeCaveat | null) => {
    const result = syncTimeCaveatFollowup(goalsRef.current, dayAssignmentsRef.current, isoDate, caveat);
    if (result.goals !== goalsRef.current) {
      setGoals(result.goals);
      persistGoals(result.goals);
    }
    if (result.dayAssignments !== dayAssignmentsRef.current) {
      setDayAssignments(result.dayAssignments);
      persistDayAssignments(result.dayAssignments);
    }
  }, [persistDayAssignments, persistGoals]);

  const applyCompletionTimeCaveat = useCallback((goal: Goal, isoDate: string, time: string) => {
    if (isoDate !== toIsoDate(new Date())) return;
    const location = resolveLocation(preferences);
    const zmanim = location
      ? computeDayZmanim(new Date(`${isoDate}T00:00:00`), location, preferences.timeFormat) ?? undefined
      : undefined;
    const placement = getGoalTimePlacementForTime(goal, zmanim, time);
    if (placement.caveat) syncCaveatFollowup(isoDate, placement.caveat);
    else if (goal.id === MAARIV_GOAL_ID) syncCaveatFollowup(isoDate, null);
  }, [syncCaveatFollowup, preferences]);

  const toggleAssignment = useCallback((id: string) => {
    const initialAssignmentsToToggle = resolveAssignmentsForAction(plannerDayAssignments, id);
    if (initialAssignmentsToToggle.length === 0) return;
    const initialAssignment = initialAssignmentsToToggle[0];
    const goal = goals.find((g) => g.id === initialAssignment.goalId);
    const nowCompleted = !initialAssignmentsToToggle.every((item) => item.completed);
    const occurrenceDatesToToggle = goal?.cadence === "daily" && goal.type === "binary"
      ? new Set(initialAssignmentsToToggle.map((item) => getAssignmentOccurrenceDate(item)))
      : null;
    const assignmentsToToggle = occurrenceDatesToToggle && goal
      ? plannerDayAssignments.filter(
          (item) =>
            item.goalId === initialAssignment.goalId &&
            occurrenceDatesToToggle.has(getAssignmentOccurrenceDate(item)) &&
            !item.skipped,
        )
      : initialAssignmentsToToggle;
    if (assignmentsToToggle.length === 0) return;
    const assignmentIdsToToggle = new Set(assignmentsToToggle.map((a) => a.id));
    const assignment = initialAssignment;
    const isReopeningCollapsedGroup = Boolean(
      parseSessionGroupActionId(id) &&
      !nowCompleted &&
      initialAssignmentsToToggle.length > 1 &&
      initialAssignmentsToToggle.every((item) => item.completed),
    );

    // Keep completedDates in sync for daily binary goals.
    // Always use a functional update so idempotency is checked against fresh state,
    // not the stale closure — the old guard (nowCompleted !== alreadyInDates) could
    // silently skip the write if the closure's goal snapshot was already out of date.
    if (goal?.cadence === "daily" && goal?.type === "binary") {
      const toggleDates = [...new Set(assignmentsToToggle.map((item) => getAssignmentOccurrenceDate(item)))];
      setGoals((prev) => {
        const g = prev.find((item) => item.id === assignment.goalId);
        if (!g) return prev;
        const dates = g.completedDates ?? [];
        let newDates: string[];
        if (nowCompleted) {
          const toAdd = toggleDates.filter((d) => !dates.includes(d));
          if (toAdd.length === 0) return prev; // already up to date — true idempotency on fresh state
          newDates = [...dates, ...toAdd];
        } else {
          newDates = dates.filter((date) =>
            !toggleDates.includes(date) ||
            plannerDayAssignments.some(
              (item) =>
                item.goalId === assignment.goalId &&
                getAssignmentOccurrenceDate(item) === date &&
                item.completed &&
                !assignmentIdsToToggle.has(item.id),
            ),
          );
          if (newDates.length === dates.length) return prev; // nothing to remove
        }
        const updated = prev.map((item) =>
          item.id === assignment.goalId ? { ...item, completedDates: newDates } : item,
        );
        persistGoals(updated);
        return updated;
      });
    }

    // Intercept quantified completions — show amount prompt
    if (nowCompleted && goal?.type === "quantified" && assignmentsToToggle.length === 1) {
      const def = assignment.targetAmount ?? suggestedAssignmentAmount(goal);
      setAmountPrompt({ kind: "completion", id, defaultAmount: def, date: assignment.date });
      return;
    }

    const timeStr = currentTimeString();
    const completionTime = assignment.scheduledTime ?? timeStr;
    if (nowCompleted && goal) {
      applyCompletionTimeCaveat(goal, assignment.date, completionTime);
    }

    // Feed progress to parent project goal
    if (goal?.parentGoalId) {
      const fallbackAmount = goal.target ?? 1;
      const delta = nowCompleted
        ? sumAssignmentAmounts(assignmentsToToggle, fallbackAmount)
        : -sumAssignmentAmounts(assignmentsToToggle, fallbackAmount);
      setGoals((prev) => {
        const updated = updateParentProgress(prev, goal.parentGoalId!, delta);
        persistGoals(updated);
        return updated;
      });
    }

    const isPastDay = assignment.date < toIsoDate(new Date());

    const completedAfterWindow = (() => {
      if (!nowCompleted || !goal?.expiresAt) return false;
      if (isPastDay) {
        // Past day with an existing placed time: evaluate that time against that day's window.
        // No placed time: retroactive — we can't confirm timing, so mark Late.
        if (!assignment.scheduledTime) return true;
        const fakeNow = new Date(`${assignment.date}T${assignment.scheduledTime}:00`);
        const zmanim = getZmanimForDate(assignment.date, preferences);
        return getGoalTimeStateForNow(goal, zmanim ?? undefined, true, fakeNow) === "expired";
      }
      const zmanim = getZmanimForDate(assignment.date, preferences);
      return getGoalTimeStateForNow(goal, zmanim ?? undefined, true, new Date()) === "expired";
    })();

    setDayAssignments((prev) => {
      if (isReopeningCollapsedGroup) {
        const updated = reopenCollapsedSessionGroupAsSingleAssignment(prev, id);
        persistDayAssignments(updated);
        return updated;
      }
      const updated = prev.map((a) => {
        if (!assignmentIdsToToggle.has(a.id)) return a;
        if (!nowCompleted) return { ...a, completed: false, completedAt: undefined, completedAfterWindow: undefined };
        // Preserve existing scheduledTime only if the user explicitly placed it on the timeline.
        // Checkbox completion records completedAt but does not auto-schedule the item.
        const completedAt = isPastDay ? a.completedAt : timeStr;
        return { ...a, completed: true, completedAt, completedAfterWindow: completedAfterWindow || undefined };
      });
      persistDayAssignments(updated);
      return updated;
    });
  }, [
    plannerDayAssignments,
    goals,
    preferences,
    persistGoals,
    persistDayAssignments,
    applyCompletionTimeCaveat,
  ]);

  const setScheduledTime = useCallback((assignmentId: string, time: string | null) => {
    setDayAssignments((prev) => {
      const updated = prev.map((a) => {
        if (a.id !== assignmentId) return a;
        const goal = goals.find((entry) => entry.id === a.goalId);
        const occurrenceDate = goal
          ? getGoalOccurrenceDateForPlannerDate(goal, a.date, {
              scheduledTime: time ?? undefined,
              zmanim: getZmanimForDate(a.date, preferences),
            })
          : getAssignmentOccurrenceDate(a);
        // When placing a completed item at a specific time, recompute completedAfterWindow
        // against that time and that day's zmanim — so dragging to 8am clears Late.
        const newCompletedAfterWindow = (() => {
          if (!a.completed || !time || !goal?.expiresAt) return a.completedAfterWindow;
          const fakeNow = new Date(`${a.date}T${time}:00`);
          const zmanim = getZmanimForDate(a.date, preferences) ?? undefined;
          return getGoalTimeStateForNow(goal, zmanim, true, fakeNow) === "expired" ? true : undefined;
        })();
        return {
          ...a,
          occurrenceDate: occurrenceDate === a.date ? undefined : occurrenceDate,
          periodKey: goal ? computePeriodKey(goal.cadence, new Date(`${occurrenceDate}T00:00:00`)) : a.periodKey,
          scheduledTime: time ?? undefined,
          completedAt: a.completed && time ? time : a.completedAt,
          completedAfterWindow: newCompletedAfterWindow,
        };
      });
      persistDayAssignments(updated);
      return updated;
    });
  }, [goals, persistDayAssignments, preferences]);

  const unscheduleAssignment = useCallback((assignmentId: string) => {
    setDayAssignments((prev) => {
      const updated = prev.map((a) => {
        if (a.id !== assignmentId) return a;
        const goal = goals.find((g) => g.id === a.goalId);
        // Completed past-day item with a window: removing the time means we can no longer
        // confirm it was done within the window, so restore Late.
        const completedAfterWindow = a.completed && goal?.expiresAt && a.date < toIsoDate(new Date())
          ? true
          : a.completedAfterWindow;
        return { ...a, occurrenceDate: undefined, scheduledTime: undefined, durationMins: undefined, completedAfterWindow };
      });
      persistDayAssignments(updated);
      return updated;
    });
  }, [goals, persistDayAssignments]);

  const setDuration = useCallback((assignmentId: string, durationMins: number) => {
    setDayAssignments((prev) => {
      const updated = prev.map((a) => a.id === assignmentId ? { ...a, durationMins } : a);
      persistDayAssignments(updated);
      return updated;
    });
  }, [persistDayAssignments]);

  const reorderGoals = useCallback((prevDayIds: string[], newDayIds: string[]) => {
    setGoalOrder((prev) => {
      const next = reorderGlobal(prev, prevDayIds, newDayIds);
      persistGoalOrder(next);
      return next;
    });
  }, [persistGoalOrder]);

  const renameGoal = useCallback((goalId: string, nextTitle: string) => {
    if (!nextTitle.trim()) return;
    setGoals((prev) => {
      const updated = prev.map((g) => g.id === goalId ? { ...g, title: nextTitle } : g);
      persistGoals(updated);
      return updated;
    });
  }, [persistGoals]);

  const addTask = useCallback((title: string, isoDate: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newGoal: Goal = { id, title, cadence: "one-time", type: "binary", status: "ongoing", adhoc: true };
    setGoals((prev) => {
      const updated = [...prev, newGoal];
      persistGoals(updated);
      return updated;
    });
    setDayAssignments((prev) => {
      const updated = [...prev, createAssignment(id, isoDate)];
      persistDayAssignments(updated);
      return updated;
    });
  }, [persistGoals, persistDayAssignments]);

  const toggleDate = useCallback((
    goalId: string,
    isoDate: string,
    source: "checklist" | "default" = "default",
  ) => {
    const goal = goals.find((g) => g.id === goalId);
    const occurrenceDate = isoDate;
    const plannerIso = source === "checklist" ? calendar.selectedDateIso : isoDate;
    const isDone = goal?.completedDates?.includes(occurrenceDate) ?? false;

    if (!isDone && goal?.type === "quantified") {
      setAmountPrompt({ kind: "date-completion", goalId, isoDate: occurrenceDate, defaultAmount: suggestedAssignmentAmount(goal), source });
      return;
    }

    if (!isDone && goal && source === "checklist") {
      const timeStr = currentTimeString();
      applyCompletionTimeCaveat(goal, plannerIso, timeStr);
      const periodKey = goal.cadence === "daily"
        ? undefined
        : computePeriodKey(goal.cadence, new Date(occurrenceDate + "T00:00:00"));
      const isPastChecklist = plannerIso < toIsoDate(new Date());
      const afterWindow = (() => {
        if (!goal.expiresAt) return false;
        if (isPastChecklist) return true; // retroactive — no time to evaluate
        const zmanim = getZmanimForDate(plannerIso, preferences);
        return getGoalTimeStateForNow(goal, zmanim ?? undefined, true, new Date()) === "expired";
      })();
      setDayAssignments((prev) => {
        const isDuplicate = goal.type !== "quantified" && prev.some(
          (a) => (
            a.goalId === goalId &&
            a.date === plannerIso &&
            getAssignmentOccurrenceDate(a) === occurrenceDate &&
            !a.skipped
          ),
        );
        if (isDuplicate) return prev;
        const updated = [
          ...prev,
          {
            ...createAssignment(
              goalId,
              plannerIso,
              undefined,
              periodKey,
              undefined,
              undefined,       // no scheduledTime — user didn't explicitly place on timeline
              undefined,       // no durationMins
              undefined,
              undefined,
              occurrenceDate === plannerIso ? undefined : occurrenceDate,
            ),
            completed: true,
            completedAt: isPastChecklist ? undefined : timeStr,
            completedAfterWindow: afterWindow || undefined,
          },
        ];
        persistDayAssignments(updated);
        return updated;
      });
      if (goal.cadence === "daily" && goal.type === "binary") {
        setGoals((prev) => {
          const updated = toggleGoalDate(prev, goalId, occurrenceDate);
          persistGoals(updated);
          return updated;
        });
      }
      return;
    }

    if (!isDone && goal) {
      applyCompletionTimeCaveat(goal, plannerIso, currentTimeString());
    }

    setGoals((prev) => {
      const updated = toggleGoalDate(prev, goalId, occurrenceDate);
      persistGoals(updated);
      return updated;
    });
  }, [calendar.selectedDateIso, goals, preferences.timelineDefaultDurationMins, persistDayAssignments, persistGoals, applyCompletionTimeCaveat]);

  // ── Pending modal confirmations ────────────────────────────────────────────

  const confirmAmountPrompt = useCallback((amount: number) => {
    if (!amountPrompt) return;
    const prompt = amountPrompt;
    setAmountPrompt(null);

    if (prompt.kind === "assignment") {
      const { goalId, isoDate, replacedAutoDate } = prompt;
      const goal = goals.find((g) => g.id === goalId);
      const periodKey = goal ? computePeriodKey(goal.cadence, new Date(isoDate + "T00:00:00")) : undefined;
      assign(goalId, isoDate, amount, periodKey, replacedAutoDate);
      return;
    }

    if (prompt.kind === "completion") {
      const id = prompt.id;
      const assignment = plannerDayAssignments.find((a) => a.id === id);
      const goal = assignment ? goals.find((g) => g.id === assignment.goalId) : undefined;
      if (!goal || !assignment) return;
      const completionTimeForCaveat = assignment.scheduledTime ?? currentTimeString();
      applyCompletionTimeCaveat(goal, assignment.date, completionTimeForCaveat);
      setDayAssignments((prev) => {
        const original = prev.find((a) => a.id === id);
        if (!original) return prev;
        const originalGoal = goals.find((g) => g.id === original.goalId);
        if (!originalGoal) return prev;
        const timeStr = currentTimeString();
        const completionTime = original.scheduledTime ?? timeStr;
        const updated = applyQuantifiedAssignmentCompletion({
          assignments: prev,
          assignmentId: id,
          goal: originalGoal,
          amount,
          completedAt: completionTime,
        });
        const synced = updated.map((a) => {
          if (a.id !== original.id || !a.completed) return a;
          return { ...a, scheduledTime: completionTime, durationMins: a.durationMins ?? preferences.timelineDefaultDurationMins };
        });
        persistDayAssignments(synced);
        return synced;
      });
      if (goal.parentGoalId) {
        setGoals((prev) => {
          const updated = updateParentProgress(prev, goal.parentGoalId!, amount);
          persistGoals(updated);
          return updated;
        });
      }
      return;
    }

    const { goalId, isoDate, source } = prompt;
    const occurrenceDate = isoDate;
    const plannerIso = source === "checklist" ? calendar.selectedDateIso : isoDate;
    const goal = goals.find((g) => g.id === goalId);
    const periodKey = goal ? computePeriodKey(goal.cadence, new Date(occurrenceDate + "T00:00:00")) : undefined;
    const timeStr = currentTimeString();
    if (goal) applyCompletionTimeCaveat(goal, plannerIso, timeStr);
    setDayAssignments((prev) => {
      if (prev.some((a) => a.goalId === goalId && a.date === plannerIso && getAssignmentOccurrenceDate(a) === occurrenceDate)) return prev;
      const newAssignment: DayAssignment = {
        id: createDayAssignmentId(),
        goalId,
        date: plannerIso,
        occurrenceDate: occurrenceDate === plannerIso ? undefined : occurrenceDate,
        targetAmount: amount,
        periodKey: periodKey ?? undefined,
        completed: true,
        scheduledTime: source === "checklist" ? timeStr : undefined,
        durationMins: source === "checklist" ? preferences.timelineDefaultDurationMins : undefined,
        completedAt: timeStr,
      };
      const updated = [...prev, newAssignment];
      persistDayAssignments(updated);
      return updated;
    });
  }, [amountPrompt, calendar.selectedDateIso, goals, assign, plannerDayAssignments, preferences.timelineDefaultDurationMins, persistDayAssignments, persistGoals, applyCompletionTimeCaveat]);

  const clearPending = useCallback(() => {
    setAmountPrompt(null);
    setCapBlockedGoalId(null);
  }, []);

  const assignAlreadyCompleted = useCallback((
    goalId: string,
    isoDate: string,
    periodKey: string | undefined,
    scheduledTime: string,
    durationMins: number,
  ) => {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    const occurrenceDate = getGoalOccurrenceDateForPlannerDate(goal, isoDate, {
      scheduledTime,
      zmanim: getZmanimForDate(isoDate, preferences),
    });
    setDayAssignments((prev) => {
      const isDuplicate = goal.type !== "quantified" && prev.some(
        (a) => a.goalId === goalId && a.date === isoDate && getAssignmentOccurrenceDate(a) === occurrenceDate && !a.skipped,
      );
      if (isDuplicate) return prev;
      const updated = [
        ...prev,
        {
          ...createAssignment(
            goalId,
            isoDate,
            undefined,
            periodKey ?? computePeriodKey(goal.cadence, new Date(`${occurrenceDate}T00:00:00`)),
            undefined,
            scheduledTime,
            durationMins,
            undefined,
            undefined,
            occurrenceDate === isoDate ? undefined : occurrenceDate,
          ),
          completed: true,
          completedAt: scheduledTime,
        },
      ];
      persistDayAssignments(updated);
      return updated;
    });
  }, [goals, persistDayAssignments, preferences]);

  const openCapBlockedModal = useCallback((goalId: string) => setCapBlockedGoalId(goalId), []);
  const openAssignmentModal = useCallback((pa: PendingAssignment) => {
    setAmountPrompt({ kind: "assignment", ...pa });
  }, []);

  // ── Return ─────────────────────────────────────────────────────────────────
  const capBlockedGoal = capBlockedGoalId ? goals.find((g) => g.id === capBlockedGoalId) ?? null : null;

  return {
    goals,
    assignments: plannerDayAssignments,
    goalOrder,
    isLoading: !isLoaded,
    excludedByGoal,
    metadataByDate,
    amountPrompt,
    capBlockedGoal,
    assign,
    assignWithTime,
    assignReplacing,
    unassign,
    moveAssignment,
    toggleAssignment,
    toggleDate,
    setScheduledTime,
    unscheduleAssignment,
    setDuration,
    reorderGoals,
    renameGoal,
    addTask,
    confirmAmountPrompt,
    clearPending,
    openCapBlockedModal,
    openAssignmentModal,
    assignAlreadyCompleted,
    syncTimeCaveatFollowup: syncCaveatFollowup,
  };
}
