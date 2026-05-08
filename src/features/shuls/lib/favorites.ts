import type { MinyanOccurrence, StoredFavorite } from "@/features/shuls/types/minyan";

const KEY = "beseder.favorite-shuls";

export function loadFavorites(): StoredFavorite[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredFavorite[]) : [];
  } catch {
    return [];
  }
}

export function getFavoriteIds(): Set<string> {
  return new Set(loadFavorites().map((f) => f.id));
}

export function addFavorite(occurrence: MinyanOccurrence): void {
  const favorites = loadFavorites();
  if (!favorites.find((f) => f.id === occurrence.shulId)) {
    favorites.push({
      id: occurrence.shulId,
      shulName: occurrence.shulName,
      address: occurrence.address,
      nusach: occurrence.nusach,
    });
    localStorage.setItem(KEY, JSON.stringify(favorites));
  }
}

export function removeFavorite(shulId: string): void {
  const favorites = loadFavorites().filter((f) => f.id !== shulId);
  localStorage.setItem(KEY, JSON.stringify(favorites));
}
