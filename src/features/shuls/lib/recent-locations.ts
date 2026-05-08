const KEY = "beseder.recent-shul-locations";
const MAX = 5;

export interface RecentLocation {
  lat: number;
  lng: number;
  label: string;
}

export function loadRecentLocations(): RecentLocation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentLocation[]) : [];
  } catch {
    return [];
  }
}

export function pushRecentLocation(location: RecentLocation): void {
  if (typeof window === "undefined") return;
  const existing = loadRecentLocations().filter((recent) => recent.label !== location.label);
  const next = [location, ...existing].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Ignore localStorage failures.
  }
}
