import { buildScopedStorageKey, purgeLegacyPlannerStorage } from "./user-scoped-browser-storage";

type ParseResult<T> = { success: true; data: T } | { success: false };

interface SafeParser<T> {
  safeParse(value: unknown): ParseResult<T>;
}

export function loadScopedJsonArray<T>({
  baseKey,
  storageScope,
  arraySchema,
  itemSchema,
  normalize = (items) => items,
}: {
  baseKey: string;
  storageScope: string;
  arraySchema: SafeParser<T[]>;
  itemSchema: SafeParser<T>;
  normalize?: (items: T[]) => T[];
}): T[] {
  if (typeof window === "undefined") return [];
  try {
    purgeLegacyPlannerStorage();
    const raw = localStorage.getItem(buildScopedStorageKey(baseKey, storageScope));
    if (!raw) return [];

    const parsedRaw = JSON.parse(raw) as unknown;
    const parsed = arraySchema.safeParse(parsedRaw);
    if (parsed.success) return normalize(parsed.data);

    if (!Array.isArray(parsedRaw)) return [];
    return normalize(
      parsedRaw
        .map((item) => itemSchema.safeParse(item))
        .filter((result): result is { success: true; data: T } => result.success)
        .map((result) => result.data),
    );
  } catch {
    return [];
  }
}

export function saveScopedJson<T>({
  baseKey,
  storageScope,
  value,
}: {
  baseKey: string;
  storageScope: string;
  value: T;
}): boolean {
  if (typeof window === "undefined") return false;
  try {
    purgeLegacyPlannerStorage();
    const key = buildScopedStorageKey(baseKey, storageScope);
    const nextValue = JSON.stringify(value);
    if (localStorage.getItem(key) === nextValue) return false;
    localStorage.setItem(key, nextValue);
    return true;
  } catch {
    return false;
  }
}

export function dispatchScopedStorageEvent<T>(eventName: string, detail: T): void {
  if (typeof window === "undefined") return;

  const dispatch = () => {
    window.dispatchEvent(new CustomEvent<T>(eventName, { detail }));
  };

  window.setTimeout(dispatch, 0);
}

export function clearScopedJson({
  baseKey,
  storageScope,
}: {
  baseKey: string;
  storageScope: string;
}): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.removeItem(buildScopedStorageKey(baseKey, storageScope));
    return true;
  } catch {
    return false;
  }
}
