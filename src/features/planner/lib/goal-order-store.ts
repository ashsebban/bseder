import { z } from "zod";
import {
  clearScopedJson,
  dispatchScopedStorageEvent,
  loadScopedJsonArray,
  saveScopedJson,
} from "../../../lib/scoped-storage-store";

const KEY = "steinberg_goal_order.v1";
const GoalOrderSchema = z.array(z.string());
const GoalOrderItemSchema = z.string();
export const GOAL_ORDER_STORAGE_UPDATED_EVENT = "goal-order-storage-updated";

export interface GoalOrderStorageUpdatedDetail {
  storageScope: string;
  order: string[];
}

function dispatchGoalOrderStorageUpdated(storageScope: string, order: string[]) {
  dispatchScopedStorageEvent<GoalOrderStorageUpdatedDetail>(
    GOAL_ORDER_STORAGE_UPDATED_EVENT,
    { storageScope, order },
  );
}

export function loadGoalOrder(storageScope: string): string[] {
  return loadScopedJsonArray({
    baseKey: KEY,
    storageScope,
    arraySchema: GoalOrderSchema,
    itemSchema: GoalOrderItemSchema,
  });
}

export function saveGoalOrder(storageScope: string, order: string[]): void {
  if (saveScopedJson({ baseKey: KEY, storageScope, value: order })) {
    dispatchGoalOrderStorageUpdated(storageScope, order);
  }
}

export function clearGoalOrderStorage(storageScope: string): void {
  if (clearScopedJson({ baseKey: KEY, storageScope })) {
    dispatchGoalOrderStorageUpdated(storageScope, []);
  }
}

/**
 * Merges a reorder within one day back into the global order array.
 *
 * Goals not visible on that day stay at their current positions.
 * The day's goals "fill in" those same positions in the new relative order.
 *
 * Example:
 *   globalOrder = [A, B, C, D, E]
 *   prevDayIds  = [B, D]          (positions 1 and 3)
 *   newDayIds   = [D, B]          (dragged D above B)
 *   → result    = [A, D, C, B, E] (positions 1→D, 3→B)
 */
export function reorderGlobal(
  globalOrder: string[],
  prevDayIds: string[],
  newDayIds: string[],
): string[] {
  // Positions in globalOrder currently occupied by day goals, sorted ascending
  const positions = globalOrder
    .map((id, i) => ({ id, i }))
    .filter(({ id }) => prevDayIds.includes(id))
    .map(({ i }) => i)
    .sort((a, b) => a - b);

  const result = [...globalOrder];

  // Place newDayIds (only those already in globalOrder) at those positions
  const knownIds = newDayIds.filter((id) => globalOrder.includes(id));
  knownIds.forEach((id, j) => {
    if (j < positions.length) result[positions[j]] = id;
  });

  // Goals not yet in globalOrder (newly created) → append
  const unseenIds = newDayIds.filter((id) => !globalOrder.includes(id));
  return [...result, ...unseenIds];
}
