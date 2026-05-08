import type { ShulGroup } from "@/features/shuls/types/minyan";

const STORAGE_PREFIX = "beseder.shuls.results.v6";
const FULL_CACHE_FRESH_MS = 15 * 60 * 1000;

export interface ShulsCacheEntry {
  shulGroups: ShulGroup[];
  fetchedAt: number;
}

export interface ShulsCacheReadResult {
  shulGroups: ShulGroup[];
  fresh: boolean;
}

export function getShulsCacheFreshMs(): number {
  return FULL_CACHE_FRESH_MS;
}

function storageKey(cacheKey: string): string {
  return `${STORAGE_PREFIX}::${cacheKey}`;
}

function parseTimeMins(hhmm: string): number {
  const [hour, minute] = hhmm.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function recomputeMinutesUntil(shulGroups: ShulGroup[], now: Date): ShulGroup[] {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return shulGroups.map((group) => ({
    ...group,
    occurrences: group.occurrences
      .map((occurrence) => {
        let minutesUntil = parseTimeMins(occurrence.time) - nowMins;
        if (occurrence.prayer === "maariv" && minutesUntil < -(12 * 60)) minutesUntil += 24 * 60;
        return { ...occurrence, minutesUntil };
      })
      .sort((a, b) => a.minutesUntil - b.minutesUntil),
  }));
}

export function loadShulsCache(cacheKey: string, dateOffset: number, now = new Date()): ShulsCacheReadResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(cacheKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShulsCacheEntry;
    if (!Array.isArray(parsed.shulGroups) || typeof parsed.fetchedAt !== "number") return null;
    if (parsed.shulGroups.length === 0) {
      window.localStorage.removeItem(storageKey(cacheKey));
      return null;
    }

    return {
      // For future/past dates minutesUntil is only used for sorting, not display,
      // so skip recompute — stored order is already correct.
      shulGroups: dateOffset === 0 ? recomputeMinutesUntil(parsed.shulGroups, now) : parsed.shulGroups,
      fresh: now.getTime() - parsed.fetchedAt < FULL_CACHE_FRESH_MS,
    };
  } catch {
    return null;
  }
}

export function saveShulsCache(cacheKey: string, shulGroups: ShulGroup[], now = new Date()): void {
  if (typeof window === "undefined") return;
  if (shulGroups.length === 0) return;
  try {
    const entry: ShulsCacheEntry = {
      shulGroups,
      fetchedAt: now.getTime(),
    };
    window.localStorage.setItem(storageKey(cacheKey), JSON.stringify(entry));
  } catch {
    // Ignore localStorage quota or privacy-mode failures.
  }
}
