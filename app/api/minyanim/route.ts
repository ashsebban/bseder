import { parseGoDavenV2Response, type GoDavenV2Response, type GoDavenV2Shul } from "@/features/shuls/lib/godaven-v2-parser";
import type { Prayer, ShulGroup } from "@/features/shuls/types/minyan";
import type { Nusach } from "@/features/settings/types/calendar-preferences";

// GoDaven V2 API — reverse-engineered from the GoDaven SPA JS bundle.
// Two endpoints used:
//   1. /api/V2/shuls/radius-search  — all shuls by distance (no auth, no prayer filter)
//   2. /api/V2/minyanim/search      — prayer times within a window (no auth)

const PRAYER_TO_TEFILLAH: Record<Prayer, string> = {
  shacharit: "shachris",
  mincha: "mincha",
  maariv: "mariv",
};

const ALL_PRAYERS: Prayer[] = ["shacharit", "mincha", "maariv"];

function pad(n: number) { return n.toString().padStart(2, "0"); }

// Approximate local time at the searched location using longitude.
// When the client's timezone is close to the shul's timezone (within 90 min),
// we use the client's actual offset so DST is handled correctly.
// For cross-timezone searches (e.g. Israel → LA), we fall back to the
// longitude estimate.
function estimateLocalNow(utcNow: Date, lng: number, clientTzOffsetMins?: number): Date {
  const lngOffsetMins = Math.round(lng / 15) * 60;
  const offsetMins =
    clientTzOffsetMins !== undefined && Math.abs(lngOffsetMins - clientTzOffsetMins) < 90
      ? clientTzOffsetMins
      : lngOffsetMins;
  return new Date(utcNow.getTime() + offsetMins * 60 * 1000);
}

const GODAVEN_TIMEOUT_MS = 6500;
const MINYAN_PAGE_CONCURRENCY = 10;
const MINYAN_PAGE_RETRIES = 2;
const EMPTY_MINYAN_RESPONSE: GoDavenV2Response = { total: 0, num_of_pages: 0, shuls: [] };

interface GoDavenPageResult {
  page: number;
  ok: boolean;
  data: GoDavenV2Response;
}

interface MinyanPrayerFetchResult {
  prayer: Prayer;
  shuls: GoDavenV2Shul[];
  partial: boolean;
  failedPages: number[];
}

// ─── Radius-search (shul list, no prayer filter) ─────────────────────────────

interface GoDavenRadiusShul {
  id: number;
  name: string;
  shul_nusach: string | null;
  phone?: string | null;
  distance: number;
  formatted_address: string;
  location_point: { type: string; coordinates: [number, number] };
}
interface GoDavenRadiusResponse { total: number; num_of_pages: number; shuls: GoDavenRadiusShul[]; }

async function fetchRadiusPage(
  lat: number, lng: number, distance: number,
  day: number, now: string, usersDate: string, page: number, nusach: string,
): Promise<GoDavenRadiusShul[]> {
  const url = new URL("https://www.godaven.com/api/V2/shuls/radius-search");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lng", String(lng));
  url.searchParams.set("distance", String(distance));
  url.searchParams.set("pagenumber", String(page));
  url.searchParams.set("nusach", nusach);
  url.searchParams.set("tefillah", "");
  url.searchParams.set("day", String(day));
  url.searchParams.set("current_time", now);
  url.searchParams.set("todays_day", String(day));
  url.searchParams.set("users_date", usersDate);
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(GODAVEN_TIMEOUT_MS),
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data: GoDavenRadiusResponse = await res.json();
    return data.shuls ?? [];
  } catch { return []; }
}

// ─── Minyanim/search (prayer times within window) ────────────────────────────

async function fetchMinyanimPage(
  tefillah: string, lat: number, lng: number,
  day: number, start: string, end: string, usersDate: string, distance: number, page: number, nusach: string,
  tomorrowSearch: boolean,
): Promise<GoDavenPageResult> {
  const url = new URL("https://www.godaven.com/api/V2/minyanim/search");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lng", String(lng));
  url.searchParams.set("day", String(day));
  url.searchParams.set("start", start);
  url.searchParams.set("end", end);
  url.searchParams.set("tomorrow_search", tomorrowSearch ? "true" : "false");
  url.searchParams.set("pagenumber", String(page));
  url.searchParams.set("distance", String(distance));
  url.searchParams.set("nusach", nusach);
  url.searchParams.set("tefillah", tefillah);
  url.searchParams.set("users_date", usersDate);

  for (let attempt = 0; attempt <= MINYAN_PAGE_RETRIES; attempt += 1) {
    try {
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        signal: AbortSignal.timeout(GODAVEN_TIMEOUT_MS),
        next: { revalidate: 90 },
      });
      if (!res.ok) continue;
      const data: GoDavenV2Response = await res.json();
      return { page, ok: true, data };
    } catch {
      // Retry below; a failed GoDaven page should not masquerade as a complete schedule.
    }
  }

  return { page, ok: false, data: EMPTY_MINYAN_RESPONSE };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]!);
    }
  }));

  return results;
}

