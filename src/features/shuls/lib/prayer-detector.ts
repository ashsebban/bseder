import type { DayZmanim } from "@/features/calendar/lib/zmanim";
import type { Prayer } from "@/features/shuls/types/minyan";

const SHACHARIT_PERIODS = new Set([
  "Alot HaShachar",
  "Misheyakir",
  "Netz HaChama",
  "Sof Zman Shema",
  "Sof Zman Tefilla",
]);

const MINCHA_PERIODS = new Set([
  "Chatzot",
  "Mincha Gedola",
  "Mincha Ketana",
  "Plag HaMincha",
]);

const MAARIV_PERIODS = new Set([
  "Shkiyah",
  "Bein HaShmashot",
  "Tzais HaKochavim",
  "Night",
]);

export function getCurrentPrayer(zmanim: DayZmanim): Prayer | null {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    timeZone: zmanim.tzid,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const currentHour = (h === 24 ? 0 : h) + m / 60;

  const period = zmanim.periods.find(
    (p) => p.startHour <= currentHour && p.endHour > currentHour,
  );
  if (!period) return null;

  if (SHACHARIT_PERIODS.has(period.name)) return "shacharit";
  if (MINCHA_PERIODS.has(period.name)) return "mincha";
  if (MAARIV_PERIODS.has(period.name)) return "maariv";
  return null;
}

export function getPrayerLabel(prayer: Prayer): string {
  return { shacharit: "Shacharit", mincha: "Mincha", maariv: "Maariv" }[prayer];
}

export function getPrayerEmoji(prayer: Prayer): string {
  return { shacharit: "🌅", mincha: "☀️", maariv: "🌙" }[prayer];
}

export function getPrayerDescription(prayer: Prayer): string {
  return {
    shacharit: "Morning prayer",
    mincha: "Afternoon prayer",
    maariv: "Evening prayer",
  }[prayer];
}

/** Haversine distance in miles between two lat/lng points */
export function distanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Parse "HH:MM" into minutes since midnight */
export function parseTimeToMins(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Current time in minutes since midnight (local to tzid) */
export function nowInMins(tzid: string): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    timeZone: tzid,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return (h === 24 ? 0 : h) * 60 + m;
}
