"use client";

import { useState, useEffect, useCallback, useMemo, useLayoutEffect, useRef } from "react";
import type { Goal } from "@/features/goals/types/goal";
import type { DayAssignment } from "@/features/planner/lib/day-assignment-store";
import type { CalendarPreferences } from "@/features/settings/types/calendar-preferences";
import type { CalendarDayMetadata } from "@/features/calendar/types/calendar";
import { loadGoals, saveGoals } from "@/features/goals/lib/goal-store";
import {
  loadDayAssignments,
  saveDayAssignments,
  createAssignment,
  createDayAssignmentId,
  getPersistableDayAssignments,
} from "@/features/planner/lib/day-assignment-store";
import { loadGoalOrder, saveGoalOrder, reorderGlobal } from "@/features/planner/lib/goal-order-store";
import { buildExcludedDates, computeDayProgress } from "@/features/goals/lib/goal-progress";
import { DAY_KEYS, isGoalApplicableOnDate } from "@/features/goals/lib/goal-applicability";
import { materializePlannerWeekAssignments } from "@/features/planner/lib/materialize-goal-assignments";
import { buildAssignmentDisplayGroups, parseSessionGroupActionId } from "@/features/planner/lib/day-assignment-groups";
import { buildJewishTimesByDate } from "@/features/calendar/lib/jewish-times";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, toIsoDate } from "@/features/calendar/lib/date";
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
import {
  OMER_GOAL_ID,
  clearLegacyOmerState,
  readLegacyOmerState,
  syncOmerGoalInList,
} from "@/features/calendar/lib/omer-goal";
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
}

// ─── Module-level helpers ─────────────────────────────────────────────────────

