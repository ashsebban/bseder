const LEGACY_PLANNER_STORAGE_KEYS = [
  "steinberg_goals.v1",
  "steinberg_goals",
  "steinberg_day_assignments.v1",
  "steinberg_day_assignments",
  "steinberg_goal_order.v1",
  "planner.calendar-preferences.v1",
  "steinberg.omer_completions.v1",
  "steinberg.omer_title.v1",
] as const;

const SCOPED_PLANNER_STORAGE_BASE_KEYS = [
  "steinberg_goals.v1",
  "steinberg_day_assignments.v1",
  "steinberg_goal_order.v1",
  "planner.calendar-preferences.v1",
] as const;

function isBrowser() {
  return typeof window !== "undefined";
}

export function buildScopedStorageKey(baseKey: string, storageScope: string): string {
  return `${baseKey}::${storageScope}`;
}

export function purgeLegacyPlannerStorage(): void {
  if (!isBrowser()) return;
  for (const key of LEGACY_PLANNER_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore localStorage failures.
    }
  }
}

export function clearScopedPlannerStorage(storageScope: string): void {
  if (!isBrowser()) return;
  purgeLegacyPlannerStorage();
  for (const baseKey of SCOPED_PLANNER_STORAGE_BASE_KEYS) {
    try {
      window.localStorage.removeItem(buildScopedStorageKey(baseKey, storageScope));
    } catch {
      // Ignore localStorage failures.
    }
  }
}
