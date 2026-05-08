import type { Nusach } from "@/features/settings/types/calendar-preferences";

export type Prayer = "shacharit" | "mincha" | "maariv";

export interface MinyanOccurrence {
  key: string;
  shulId: string;
  shulName: string;
  address: string;
  lat: number;
  lng: number;
  nusach: Nusach;
  phone?: string;
  rabbi?: string;
  prayer: Prayer;
  time: string;
  distanceMiles: number;
  minutesUntil: number;
}

export interface ShulGroup {
  shulId: string;
  shulName: string;
  address: string;
  lat: number;
  lng: number;
  nusach: Nusach;
  phone?: string;
  rabbi?: string;
  distanceMiles: number;
  occurrences: MinyanOccurrence[];
}

export interface StoredFavorite {
  id: string;
  shulName: string;
  address: string;
  nusach: string;
}
