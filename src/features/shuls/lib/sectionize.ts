import type { ShulGroup } from "@/features/shuls/types/minyan";

export interface ShulSections {
  favorites: ShulGroup[];
  closest: ShulGroup[];
  discover: ShulGroup[];
  expired: ShulGroup[];
  noTimes: ShulGroup[];
}

const DEFAULT_CLOSEST_LIMIT = 5;

export function sectionize(
  groups: ShulGroup[],
  favoriteIds: Set<string>,
  hasUpcomingMinyan: (group: ShulGroup) => boolean = (group) => group.occurrences.length > 0,
  closestLimit: number = DEFAULT_CLOSEST_LIMIT,
): ShulSections {
  const favorites: ShulGroup[] = [];
  const withTimes: ShulGroup[] = [];
  const expired: ShulGroup[] = [];
  const noTimes: ShulGroup[] = [];

  for (const group of groups) {
    const hasTimes = group.occurrences.length > 0;
    const available = hasUpcomingMinyan(group);

    if (favoriteIds.has(group.shulId) && available) {
      favorites.push(group);
      continue;
    }

    if (available) withTimes.push(group);
    else if (hasTimes) expired.push(group);
    else noTimes.push(group);
  }

  return {
    favorites,
    closest: withTimes.slice(0, closestLimit),
    discover: withTimes.slice(closestLimit),
    expired,
    noTimes,
  };
}
