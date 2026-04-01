const KEY = "steinberg_goal_order.v1";

export function loadGoalOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveGoalOrder(order: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(order));
  } catch {}
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
