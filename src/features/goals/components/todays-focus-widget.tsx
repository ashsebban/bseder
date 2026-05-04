"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildGoalOccurrencesForDate, sortGoalOccurrences, type GoalOccurrence } from "@/features/calendar/lib/goal-occurrences";
import { getGoalTimePlacementForNow, getGoalTimeStateForNow, isGoalOutsideTimeWindow, MAARIV_GOAL_ID, type GoalTimeCaveat } from "@/features/calendar/lib/goal-time-window";
import { getAssignmentOccurrenceDate } from "@/features/calendar/lib/goal-day";
import { syncTimeCaveatFollowup } from "@/features/calendar/lib/time-caveat-followups";
import { resolveLocation } from "@/features/calendar/lib/locations";
import { computeDayZmanim, type DayZmanim } from "@/features/calendar/lib/zmanim";
import { OccurrenceItem } from "@/features/planner/components/occurrence-item";
import {
  applyQuantifiedAssignmentCompletion,
  reopenCollapsedSessionGroupAsSingleAssignment,
  resolveAssignmentsForAction,
  suggestedAssignmentAmount,
  sumAssignmentAmounts,
} from "@/features/calendar/lib/assignment-actions";
import { CompletionCount } from "@/features/planner/components/completion-status";
import { PlannerModalCard } from "@/features/planner/components/planner-modal-card";
import { TimeWindowConfirm } from "@/features/planner/components/time-window-confirm";
import {
  GOALS_STORAGE_UPDATED_EVENT,
  loadGoals,
  saveGoals,
  type GoalsStorageUpdatedDetail,
} from "@/features/goals/lib/goal-store";
import {
  buildExcludedDates,
} from "@/features/goals/lib/goal-progress";
import { toggleGoalDate, updateParentProgress } from "@/features/goals/lib/goal-mutations";
import type { Goal } from "@/features/goals/types/goal";
import {
  DAY_ASSIGNMENTS_STORAGE_UPDATED_EVENT,
  areDayAssignmentsEqual,
  loadDayAssignments,
  saveDayAssignments,
  type DayAssignment,
  type DayAssignmentsStorageUpdatedDetail,
} from "@/features/planner/lib/day-assignment-store";
import {
  GOAL_ORDER_STORAGE_UPDATED_EVENT,
  loadGoalOrder,
  type GoalOrderStorageUpdatedDetail,
} from "@/features/planner/lib/goal-order-store";
import { parseSessionGroupActionId } from "@/features/planner/lib/day-assignment-groups";
import { materializePlannerWeekAssignments } from "@/features/planner/lib/materialize-goal-assignments";
import { computePeriodKey } from "@/features/planner/lib/period-key";
import { useCalendarPreferences } from "@/features/settings/hooks/use-calendar-preferences";
import { cn } from "@/lib/cn";
import { createAssignment } from "@/features/planner/lib/day-assignment-store";
import { endOfWeek, startOfDay, startOfWeek, toIsoDate } from "@/lib/date";

type PendingFocusAmount =
  | {
      kind: "assignment";
      assignmentId: string;
      goalId: string;
      defaultAmount: number;
      completedAfterWindow?: boolean;
    }
  | {
      kind: "date";
      goalId: string;
      isoDate: string;
      defaultAmount: number;
      completedAfterWindow?: boolean;
    };

type PendingMissedOverride = {
  item: GoalOccurrence;
  timeState: "not-yet" | "expired";
  caveat?: GoalTimeCaveat;
};

function getOccurrenceTimeWindowGoal(item: GoalOccurrence): Goal {
  return item.goal;
}