async function fetchMinyanimForPrayer(
  prayer: Prayer,
  lat: number,
  lng: number,
  day: number,
  start: string,
  end: string,
  usersDate: string,
  distance: number,
  nusach: string,
  tomorrowSearch: boolean,
): Promise<MinyanPrayerFetchResult> {
  const tefillah = PRAYER_TO_TEFILLAH[prayer];
  const first = await fetchMinyanimPage(tefillah, lat, lng, day, start, end, usersDate, distance, 1, nusach, tomorrowSearch);
  if (!first.ok) {
    return { prayer, shuls: [], partial: true, failedPages: [1] };
  }

  const MAX_MINYAN_PAGES = 60;
  const totalPages = Math.min(Math.max(first.data.num_of_pages || 1, 1), MAX_MINYAN_PAGES);
  if (totalPages === 1) {
    return { prayer, shuls: first.data.shuls ?? [], partial: false, failedPages: [] };
  }

  const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
  const rest = await mapWithConcurrency(pageNumbers, MINYAN_PAGE_CONCURRENCY, (page) =>
    fetchMinyanimPage(tefillah, lat, lng, day, start, end, usersDate, distance, page, nusach, tomorrowSearch)
  );
  const pages = [first, ...rest];
  const failedPages = pages.filter((page) => !page.ok).map((page) => page.page);

  return {
    prayer,
    shuls: pages.flatMap((page) => page.data.shuls ?? []),
    partial: failedPages.length > 0,
    failedPages,
  };
}

function mapNusach(raw: string | null | undefined): Nusach {
  if (!raw) return "ashkenaz";
  const n = raw.toLowerCase();
  if (n === "sefard" || n.includes("sfard") || n.includes("chassid")) return "sfard";
  if (n.includes("sephardi") || n.includes("sephardic")) return "sephardi";
  if (n.includes("chabad")) return "chabad";
  if (n.includes("temani")) return "temanim";
  return "ashkenaz";
}

