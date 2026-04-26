"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { GoalListRow } from "@/features/calendar/components/goal-list-row";
import { buildGoalOccurrencesForDate, sortGoalOccurrences, type GoalOccurrence } from "@/features/calendar/lib/goal-occurrences";
import { formatClockTime } from "@/features/calendar/lib/time-format";
import {
  applyQuantifiedAssignmentCompletion,
  reopenCollapsedSessionGroupAsSingleAssignment,
  resolveAssignmentsForAction,
  suggestedAssignmentAmount,
  sumAssignmentAmounts,
} from "@/features/calendar/lib/assignment-actions";
import { CompletionCount } from "@/components/planner/completion-status";
import { PlannerModalCard } from "@/components/planner/planner-modal-card";
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
    }
  | {
      kind: "date";
      goalId: string;
      isoDate: string;
      defaultAmount: number;
    };

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

function FocusOccurrenceRow({
  item,
  onToggle,
  timeFormat,
}: {
  item: GoalOccurrence;
  onToggle: () => void;
  timeFormat: "12h" | "24h";
}) {
  const timeLabel = item.source === "assignment" ? formatClockTime(item.assignment.scheduledTime, timeFormat) : null;
  const amountLabel = item.goal.type === "quantified" && item.displayAmount > 0
    ? `${item.displayAmount}${item.goal.targetUnit ? ` ${item.goal.targetUnit}` : ""}`
    : null;
  const subtitle = [item.programLabel, amountLabel].filter(Boolean).join(" · ");

  return (
    <GoalListRow
      density="comfortable"
      className={cn(
        "border-b border-slate-100/80 px-1 py-1 last:border-b-0",
        item.completed ? "bg-slate-50/40" : "hover:bg-slate-50/70",
      )}
      checkbox={(
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
            item.completed ? "border-success bg-success" : "border-slate-300 bg-white",
          )}
        >
          {item.completed ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
        </button>
      )}
      content={(
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-[13.5px] font-semibold leading-tight text-slate-800",
              item.completed && "text-slate-400 line-through decoration-slate-300",
            )}
          >
            {item.goal.title}
          </p>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] text-slate-400">{subtitle}</p>
          ) : null}
        </div>
      )}
      trailing={timeLabel ? (
        <span className="shrink-0 rounded-full border border-brand/15 bg-brand/[0.08] px-2 py-[2px] text-[9.5px] font-semibold text-brand/75">
          {timeLabel}
        </span>
      ) : undefined}
    />
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
    () => materializePlannerWeekAssignments(goals, dayAssignments, today, excludedByGoal),
    [dayAssignments, excludedByGoal, goals, today],
  );

  useEffect(() => {
    if (plannerDayAssignments === dayAssignments || !storageScope) return;
    setDayAssignments(plannerDayAssignments);
    saveDayAssignments(storageScope, plannerDayAssignments);
  }, [dayAssignments, plannerDayAssignments, setDayAssignments, storageScope]);

  const occurrences = useMemo(
    () => sortGoalOccurrences(
      buildGoalOccurrencesForDate({
        date: today,
        goals,
        dayAssignments: plannerDayAssignments,
        excludedByGoal,
      }),
      goalOrder,
    ),
    [excludedByGoal, goalOrder, goals, plannerDayAssignments, today],
  );

  const completedCount = occurrences.filter((occurrence) => occurrence.completed).length;

  function persistGoals(nextGoals: Goal[]) {
    setGoals(nextGoals);
    if (storageScope) saveGoals(storageScope, nextGoals);
  }

  function persistDayAssignments(nextAssignments: DayAssignment[]) {
    setDayAssignments(nextAssignments);
    if (storageScope) saveDayAssignments(storageScope, nextAssignments);
  }

  function handleToggleDate(goalId: string) {
    const goal = goals.find((entry) => entry.id === goalId);
    const isDone = goal?.completedDates?.includes(todayIso) ?? false;

    if (!goal) return;

    if (!isDone && goal.type === "quantified") {
      setPendingAmount({
        kind: "date",
        goalId,
        isoDate: todayIso,
        defaultAmount: suggestedAssignmentAmount(goal),
      });
      return;
    }

    if (!isDone) {
      const timeStr = currentTimeString();
      const periodKey = goal.cadence === "daily"
        ? undefined
        : computePeriodKey(goal.cadence, new Date(`${todayIso}T00:00:00`));

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
            ),
            completed: true,
            completedAt: timeStr,
          },
        ]);
      }
    }

    persistGoals(toggleGoalDate(goals, goalId, todayIso));
  }

  function handleToggleAssignment(actionId: string) {
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
      const toggleDates = [...new Set(assignmentsToToggle.map((entry) => entry.date))];
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
                    item.date === date &&
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
      if (!nowCompleted) return { ...entry, completed: false, completedAt: undefined };
      const completionTime = entry.scheduledTime ?? timeStr;
      return { ...entry, completed: true, scheduledTime: completionTime, completedAt: completionTime };
    }));
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
          {occurrences.map((item) => (
            <FocusOccurrenceRow
              key={item.id}
              item={item}
              timeFormat={preferences.timeFormat}
              onToggle={() => {
                if (item.source === "assignment") handleToggleAssignment(item.actionId);
                else handleToggleDate(item.goal.id);
              }}
            />
          ))}
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
    </div>
  );
}