function currentTimeString(): string {
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCalendarData({
  storageScope,
  calendar,
  preferences,
}: {
  storageScope: string;
  calendar: { selectedDate: Date; selectedDateIso: string };
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

  // ── Derived ranges (cheap, computed inline) ────────────────────────────────
  const monthRangeStart = startOfWeek(startOfMonth(calendar.selectedDate), preferences.weekStartsOn);
  const monthRangeEnd = endOfWeek(endOfMonth(calendar.selectedDate), preferences.weekStartsOn);

  // ── Persist helpers ────────────────────────────────────────────────────────
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
        setGoals(goalsResult.value.goals);
        persistGoals(goalsResult.value.goals);
      } else if (goalsResult.status === "rejected") {
        console.error("[use-calendar-data] fetch goals failed:", goalsResult.reason);
      }

      if (assignmentsResult.status === "fulfilled" && Array.isArray(assignmentsResult.value.assignments)) {
        setDayAssignments(assignmentsResult.value.assignments);
        persistDayAssignments(assignmentsResult.value.assignments);
      } else if (assignmentsResult.status === "rejected") {
        console.error("[use-calendar-data] fetch assignments failed:", assignmentsResult.reason);
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

  // ── Omer goal sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    const omerPresent = goals.some((g) => g.id === OMER_GOAL_ID);
    const next = syncOmerGoalInList(goals, omerPresent, calendar.selectedDate, readLegacyOmerState());
    if (next !== goals) {
      setGoals(next);
      persistGoals(next);
    }
    clearLegacyOmerState();
  }, [calendar.selectedDateIso, goals, isLoaded, persistGoals]);

  // ── Server sync (goals) ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !serverHydrated) return;
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
  }, [goals, isLoaded, serverHydrated]);

  // ── Server sync (assignments) ──────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !serverHydrated) return;
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
  }, [dayAssignments, isLoaded, serverHydrated]);

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
    () => materializePlannerWeekAssignments(goals, dayAssignments, calendar.selectedDate, excludedByGoal),
    [goals, dayAssignments, calendar.selectedDate, excludedByGoal],
  );

  useLayoutEffect(() => {
    if (plannerDayAssignments === dayAssignments) return;
    setDayAssignments(plannerDayAssignments);
    persistDayAssignments(plannerDayAssignments);
  }, [dayAssignments, plannerDayAssignments, persistDayAssignments]);

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
    if (!goal || !isGoalApplicableOnDate(goal, isoDate, { excludedByGoal, mode: "manual" })) return;
    setDayAssignments((prev) => {
      const isDuplicate = goal.type !== "quantified" && prev.some(
        (a) => a.goalId === goalId && a.date === isoDate && !a.skipped,
      );
      if (isDuplicate) return prev;
      if (goal.noGettingAhead && goal.target !== undefined) {
        const remaining = computeRemainingCapacity(goal, prev, calendar.selectedDate);
        const replacedContribution = replacedAutoDate && goal.activeDays?.length && goal.target
          ? Math.ceil(goal.target / goal.activeDays.length)
          : 0;
        if ((targetAmount ?? 1) > remaining + replacedContribution) return prev;
      }
      const updated = [...prev, createAssignment(goalId, isoDate, targetAmount, periodKey, replacedAutoDate, scheduledTime, durationMins)];
      persistDayAssignments(updated);
      return updated;
    });
  }, [calendar.selectedDate, excludedByGoal, goals, persistDayAssignments]);

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
          .map((a) => a.date)
          .filter((date) =>
            goal?.completedDates?.includes(date) &&
            !remainingAssignments.some((a) => a.date === date && a.completed),
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
      if (!goal || !isGoalApplicableOnDate(goal, newIsoDate, { excludedByGoal, mode: "manual" })) return prev;
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
        if (a.id === replacedOwnerId) return { ...a, date: newIsoDate, replacedAutoDate };
        return { ...a, date: newIsoDate, replacedAutoDate: undefined };
      });
      persistDayAssignments(updated);
      return updated;
    });
  }, [excludedByGoal, goals, persistDayAssignments]);

  const toggleAssignment = useCallback((id: string) => {
    const assignmentsToToggle = resolveAssignmentsForAction(plannerDayAssignments, id);
    if (assignmentsToToggle.length === 0) return;
    const assignmentIdsToToggle = new Set(assignmentsToToggle.map((a) => a.id));
    const assignment = assignmentsToToggle[0];
    const nowCompleted = !assignmentsToToggle.every((item) => item.completed);
    const isReopeningCollapsedGroup = Boolean(
      parseSessionGroupActionId(id) &&
      !nowCompleted &&
      assignmentsToToggle.length > 1 &&
      assignmentsToToggle.every((item) => item.completed),
    );
    const goal = goals.find((g) => g.id === assignment.goalId);

    // Keep completedDates in sync for daily binary goals
    if (goal?.cadence === "daily" && goal?.type === "binary") {
      const toggleDates = [...new Set(assignmentsToToggle.map((item) => item.date))];
      const alreadyInDates = toggleDates.some((date) => goal.completedDates?.includes(date) ?? false);
      if (nowCompleted !== alreadyInDates) {
        setGoals((prev) => {
          const updated = prev.map((g) => {
            if (g.id !== assignment.goalId) return g;
            const dates = g.completedDates ?? [];
            let newDates = [...dates];
            if (nowCompleted) {
              for (const date of toggleDates) {
                if (!newDates.includes(date)) newDates.push(date);
              }
            } else {
              newDates = newDates.filter((date) =>
                !toggleDates.includes(date) ||
                plannerDayAssignments.some(
                  (item) =>
                    item.goalId === assignment.goalId &&
                    item.date === date &&
                    item.completed &&
                    !assignmentIdsToToggle.has(item.id),
                ),
              );
            }
            return { ...g, completedDates: newDates };
          });
          persistGoals(updated);
          return updated;
        });
      }
    }

    // Intercept quantified completions — show amount prompt
    if (nowCompleted && goal?.type === "quantified" && assignmentsToToggle.length === 1) {
      const def = assignment.targetAmount ?? suggestedAssignmentAmount(goal);
      setAmountPrompt({ kind: "completion", id, defaultAmount: def, date: assignment.date });
      return;
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

    setDayAssignments((prev) => {
      const timeStr = currentTimeString();
      if (isReopeningCollapsedGroup) {
        const updated = reopenCollapsedSessionGroupAsSingleAssignment(prev, id);
        persistDayAssignments(updated);
        return updated;
      }
      const updated = prev.map((a) => {
        if (!assignmentIdsToToggle.has(a.id)) return a;
        if (!nowCompleted) return { ...a, completed: false, completedAt: undefined };
        const completionTime = a.scheduledTime ?? timeStr;
        return { ...a, completed: true, scheduledTime: completionTime, completedAt: completionTime };
      });
      persistDayAssignments(updated);
      return updated;
    });
  }, [plannerDayAssignments, goals, persistGoals, persistDayAssignments]);

  const setScheduledTime = useCallback((assignmentId: string, time: string | null) => {
    setDayAssignments((prev) => {
      const updated = prev.map((a) =>
        a.id === assignmentId
          ? {
              ...a,
              scheduledTime: time ?? undefined,
              completedAt: a.completed && time ? time : a.completedAt,
            }
          : a,
      );
      persistDayAssignments(updated);
      return updated;
    });
  }, [persistDayAssignments]);

  const unscheduleAssignment = useCallback((assignmentId: string) => {
    setDayAssignments((prev) => {
      const updated = prev.map((a) =>
        a.id === assignmentId ? { ...a, scheduledTime: undefined, durationMins: undefined } : a,
      );
      persistDayAssignments(updated);
      return updated;
    });
  }, [persistDayAssignments]);

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
    const isDone = goal?.completedDates?.includes(isoDate) ?? false;

    if (!isDone && goal?.type === "quantified") {
      setAmountPrompt({ kind: "date-completion", goalId, isoDate, defaultAmount: suggestedAssignmentAmount(goal), source });
      return;
    }

    if (!isDone && goal && source === "checklist") {
      const timeStr = currentTimeString();
      const periodKey = goal.cadence === "daily"
        ? undefined
        : computePeriodKey(goal.cadence, new Date(isoDate + "T00:00:00"));
      setDayAssignments((prev) => {
        const isDuplicate = goal.type !== "quantified" && prev.some(
          (a) => a.goalId === goalId && a.date === isoDate && !a.skipped,
        );
        if (isDuplicate) return prev;
        const updated = [
          ...prev,
          {
            ...createAssignment(goalId, isoDate, undefined, periodKey, undefined, timeStr, preferences.timelineDefaultDurationMins),
            completed: true,
            completedAt: timeStr,
          },
        ];
        persistDayAssignments(updated);
        return updated;
      });
      if (goal.cadence === "daily" && goal.type === "binary") {
        setGoals((prev) => {
          const updated = toggleGoalDate(prev, goalId, isoDate);
          persistGoals(updated);
          return updated;
        });
      }
      return;
    }

    setGoals((prev) => {
      const updated = toggleGoalDate(prev, goalId, isoDate);
      persistGoals(updated);
      return updated;
    });
  }, [goals, preferences.timelineDefaultDurationMins, persistDayAssignments, persistGoals]);

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
    const goal = goals.find((g) => g.id === goalId);
    const periodKey = goal ? computePeriodKey(goal.cadence, new Date(isoDate + "T00:00:00")) : undefined;
    const timeStr = currentTimeString();
    setDayAssignments((prev) => {
      if (prev.some((a) => a.goalId === goalId && a.date === isoDate)) return prev;
      const newAssignment: DayAssignment = {
        id: createDayAssignmentId(),
        goalId,
        date: isoDate,
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
  }, [amountPrompt, goals, assign, plannerDayAssignments, preferences.timelineDefaultDurationMins, persistDayAssignments, persistGoals]);

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
    setDayAssignments((prev) => {
      const isDuplicate = goal.type !== "quantified" && prev.some(
        (a) => a.goalId === goalId && a.date === isoDate && !a.skipped,
      );
      if (isDuplicate) return prev;
      const updated = [
        ...prev,
        {
          ...createAssignment(goalId, isoDate, undefined, periodKey, undefined, scheduledTime, durationMins),
          completed: true,
          completedAt: scheduledTime,
        },
      ];
      persistDayAssignments(updated);
      return updated;
    });
  }, [goals, persistDayAssignments]);

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
  };
}