function titleCase(s: string) {
  return s.toLowerCase().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function formatPhone(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  return raw.trim() || undefined;
}

function normalizeGoDavenNusachParam(raw: string): string {
  if (raw === "ashkenaz") return "ashkenaz";
  if (raw === "sfard" || raw === "sefard") return "sefard";
  return "";
}

function normalizePrayerParam(raw: string | null): Prayer[] {
  if (raw === "shacharit" || raw === "mincha" || raw === "maariv") return [raw];
  return ALL_PRAYERS;
}

function getSearchWindowForPrayer(
  prayer: Prayer,
  nowStr: string,
  nowMins: number,
  dateOffset: number,
): { start: string; end: string } {
  if (dateOffset !== 0) {
    if (prayer === "shacharit") return { start: "04:00", end: "13:00" };
    if (prayer === "mincha") return { start: "12:00", end: "23:59" };
    return { start: "18:00", end: "23:59" };
  }

  // After midnight, the active Maariv belongs to the previous evening's tefila
  // cycle. Search only the overnight tail, not the same-civil-day evening.
  if (prayer === "maariv" && nowMins < 6 * 60) {
    return { start: nowStr, end: "05:59" };
  }

  // For same-day prayers, users expect to see what they missed as well as what
  // is still available. For Maariv, start at the evening block instead of 00:00
  // so post-midnight records do not look like last night's missed minyanim.
  if (prayer === "maariv") return { start: "18:00", end: "23:59" };
  if (prayer === "mincha") return { start: "12:00", end: "23:59" };
  return { start: "04:00", end: "13:00" };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  if (isNaN(lat) || isNaN(lng)) {
    return Response.json({ error: "lat and lng required" }, { status: 400 });
  }
  const distance = parseFloat(searchParams.get("distance") ?? "5");
  const nusach = normalizeGoDavenNusachParam(searchParams.get("nusach") ?? "");
  const includeTimes = searchParams.get("includeTimes") !== "false";
  const prayersToFetch = normalizePrayerParam(searchParams.get("prayer"));
  const dateOffset = parseInt(searchParams.get("dateOffset") ?? "0", 10);
  const clientTzOffsetMins = Number(searchParams.get("tzOffsetMins"));

  const now = estimateLocalNow(
    new Date(),
    lng,
    Number.isFinite(clientTzOffsetMins) ? clientTzOffsetMins : undefined,
  );
  const nowMins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const nowStr = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
  // usersDate is always today — GoDaven uses it as "what's today" and computes
  // tomorrow itself when tomorrow_search=true, so passing a future date shifts
  // the result one extra day.
  const usersDate = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;

  // For tomorrow, use GoDaven's tomorrow_search flag and pass tomorrow's day-of-week.
  const tomorrowSearch = dateOffset === 1;
  const target = dateOffset === 0 ? now : new Date(now.getTime() + dateOffset * 24 * 60 * 60 * 1000);
  const day = target.getUTCDay();
  // Shift nowMins so minutesUntil is relative to now, not midnight of the target day.
  const parserNowMins = nowMins - dateOffset * 24 * 60;

  // Radius-search supplies nearby shul metadata; minyanim/search supplies the
  // actual schedule rows. They are independent, so start both before awaiting.
  const QUICK_RADIUS_PAGES = 5;
  const RADIUS_PAGES = 15; // 150 shuls — covers Columbus Ave Shul (~rank 134 in Lakewood)
  const radiusPageCount = includeTimes ? RADIUS_PAGES : QUICK_RADIUS_PAGES;

  const radiusPagesPromise = Promise.all(Array.from({ length: radiusPageCount }, (_, i) =>
    fetchRadiusPage(lat, lng, distance, day, nowStr, usersDate, i + 1, nusach)
  ));
  const minyanResultsPromise: Promise<MinyanPrayerFetchResult[]> = includeTimes
    ? Promise.all(
        prayersToFetch.map((prayer) => {
          const window = getSearchWindowForPrayer(prayer, nowStr, nowMins, dateOffset);
          return fetchMinyanimForPrayer(
            prayer,
            lat,
            lng,
            day,
            window.start,
            window.end,
            usersDate,
            distance,
            nusach,
            tomorrowSearch,
          );
        }),
      )
    : Promise.resolve([]);

  const [radiusPages, minyanResultsByPrayer] = await Promise.all([
    radiusPagesPromise,
    minyanResultsPromise,
  ]);

  // Build distance-sorted shul map from radius-search
  const radiusShuls = radiusPages.flat();
  const shulMap = new Map<string, ShulGroup>();
  const seenIds = new Set<number>();
  for (const s of radiusShuls) {
    if (seenIds.has(s.id) || !s.location_point?.coordinates) continue;
    seenIds.add(s.id);
    const [lng2, lat2] = s.location_point.coordinates;
    shulMap.set(String(s.id), {
      shulId: String(s.id),
      shulName: titleCase(s.name),
      address: s.formatted_address,
      lat: lat2!,
      lng: lng2!,
      nusach: mapNusach(s.shul_nusach),
      phone: formatPhone(s.phone),
      distanceMiles: s.distance,
      occurrences: [],
    });
  }

  if (!includeTimes) {
    const radiusOnlyGroups = Array.from(shulMap.values())
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
    return Response.json({
      shulGroups: radiusOnlyGroups,
      happeningNow: [],
      _meta: { shuls: radiusOnlyGroups.length, upcoming: 0, partial: true },
    });
  }

  // Parse prayer times and attach to shul groups
  const allMinyanimShuls = minyanResultsByPrayer.flatMap((result) => result.shuls);
  const minyanPartial = minyanResultsByPrayer.some((result) => result.partial);
  const failedMinyanPages = minyanResultsByPrayer.flatMap((result) =>
    result.failedPages.map((page) => `${result.prayer}:${page}`),
  );
  const parsedOccurrences = parseGoDavenV2Response(
    { total: allMinyanimShuls.length, num_of_pages: 1, shuls: allMinyanimShuls },
    parserNowMins,
  );

  // Deduplicate occurrences
  const seenKeys = new Set<string>();
  for (const o of parsedOccurrences) {
    if (seenKeys.has(o.key)) continue;
    seenKeys.add(o.key);

    // Attach to existing shul group, or create one if the shul wasn't in radius-search
    if (!shulMap.has(o.shulId)) {
      shulMap.set(o.shulId, {
        shulId: o.shulId,
        shulName: o.shulName,
        address: o.address,
        lat: o.lat,
        lng: o.lng,
        nusach: o.nusach,
        phone: o.phone,
        rabbi: o.rabbi,
        distanceMiles: o.distanceMiles,
        occurrences: [],
      });
    }
    const group = shulMap.get(o.shulId)!;
    if (!group.rabbi && o.rabbi) group.rabbi = o.rabbi;
    group.occurrences.push(o);
  }

  // Sort shul groups by distance
  const shulGroups = Array.from(shulMap.values())
    .map((group) => ({
      ...group,
      occurrences: group.occurrences.sort((a, b) => a.minutesUntil - b.minutesUntil),
    }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles);

  // Flat upcoming occurrences for "Happening Now"
  const happeningNow = parsedOccurrences
    .filter((o) => o.minutesUntil >= 0 && o.minutesUntil <= 180)
    .sort((a, b) => a.minutesUntil - b.minutesUntil);

  return Response.json({
    shulGroups,
    happeningNow,
    _meta: {
      shuls: shulGroups.length,
      upcoming: happeningNow.length,
      partial: minyanPartial,
      failedMinyanPages,
    },
  });
}
