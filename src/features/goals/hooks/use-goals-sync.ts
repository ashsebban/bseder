import { useState, useEffect, useLayoutEffect, useRef } from "react";
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
import { fetchApi, isAbortError } from "@/lib/api-client";
import type { Goal } from "@/features/goals/types/goal";

export function useGoalsSync(storageScope: string) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dayAssignments, setDayAssignments] = useState<DayAssignment[]>([]);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [serverHydrated, setServerHydrated] = useState(false);

  const goalsSaveControllerRef = useRef<AbortController | null>(null);
  const assignmentsSaveControllerRef = useRef<AbortController | null>(null);
  const goalsSnapshotRef = useRef("[]");
  const assignmentsSnapshotRef = useRef("[]");
  const goalsRef = useRef<Goal[]>([]);
  const storageLoadedRef = useRef(false);
  const serverHydratedRef = useRef(false);

  useEffect(() => { goalsSnapshotRef.current = JSON.stringify(goals); }, [goals]);
  useEffect(() => { assignmentsSnapshotRef.current = JSON.stringify(dayAssignments); }, [dayAssignments]);
  useLayoutEffect(() => { goalsRef.current = goals; });
  useLayoutEffect(() => { storageLoadedRef.current = storageLoaded; });
  useLayoutEffect(() => { serverHydratedRef.current = serverHydrated; });

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
        const serverGoals = goalsResult.value.goals;
        setGoals((current) => {
          const serverMap = new Map(serverGoals.map((g) => [g.id, g]));
          const localOnly = current.filter((g) => !serverMap.has(g.id));
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
        console.error("[goals-workspace] fetch goals failed:", goalsResult.reason);
      }

      if (assignmentsResult.status === "fulfilled" && Array.isArray(assignmentsResult.value.assignments)) {
        const serverAssignments = assignmentsResult.value.assignments;
        setDayAssignments((current) => {
          const serverIds = new Set(serverAssignments.map((a) => a.id));
          const localOnly = current.filter((a) => !serverIds.has(a.id));
          const merged = serverAssignments.map((serverA) => {
            const localA = current.find((a) => a.id === serverA.id);
            return localA?.completed && !serverA.completed ? localA : serverA;
          });
          return localOnly.length > 0 ? [...localOnly, ...merged] : merged;
        });
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
    if (!storageLoaded) return;
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
  }, [goals, storageLoaded]);

  // Flush pending saves when the page is hidden or about to unload.
  // Registered once — uses refs to always read current values, no serverHydrated guard.
  useEffect(() => {
    function flushGoals() {
      if (!storageLoadedRef.current) return;
      goalsSaveControllerRef.current?.abort();
      fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: goalsRef.current }),
        keepalive: true,
      }).catch(() => {});
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") flushGoals();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    // pagehide fires on hard reload / back-forward navigation where visibilitychange may not
    window.addEventListener("pagehide", flushGoals);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushGoals);
    };
  }, []);

  // On assignments change: debounced save to server
  useEffect(() => {
    if (!storageLoaded) return;
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
  }, [dayAssignments, storageLoaded]);

  useEffect(() => () => {
    goalsSaveControllerRef.current?.abort();
    assignmentsSaveControllerRef.current?.abort();
  }, []);

  return {
    goals,
    setGoals,
    dayAssignments,
    setDayAssignments,
    storageLoaded,
    serverHydrated,
  };
}