function currentTimeString(): string {
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function AmountPrompt({
  goal,
  defaultAmount,
  onConfirm,
  onCancel,
}: {
  goal: Goal;
  defaultAmount: number;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(() => String(Math.max(1, defaultAmount)));

  return (
    <PlannerModalCard
      title={`How many ${goal.targetUnit ?? "units"}?`}
      subtitle={<span className="font-semibold">{goal.title}</span>}
      onClose={onCancel}
      widthClassName="w-72"
      actions={[
        { label: "Cancel", onClick: onCancel, variant: "secondary" },
        { label: "Complete", onClick: () => onConfirm(Math.max(1, Number(value) || 1)), variant: "primary" },
      ]}
    >
      <div className="mt-4 flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onConfirm(Math.max(1, Number(value) || 1));
            if (event.key === "Escape") onCancel();
          }}
          className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-semibold text-slate-800 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/15"
          autoFocus
        />
        {goal.targetUnit ? (
          <span className="text-[12px] text-slate-500">{goal.targetUnit}</span>
        ) : null}
      </div>
    </PlannerModalCard>
  );
}


function useFocusStorageState(storageScope: string) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dayAssignments, setDayAssignments] = useState<DayAssignment[]>([]);
  const [goalOrder, setGoalOrder] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const goalsSnapshotRef = useRef("[]");
  const assignmentsSnapshotRef = useRef("[]");
  const goalOrderSnapshotRef = useRef("[]");

  useEffect(() => {
    goalsSnapshotRef.current = JSON.stringify(goals);
  }, [goals]);

  useEffect(() => {
    assignmentsSnapshotRef.current = JSON.stringify(dayAssignments);
  }, [dayAssignments]);

  useEffect(() => {
    goalOrderSnapshotRef.current = JSON.stringify(goalOrder);
  }, [goalOrder]);

  useEffect(() => {
    if (!storageScope) {
      setGoals([]);
      setDayAssignments([]);
      setGoalOrder([]);
      setLoaded(true);
      return;
    }

    setGoals(loadGoals(storageScope));
    setDayAssignments(loadDayAssignments(storageScope));
    setGoalOrder(loadGoalOrder(storageScope));
    setLoaded(true);

    function handleGoalsUpdated(event: Event) {
      const detail = (event as CustomEvent<GoalsStorageUpdatedDetail>).detail;
      if (!detail || detail.storageScope !== storageScope) return;
      const snapshot = JSON.stringify(detail.goals);
      if (snapshot === goalsSnapshotRef.current) return;
      setGoals(detail.goals);
    }

    function handleAssignmentsUpdated(event: Event) {
      const detail = (event as CustomEvent<DayAssignmentsStorageUpdatedDetail>).detail;
      if (!detail || detail.storageScope !== storageScope) return;
      const snapshot = JSON.stringify(detail.assignments);
      if (snapshot === assignmentsSnapshotRef.current) return;
      setDayAssignments(detail.assignments);
    }

    function handleGoalOrderUpdated(event: Event) {
      const detail = (event as CustomEvent<GoalOrderStorageUpdatedDetail>).detail;
      if (!detail || detail.storageScope !== storageScope) return;
      const snapshot = JSON.stringify(detail.order);
      if (snapshot === goalOrderSnapshotRef.current) return;
      setGoalOrder(detail.order);
    }

    function handleStorage() {
      setGoals(loadGoals(storageScope));
      setDayAssignments(loadDayAssignments(storageScope));
      setGoalOrder(loadGoalOrder(storageScope));
    }

    window.addEventListener(GOALS_STORAGE_UPDATED_EVENT, handleGoalsUpdated as EventListener);
    window.addEventListener(DAY_ASSIGNMENTS_STORAGE_UPDATED_EVENT, handleAssignmentsUpdated as EventListener);
    window.addEventListener(GOAL_ORDER_STORAGE_UPDATED_EVENT, handleGoalOrderUpdated as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(GOALS_STORAGE_UPDATED_EVENT, handleGoalsUpdated as EventListener);
      window.removeEventListener(DAY_ASSIGNMENTS_STORAGE_UPDATED_EVENT, handleAssignmentsUpdated as EventListener);
      window.removeEventListener(GOAL_ORDER_STORAGE_UPDATED_EVENT, handleGoalOrderUpdated as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, [storageScope]);

  return {
    goals,
    setGoals,
    dayAssignments,
    setDayAssignments,
    goalOrder,
    loaded,
  };
}

function FocusProgressBar({
  completed,
  missed,
  total,
}: {
  completed: number;
  missed: number;
  total: number;
}) {
  if (total === 0) return <div className="h-1.5 rounded-full bg-slate-100" />;
  const completedPct = (completed / total) * 100;
  const missedPct = (missed / total) * 100;
  const remainingPct = Math.max(0, 100 - completedPct - missedPct);

  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100">
      {completedPct > 0 ? <div className="bg-emerald-500" style={{ width: `${completedPct}%` }} /> : null}
      {missedPct > 0 ? <div className="bg-red-400" style={{ width: `${missedPct}%` }} /> : null}
      {remainingPct > 0 ? <div className="bg-slate-200" style={{ width: `${remainingPct}%` }} /> : null}
    </div>
  );
}

function FocusSectionHeader({
  label,
  count,
  className,
}: {
  label: string;
  count: number;
  className?: string;
}) {
  return (
    <div className="mb-1 flex items-center justify-between px-2">
      <p className={cn("text-[9.5px] font-bold uppercase tracking-[0.16em] text-slate-400", className)}>
        {label}
      </p>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9.5px] font-bold tabular-nums text-slate-500">
        {count}
      </span>
    </div>
  );
}

export function TodaysFocusWidget({ storageScope }: { storageScope: string }) {
  const today = startOfDay(new Date());
  const todayIso = toIsoDate(today);
  const {
    goals,
    setGoals,
    dayAssignments,
    setDayAssignments,
    goalOrder,
    loaded,
  } = useFocusStorageState(storageScope);
  const { preferences } = useCalendarPreferences(undefined, storageScope);
  const [pendingAmount, setPendingAmount] = useState<PendingFocusAmount | null>(null);
  const [pendingMissedOverride, setPendingMissedOverride] = useState<PendingMissedOverride | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showMissed, setShowMissed] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const excludedByGoal = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const weekStart = startOfWeek(today);
    const weekEnd = endOfWeek(today);
    for (const goal of goals) {
      if (!goal.excludes?.categories?.length && !goal.excludes?.individual?.length) continue;
      map.set(
        goal.id,
        buildExcludedDates(
          weekStart,
          weekEnd,
          goal.excludes?.categories ?? [],
          goal.excludes?.individual ?? [],
        ),
      );
    }
    return map;
  }, [goals, today]);

  const plannerDayAssignments = useMemo(
    () => materializePlannerWeekAssignments(goals, dayAssignments, today, excludedByGoal, { now }),
    [dayAssignments, excludedByGoal, goals, now, today],
  );

  useEffect(() => {
    if (areDayAssignmentsEqual(plannerDayAssignments, dayAssignments) || !storageScope) return;
    setDayAssignments(plannerDayAssignments);
    saveDayAssignments(storageScope, plannerDayAssignments);
  }, [dayAssignments, plannerDayAssignments, setDayAssignments, storageScope]);

  const occurrences = useMemo(
    () => sortGoalOccurrences(
      buildGoalOccurrencesForDate({
        date: today,
        goals,
        dayAssignments: plannerDayAssignments,
      }),
      goalOrder,
    ),
    [excludedByGoal, goalOrder, goals, plannerDayAssignments, today],
  );

  const todayZmanim = useMemo(() => {
    const location = resolveLocation(preferences);
    if (!location) return null;
    return computeDayZmanim(today, location, preferences.timeFormat);
  }, [preferences, today]);

  function isMissedWindow(item: GoalOccurrence): boolean {
    if (item.completed) return false;
    // "Missed" = window already expired. "Not yet" stays in the active list.
    return getGoalTimeStateForNow(getOccurrenceTimeWindowGoal(item), todayZmanim ?? undefined, true, now) === "expired";
  }

  function isLaterWindow(item: GoalOccurrence): boolean {
    if (item.completed) return false;
    return getGoalTimeStateForNow(getOccurrenceTimeWindowGoal(item), todayZmanim ?? undefined, true, now) === "not-yet";
  }

  const completedCount = occurrences.filter((occurrence) => occurrence.completed).length;
  const incompleteOccurrences = occurrences.filter((occurrence) => !occurrence.completed);
  const availableOccurrences = incompleteOccurrences.filter((occurrence) => !isMissedWindow(occurrence));
  const readyOccurrences = availableOccurrences.filter((occurrence) => !isLaterWindow(occurrence));
  const laterOccurrences = availableOccurrences.filter((occurrence) => isLaterWindow(occurrence));
  const missedOccurrences = incompleteOccurrences.filter((occurrence) => isMissedWindow(occurrence));
  const completedOccurrences = occurrences.filter((occurrence) => occurrence.completed);

  function persistGoals(nextGoals: Goal[]) {
    setGoals(nextGoals);
    if (storageScope) saveGoals(storageScope, nextGoals);
  }

  function persistDayAssignments(nextAssignments: DayAssignment[]) {
    setDayAssignments(nextAssignments);
    if (storageScope) saveDayAssignments(storageScope, nextAssignments);
  }

  function applyOccurrenceTimeCaveat(item: GoalOccurrence) {
    const timeWindowGoal = getOccurrenceTimeWindowGoal(item);
    const placement = getGoalTimePlacementForNow(timeWindowGoal, todayZmanim ?? undefined, true, now);
    if (!placement.caveat && item.goal.id !== MAARIV_GOAL_ID) return;

    setGoals((currentGoals) => {
      const result = syncTimeCaveatFollowup(currentGoals, dayAssignments, todayIso, placement.caveat ?? null);
      if (result.goals !== currentGoals && storageScope) saveGoals(storageScope, result.goals);
      return result.goals;
    });
    setDayAssignments((currentAssignments) => {
      const result = syncTimeCaveatFollowup(goals, currentAssignments, todayIso, placement.caveat ?? null);
      if (result.dayAssignments !== currentAssignments && storageScope) {
        saveDayAssignments(storageScope, result.dayAssignments);
      }
      return result.dayAssignments;
    });
  }

  function handleToggleDate(goalId: string, occurrenceDate = todayIso, options?: { completedAfterWindow?: boolean }) {
    const goal = goals.find((entry) => entry.id === goalId);
    const isDone = goal?.completedDates?.includes(occurrenceDate) ?? false;

    if (!goal) return;

    if (!isDone && goal.type === "quantified") {
      setPendingAmount({
        kind: "date",
        goalId,
        isoDate: occurrenceDate,
        defaultAmount: suggestedAssignmentAmount(goal),
        completedAfterWindow: options?.completedAfterWindow,
      });
      return;
    }

    if (!isDone) {
      const timeStr = currentTimeString();
      const periodKey = goal.cadence === "daily"
        ? undefined
        : computePeriodKey(goal.cadence, new Date(`${occurrenceDate}T00:00:00`));

      if (!plannerDayAssignments.some((assignment) => assignment.goalId === goalId && assignment.date === todayIso && !assignment.skipped)) {
        persistDayAssignments([
          ...dayAssignments,
          {
            ...createAssignment(
              goalId,
              todayIso,
              undefined,
              periodKey,
              undefined,
              timeStr,
              preferences.timelineDefaultDurationMins,
              undefined,
              undefined,
              occurrenceDate === todayIso ? undefined : occurrenceDate,
            ),
            completed: true,
            completedAt: timeStr,
            completedAfterWindow: options?.completedAfterWindow,
          },
        ]);
      }
    }

    persistGoals(toggleGoalDate(goals, goalId, occurrenceDate));
  }

  function handleToggleAssignment(actionId: string, options?: { completedAfterWindow?: boolean }) {
    const assignmentsToToggle = resolveAssignmentsForAction(plannerDayAssignments, actionId);
    if (assignmentsToToggle.length === 0) return;

    const assignmentIdsToToggle = new Set(assignmentsToToggle.map((assignment) => assignment.id));
    const assignment = assignmentsToToggle[0];
    const goal = goals.find((entry) => entry.id === assignment.goalId);
    const nowCompleted = !assignmentsToToggle.every((entry) => entry.completed);
    const isReopeningCollapsedGroup = Boolean(
      parseSessionGroupActionId(actionId) &&
      !nowCompleted &&
      assignmentsToToggle.length > 1 &&
      assignmentsToToggle.every((entry) => entry.completed),
    );

    if (!goal) return;

    if (goal.cadence === "daily" && goal.type === "binary") {
      const toggleDates = [...new Set(assignmentsToToggle.map((entry) => getAssignmentOccurrenceDate(entry)))];
      const alreadyInDates = toggleDates.some((date) => goal.completedDates?.includes(date) ?? false);
      if (nowCompleted !== alreadyInDates) {
        persistGoals(
          goals.map((entry) => {
            if (entry.id !== assignment.goalId) return entry;
            const dates = entry.completedDates ?? [];
            let nextDates = [...dates];
            if (nowCompleted) {
              for (const date of toggleDates) {
                if (!nextDates.includes(date)) nextDates.push(date);
              }
            } else {
              nextDates = nextDates.filter((date) =>
                !toggleDates.includes(date) ||
                plannerDayAssignments.some(
                  (item) =>
                    item.goalId === assignment.goalId &&
                    getAssignmentOccurrenceDate(item) === date &&
                    item.completed &&
                    !assignmentIdsToToggle.has(item.id),
                ),
              );
            }
            return { ...entry, completedDates: nextDates };
          }),
        );
      }
    }

    if (nowCompleted && goal.type === "quantified" && assignmentsToToggle.length === 1) {
      setPendingAmount({
        kind: "assignment",
        assignmentId: assignment.id,
        goalId: goal.id,
        defaultAmount: assignment.targetAmount ?? suggestedAssignmentAmount(goal),
        completedAfterWindow: options?.completedAfterWindow,
      });
      return;
    }

    if (goal.parentGoalId) {
      const fallbackAmount = goal.target ?? 1;
      const delta = nowCompleted
        ? sumAssignmentAmounts(assignmentsToToggle, fallbackAmount)
        : -sumAssignmentAmounts(assignmentsToToggle, fallbackAmount);
      persistGoals(updateParentProgress(goals, goal.parentGoalId, delta));
    }

    if (isReopeningCollapsedGroup) {
      persistDayAssignments(reopenCollapsedSessionGroupAsSingleAssignment(dayAssignments, actionId));
      return;
    }

    const timeStr = currentTimeString();
    persistDayAssignments(dayAssignments.map((entry) => {
      if (!assignmentIdsToToggle.has(entry.id)) return entry;
      if (!nowCompleted) return { ...entry, completed: false, completedAt: undefined, completedAfterWindow: undefined };
      const completionTime = entry.scheduledTime ?? timeStr;
      return {
        ...entry,
        completed: true,
        scheduledTime: completionTime,
        completedAt: completionTime,
        completedAfterWindow: options?.completedAfterWindow,
      };
    }));
  }

  function toggleOccurrence(item: GoalOccurrence, options?: { completedAfterWindow?: boolean }) {
    const timeWindowGoal = getOccurrenceTimeWindowGoal(item);
    if (!options?.completedAfterWindow && !item.completed &&
        isGoalOutsideTimeWindow(timeWindowGoal, todayZmanim ?? undefined, true, now)) {
      const timeState = getGoalTimeStateForNow(timeWindowGoal, todayZmanim ?? undefined, true, now) as "not-yet" | "expired";
      const placement = getGoalTimePlacementForNow(timeWindowGoal, todayZmanim ?? undefined, true, now);
      setPendingMissedOverride({ item, timeState, caveat: placement.caveat });
      return;
    }
    if (item.source === "assignment") handleToggleAssignment(item.actionId, options);
    else handleToggleDate(item.goal.id, item.occurrenceDate, options);
    if (!item.completed) applyOccurrenceTimeCaveat(item);
  }

  function confirmPendingAmount(amount: number) {
    if (!pendingAmount) return;

    if (pendingAmount.kind === "assignment") {
      const assignment = plannerDayAssignments.find((entry) => entry.id === pendingAmount.assignmentId);
      const goal = goals.find((entry) => entry.id === pendingAmount.goalId);
      if (assignment && goal) {
        const completionTime = assignment.scheduledTime ?? currentTimeString();
        const updatedAssignments = applyQuantifiedAssignmentCompletion({
          assignments: dayAssignments,
          assignmentId: pendingAmount.assignmentId,
          goal,
          amount,
          completedAt: completionTime,
        }).map((entry) => {
          if (entry.id !== pendingAmount.assignmentId || !entry.completed) return entry;
          return {
            ...entry,
            scheduledTime: completionTime,
            durationMins: entry.durationMins ?? preferences.timelineDefaultDurationMins,
            completedAfterWindow: pendingAmount.completedAfterWindow,
          };
        });
        persistDayAssignments(updatedAssignments);

        if (goal.parentGoalId) {
          persistGoals(updateParentProgress(goals, goal.parentGoalId, amount));
        }
      }
    } else {
      if (!dayAssignments.some((entry) => entry.goalId === pendingAmount.goalId && entry.date === pendingAmount.isoDate)) {
        persistDayAssignments([
          ...dayAssignments,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            goalId: pendingAmount.goalId,
            date: pendingAmount.isoDate,
            targetAmount: amount,
            periodKey: (() => {
              const goal = goals.find((entry) => entry.id === pendingAmount.goalId);
              return goal ? computePeriodKey(goal.cadence, new Date(`${pendingAmount.isoDate}T00:00:00`)) : undefined;
            })(),
            completed: true,
            scheduledTime: currentTimeString(),
            durationMins: preferences.timelineDefaultDurationMins,
            completedAt: currentTimeString(),
            completedAfterWindow: pendingAmount.completedAfterWindow,
          },
        ]);
      }
    }

    setPendingAmount(null);
  }

  const pendingGoal = pendingAmount ? goals.find((goal) => goal.id === pendingAmount.goalId) ?? null : null;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-slate-700">Today&apos;s Focus</p>
              <CompletionCount completedCount={completedCount} totalCount={occurrences.length} className="mt-1 block" />
            </div>
            <Link
              href={`/planner?view=day&date=${todayIso}`}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-line bg-surface px-4 text-sm font-semibold text-text transition duration-200 hover:border-brand/30 hover:bg-brand-soft/60"
            >
              Open Today
            </Link>
          </div>
          <FocusProgressBar completed={completedCount} missed={missedOccurrences.length} total={occurrences.length} />
        </div>
      </div>

      {!loaded ? (
        <div className="flex h-48 items-center justify-center px-5">
          <p className="text-center text-[11px] font-medium text-slate-300">Loading today&apos;s checklist…</p>
        </div>
      ) : occurrences.length === 0 ? (
        <div className="flex h-48 items-center justify-center px-5">
          <p className="text-center text-[11px] font-medium text-slate-300">Nothing is planned for today yet.</p>
        </div>
      ) : (
        <div className="h-48 overflow-y-auto px-3 py-3">
          {incompleteOccurrences.length === 0 ? (
            <p className="px-2 py-3 text-center text-[11px] font-medium text-slate-300">
              All done for today.
            </p>
          ) : null}
          {readyOccurrences.length === 0 && laterOccurrences.length > 0 ? (
            <p className="px-2 py-3 text-center text-[11px] font-medium text-slate-300">
              Nothing open right now. Later items are below.
            </p>
          ) : null}
          {availableOccurrences.length === 0 && incompleteOccurrences.length > 0 ? (
            <p className="px-2 py-3 text-center text-[11px] font-medium text-slate-300">
              Nothing still available right now.
            </p>
          ) : null}
          {readyOccurrences.length > 0 ? (
            <div className="space-y-2">
              <FocusSectionHeader label="Open now" count={readyOccurrences.length} className="text-emerald-600" />
              {readyOccurrences.map((item) => (
                <OccurrenceItem
                  key={item.id}
                  item={item}
                  density="comfortable"
                  isToday
                  now={now}
                  zmanim={todayZmanim ?? undefined}
                  timeFormat={preferences.timeFormat}
                  onToggle={() => toggleOccurrence(item)}
                />
              ))}
            </div>
          ) : null}
          {laterOccurrences.length > 0 ? (
            <div className={cn("space-y-2", readyOccurrences.length > 0 && "mt-2 border-t border-slate-100 pt-2")}>
              <FocusSectionHeader label="Later" count={laterOccurrences.length} />
              {laterOccurrences.map((item) => (
                <OccurrenceItem
                  key={item.id}
                  item={item}
                  density="comfortable"
                  isToday
                  now={now}
                  zmanim={todayZmanim ?? undefined}
                  timeFormat={preferences.timeFormat}
                  onToggle={() => toggleOccurrence(item)}
                />
              ))}
            </div>
          ) : null}
          {missedOccurrences.length > 0 ? (
            <div className={cn("mt-2", availableOccurrences.length > 0 && "border-t border-slate-100 pt-2")}>
              <button
                type="button"
                onClick={() => setShowMissed((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-[11px] font-semibold text-red-400 transition hover:bg-red-50 hover:text-red-500"
              >
                <span>{showMissed ? "Hide" : "Show"} missed</span>
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold tabular-nums text-red-500">
                  {missedOccurrences.length}
                </span>
              </button>
              {showMissed ? (
                <div className="mt-1 space-y-2">
                  {missedOccurrences.map((item) => (
                    <OccurrenceItem
                      key={item.id}
                      item={item}
                      density="comfortable"
                      isToday
                      now={now}
                      zmanim={todayZmanim ?? undefined}
                      timeFormat={preferences.timeFormat}
                      onToggle={() => toggleOccurrence(item)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {completedOccurrences.length > 0 ? (
            <div className={cn("mt-2", incompleteOccurrences.length > 0 && "border-t border-slate-100 pt-2")}>
              <button
                type="button"
                onClick={() => setShowCompleted((value) => !value)}
                className="flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-[11px] font-semibold text-emerald-600 transition hover:bg-emerald-50 hover:text-emerald-700"
              >
                <span>{showCompleted ? "Hide" : "Show"} completed</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold tabular-nums text-emerald-600">
                  {completedOccurrences.length}
                </span>
              </button>
              {showCompleted ? (
                <div className="mt-1 space-y-2">
                  {completedOccurrences.map((item) => (
                    <OccurrenceItem
                      key={item.id}
                      item={item}
                      density="comfortable"
                      isToday
                      now={now}
                      zmanim={todayZmanim ?? undefined}
                      timeFormat={preferences.timeFormat}
                      onToggle={() => toggleOccurrence(item)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {pendingGoal && pendingAmount ? (
        <AmountPrompt
          goal={pendingGoal}
          defaultAmount={pendingAmount.defaultAmount}
          onConfirm={confirmPendingAmount}
          onCancel={() => setPendingAmount(null)}
        />
      ) : null}
      {pendingMissedOverride ? (
        <TimeWindowConfirm
          goal={pendingMissedOverride.item.goal}
          timeState={pendingMissedOverride.timeState}
          caveat={pendingMissedOverride.caveat}
          onConfirm={() => {
            toggleOccurrence(pendingMissedOverride.item, { completedAfterWindow: true });
            setPendingMissedOverride(null);
          }}
          onCancel={() => setPendingMissedOverride(null)}
        />
      ) : null}
    </div>
  );
}
