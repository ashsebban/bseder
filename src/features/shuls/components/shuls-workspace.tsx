"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Circle, Clock, MapPin, Search, Star, X } from "lucide-react";
import { defaultCalendarPreferences, loadCalendarPreferencesFromStorage } from "@/features/settings/lib/calendar-preferences";
import type { CalendarPreferences } from "@/features/settings/types/calendar-preferences";
import { calendarLocationOptions, resolveLocation } from "@/features/calendar/lib/locations";
import { computeDayZmanim } from "@/features/calendar/lib/zmanim";
import { addMinyanToCalendar } from "@/features/shuls/lib/add-minyan-to-calendar";
import { addFavorite, getFavoriteIds, removeFavorite } from "@/features/shuls/lib/favorites";
import { loadShulsCache, saveShulsCache } from "@/features/shuls/lib/shuls-results-cache";
import { checkAlreadyDavened } from "@/features/shuls/lib/prayer-completion";
import { getCurrentPrayer, getPrayerLabel } from "@/features/shuls/lib/prayer-detector";
import { sectionize } from "@/features/shuls/lib/sectionize";
import type { ShulFilters } from "@/features/shuls/components/filter-popover";
import { LocationSearch } from "@/features/shuls/components/location-search";
import { SectionHeader } from "@/features/shuls/components/section-header";
import { ShulCard } from "@/features/shuls/components/shul-card";
import { SmartBar } from "@/features/shuls/components/smart-bar";
import { useToast } from "@/features/shuls/components/toast-stack";
import type { GeocodedLocation } from "@/features/shuls/lib/geocode";
import type { RouteInsight, ShulConditionsResponse, ShulConditionTarget } from "@/features/shuls/types/conditions";
import type { MinyanOccurrence, Prayer, ShulGroup } from "@/features/shuls/types/minyan";
import type { MapShul } from "@/features/shuls/components/shuls-map";
import { addDays, toIsoDate } from "@/lib/date";
import { cn } from "@/lib/cn";

const ShulsMap = dynamic(
  () => import("@/features/shuls/components/shuls-map").then((module) => module.ShulsMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-slate-100" /> },
);

const PRAYER_ORDER: Prayer[] = ["shacharit", "mincha", "maariv"];
const SHULS_SETTINGS_STORAGE_KEY = "beseder.shuls.settings.v1";
type MapMode = "next" | "all" | "saved";
type LocationSource = "gps" | "manual" | "saved";
const CLOSEST_LIMIT_OPTIONS = [5, 10, 15, 20] as const;
type ClosestLimit = typeof CLOSEST_LIMIT_OPTIONS[number];
const DEFAULT_CLOSEST_LIMIT: ClosestLimit = 5;

const NUSACH_LABELS: Record<string, string> = {
  ashkenaz: "Ashkenaz",
  sfard: "Sfard",
  sephardi: "Sephardi",
  chabad: "Chabad",
  temanim: "Temanim",
  custom: "Custom",
};

const DEFAULT_SHUL_FILTERS: ShulFilters = {
  prayer: "maariv",
  nusach: "all",
  distanceMi: 5,
  showShulsWithoutTimes: true,
};

function getSmartPrayer(detectedPrayer: Prayer, davenedToday: Record<Prayer, boolean>): Prayer {
  const startIndex = Math.max(0, PRAYER_ORDER.indexOf(detectedPrayer));
  for (let index = startIndex; index < PRAYER_ORDER.length; index += 1) {
    const prayer = PRAYER_ORDER[index]!;
    if (!davenedToday[prayer]) return prayer;
  }
  return detectedPrayer;
}

function getPreferenceLocation(prefs: CalendarPreferences): GeocodedLocation | undefined {
  if (prefs.customLocation) {
    return {
      lat: prefs.customLocation.lat,
      lng: prefs.customLocation.lng,
      label: prefs.customLocation.label,
    };
  }

  const option = calendarLocationOptions.find((location) => location.key === prefs.locationKey);
  return option ? { lat: option.lat, lng: option.lng, label: option.label } : undefined;
}

function isPrayer(value: unknown): value is Prayer {
  return value === "shacharit" || value === "mincha" || value === "maariv";
}

function isNusachFilter(value: unknown): value is ShulFilters["nusach"] {
  return value === "all" || value === "ashkenaz" || value === "sfard";
}

function isDistanceFilter(value: unknown): value is ShulFilters["distanceMi"] {
  return value === 0.5 || value === 1 || value === 2 || value === 5;
}

function isClosestLimit(value: unknown): value is ClosestLimit {
  return typeof value === "number" && CLOSEST_LIMIT_OPTIONS.some((option) => option === value);
}

function getSettingsStorageKey(storageScope: string): string {
  return `${SHULS_SETTINGS_STORAGE_KEY}::${storageScope}`;
}

function loadPersistedShulsSettings(storageScope: string): {
  filters?: ShulFilters;
  manualLocation?: GeocodedLocation | null;
  closestLimit?: ClosestLimit;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getSettingsStorageKey(storageScope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      filters?: Partial<ShulFilters>;
      manualLocation?: Partial<GeocodedLocation> | null;
      closestLimit?: unknown;
    };
    const filters = parsed.filters;
    const nextFilters = filters &&
      isPrayer(filters.prayer) &&
      isNusachFilter(filters.nusach) &&
      isDistanceFilter(filters.distanceMi) &&
      typeof filters.showShulsWithoutTimes === "boolean"
        ? {
            prayer: filters.prayer,
            nusach: filters.nusach,
            distanceMi: filters.distanceMi,
            showShulsWithoutTimes: filters.showShulsWithoutTimes,
          }
        : undefined;
    const location = parsed.manualLocation;
    const nextManualLocation = location &&
      typeof location.lat === "number" &&
      typeof location.lng === "number" &&
      typeof location.label === "string"
        ? { lat: location.lat, lng: location.lng, label: location.label }
        : null;
    const nextClosestLimit = isClosestLimit(parsed.closestLimit) ? parsed.closestLimit : undefined;
    return { filters: nextFilters, manualLocation: nextManualLocation, closestLimit: nextClosestLimit };
  } catch {
    return null;
  }
}

function savePersistedShulsSettings(
  storageScope: string,
  filters: ShulFilters,
  manualLocation: GeocodedLocation | null,
  closestLimit: ClosestLimit,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      getSettingsStorageKey(storageScope),
      JSON.stringify({ filters, manualLocation, closestLimit }),
    );
  } catch {
    // Ignore localStorage quota or privacy-mode failures.
  }
}

function formatTime(hhmm: string, timeFormat: "12h" | "24h"): string {
  const [hour, minute] = hhmm.split(":").map(Number);
  if (timeFormat === "12h") {
    const period = (hour ?? 0) >= 12 ? "PM" : "AM";
    const h12 = (hour ?? 0) % 12 || 12;
    return `${h12}:${(minute ?? 0).toString().padStart(2, "0")} ${period}`;
  }
  return hhmm;
}

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function getTargetIsoDate(dateOffset: number): string {
  return toIsoDate(addDays(new Date(), dateOffset));
}

function getMaarivWindowKey(prayer: Prayer, dateOffset: number): string {
  if (prayer !== "maariv" || dateOffset !== 0) return "day";
  return minutesSinceMidnight(new Date()) < 6 * 60 ? "overnight" : "evening";
}

function buildCacheKey(
  lat: number,
  lng: number,
  distanceMi: number,
  nusach: string,
  prayer: string,
  targetDate: string,
  windowKey: string,
): string {
  const rLat = Math.round(lat * 1000) / 1000;
  const rLng = Math.round(lng * 1000) / 1000;
  return `${rLat},${rLng},${distanceMi},${nusach},${prayer},${targetDate},${windowKey}`;
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

function shulMatchesSearch(group: ShulGroup, query: string): boolean {
  if (!query) return true;
  return [
    group.shulName,
    group.address,
    group.rabbi ?? "",
    group.nusach,
  ].some((value) => value.toLowerCase().includes(query));
}

function hasUpcomingOccurrence(group: ShulGroup, dateOffset: number): boolean {
  if (dateOffset !== 0) return group.occurrences.length > 0;
  return group.occurrences.some((occurrence) => occurrence.minutesUntil >= -5);
}

function formatDriveMinutes(minutes: number): string {
  return minutes <= 1 ? "1 min drive" : `${minutes} min drive`;
}

function formatDistance(distance: number): string {
  return distance < 0.1 ? "< 0.1 mi" : `${distance.toFixed(2)} mi`;
}

function formatLeaveHint(minutesUntil: number, route: RouteInsight): string {
  const bufferMins = 2;
  const leaveIn = minutesUntil - route.durationMinutes - bufferMins;
  const arrivalMargin = minutesUntil - route.durationMinutes;

  if (arrivalMargin < -2) return "too tight";
  if (leaveIn <= 0) return "leave now";
  if (leaveIn < 60) return `leave in ${leaveIn} min`;
  const hours = Math.floor(leaveIn / 60);
  const mins = leaveIn % 60;
  return mins === 0 ? `leave in ${hours}h` : `leave in ${hours}h ${mins}m`;
}

export function ShulsWorkspace({ storageScope }: { storageScope: string }) {
  const toast = useToast();
  const listRef = useRef<HTMLDivElement>(null);

  const [prefs, setPrefs] = useState<CalendarPreferences>(defaultCalendarPreferences);

  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [gpsLabel, setGpsLabel] = useState("Finding your location");
  const [gpsSource, setGpsSource] = useState<Exclude<LocationSource, "manual">>("gps");
  const [manualLocation, setManualLocation] = useState<GeocodedLocation | null>(null);

  const searchLat = manualLocation?.lat ?? gpsLat;
  const searchLng = manualLocation?.lng ?? gpsLng;
  const locationLabel = manualLocation?.label ?? gpsLabel;
  const locationSource: LocationSource = manualLocation ? "manual" : gpsSource;
  const isUsingGps = manualLocation === null;

  const [detectedPrayer, setDetectedPrayer] = useState<Prayer>("maariv");
  const [davenedToday, setDavenedToday] = useState<Record<Prayer, boolean>>({
    shacharit: false,
    mincha: false,
    maariv: false,
  });

  const [filters, setFilters] = useState<ShulFilters>(DEFAULT_SHUL_FILTERS);
  const [closestLimit, setClosestLimit] = useState<ClosestLimit>(DEFAULT_CLOSEST_LIMIT);

  const [shulGroups, setShulGroups] = useState<ShulGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [refetching, setRefetching] = useState(false);

  const [dateOffset, setDateOffset] = useState(0);

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [locationOpen, setLocationOpen] = useState(false);
  const [expandedShulId, setExpandedShulId] = useState<string | null>(null);
  const [selectedShulId, setSelectedShulId] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const [discoverCollapsed, setDiscoverCollapsed] = useState(true);
  const [expiredCollapsed, setExpiredCollapsed] = useState(false);
  const [noTimesCollapsed, setNoTimesCollapsed] = useState(true);
  const [shulSearch, setShulSearch] = useState("");
  const [mapMode, setMapMode] = useState<MapMode>("next");
  const [conditions, setConditions] = useState<ShulConditionsResponse | null>(null);

  const hasPersistedFiltersRef = useRef(false);
  const [settingsHydratedScope, setSettingsHydratedScope] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadCalendarPreferencesFromStorage(storageScope);
    const merged = { ...defaultCalendarPreferences, ...(stored ?? {}) };
    setPrefs(merged);
  }, [storageScope]);

  useEffect(() => {
    setSettingsHydratedScope(null);
    const stored = loadPersistedShulsSettings(storageScope);
    if (stored?.filters) {
      hasPersistedFiltersRef.current = true;
      setFilters(stored.filters);
    } else {
      hasPersistedFiltersRef.current = false;
    }
    setClosestLimit(stored?.closestLimit ?? DEFAULT_CLOSEST_LIMIT);
    setManualLocation(stored?.manualLocation ?? null);
    setSettingsHydratedScope(storageScope);
  }, [storageScope]);

  useEffect(() => {
    if (settingsHydratedScope !== storageScope) return;
    savePersistedShulsSettings(storageScope, filters, manualLocation, closestLimit);
  }, [storageScope, filters, manualLocation, closestLimit, settingsHydratedScope]);

  const refreshFavorites = useCallback(() => {
    setFavoriteIds(getFavoriteIds());
  }, []);

  useEffect(() => {
    refreshFavorites();
  }, [refreshFavorites]);

  useEffect(() => {
    const location = resolveLocation(prefs);
    if (!location) return;

    const zmanim = computeDayZmanim(new Date(), location, prefs.timeFormat);
    if (!zmanim) return;

    const nextDetectedPrayer = getCurrentPrayer(zmanim) ?? "maariv";
    const nextDavenedToday = {
      shacharit: checkAlreadyDavened(storageScope, "shacharit"),
      mincha: checkAlreadyDavened(storageScope, "mincha"),
      maariv: checkAlreadyDavened(storageScope, "maariv"),
    };

    setDetectedPrayer(nextDetectedPrayer);
    setDavenedToday(nextDavenedToday);
    if (!hasPersistedFiltersRef.current) {
      setFilters((current) => ({
        ...current,
        prayer: getSmartPrayer(nextDetectedPrayer, nextDavenedToday),
      }));
    }
  }, [prefs, storageScope]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      fallbackToPreferences();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLat(position.coords.latitude);
        setGpsLng(position.coords.longitude);
        setGpsSource("gps");
        setGpsLabel("Finding address");
      },
      fallbackToPreferences,
      { timeout: 5000 },
    );

    function fallbackToPreferences() {
      const location = getPreferenceLocation(prefs);
      if (!location) return;
      setGpsLat(location.lat);
      setGpsLng(location.lng);
      setGpsLabel(location.label);
      setGpsSource("saved");
    }
  }, [prefs]);

  useEffect(() => {
    if (gpsSource !== "gps" || gpsLat === null || gpsLng === null) return;

    const controller = new AbortController();
    let cancelled = false;
    const params = new URLSearchParams({
      lat: String(gpsLat),
      lng: String(gpsLng),
    });

    fetch(`/api/shuls/reverse-geocode?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { label?: string | null } | null) => {
        if (cancelled) return;
        setGpsLabel(data?.label || "Current location");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setGpsLabel("Current location");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [gpsLat, gpsLng, gpsSource]);

  useEffect(() => {
    if (searchLat === null || searchLng === null) return;

    const targetIsoDate = getTargetIsoDate(dateOffset);
    const windowKey = getMaarivWindowKey(filters.prayer, dateOffset);
    const cacheKey = buildCacheKey(searchLat, searchLng, filters.distanceMi, filters.nusach, filters.prayer, targetIsoDate, windowKey);
    const cached = loadShulsCache(cacheKey, dateOffset);

    if (cached) {
      setShulGroups(cached.shulGroups);
      setLoading(false);
      setRefetching(!cached.fresh);
      if (cached.fresh) return;
    } else {
      setLoading(true);
      setRefetching(false);
      setShulGroups([]);
    }

    const controller = new AbortController();
    let cancelled = false;
    const params = new URLSearchParams({
      lat: String(searchLat),
      lng: String(searchLng),
      distance: String(filters.distanceMi),
      prayer: filters.prayer,
      tzOffsetMins: String(-new Date().getTimezoneOffset()),
    });
    if (filters.nusach !== "all") params.set("nusach", filters.nusach);
    if (dateOffset !== 0) params.set("dateOffset", String(dateOffset));

    fetch(`/api/minyanim?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { shulGroups?: ShulGroup[]; _meta?: { partial?: boolean } }) => {
        if (cancelled) return;
        const groups = data.shulGroups ?? [];
        const partial = data._meta?.partial ?? false;
        if (groups.length > 0) {
          if (!partial || !cached) {
            setShulGroups(groups);
          }
          if (!partial) {
            saveShulsCache(cacheKey, groups);
          }
        } else if (!cached) {
          setShulGroups([]);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!cached) setShulGroups([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setRefetching(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchLat, searchLng, filters.distanceMi, filters.nusach, filters.prayer, dateOffset]);

  const filteredGroups = useMemo<ShulGroup[]>(() => {
    const nowMins = minutesSinceMidnight(new Date());
    const isOvernightMaariv = dateOffset === 0 && filters.prayer === "maariv" && nowMins < 6 * 60;
    return shulGroups.map((group) => ({
      ...group,
      occurrences: group.occurrences.filter((occurrence) => {
        if (occurrence.prayer !== filters.prayer) return false;
        if (isOvernightMaariv && occurrence.minutesUntil > 6 * 60) return false;
        return true;
      }),
    }));
  }, [shulGroups, filters.prayer, dateOffset]);

  const searchQuery = normalizeSearchValue(shulSearch);
  const searchedGroups = useMemo(() => {
    return filteredGroups.filter((group) => shulMatchesSearch(group, searchQuery));
  }, [filteredGroups, searchQuery]);

  const sections = useMemo(
    () => sectionize(
      searchedGroups,
      favoriteIds,
      (group) => hasUpcomingOccurrence(group, dateOffset),
      closestLimit,
    ),
    [searchedGroups, favoriteIds, dateOffset, closestLimit],
  );
  const forceNoTimesOpen =
    sections.favorites.length === 0 &&
    sections.closest.length === 0 &&
    sections.discover.length === 0 &&
    sections.expired.length === 0 &&
    sections.noTimes.length > 0;
  const shouldShowNoTimes = filters.showShulsWithoutTimes || forceNoTimesOpen;
  const expiredExpanded = !expiredCollapsed || searchQuery.length > 0;
  const noTimesExpanded = shouldShowNoTimes && (!noTimesCollapsed || forceNoTimesOpen);

  const flatList = useMemo<{ group: ShulGroup; position: number }[]>(() => {
    const visibleGroups = [
      ...sections.favorites,
      ...sections.closest,
      ...(discoverCollapsed ? [] : sections.discover),
      ...(expiredExpanded ? sections.expired : []),
      ...(noTimesExpanded ? sections.noTimes : []),
    ];
    return visibleGroups.map((group, index) => ({ group, position: index + 1 }));
  }, [sections, discoverCollapsed, expiredExpanded, noTimesExpanded]);

  useEffect(() => {
    if (!selectedShulId || !listRef.current) return;
    const selected = listRef.current.querySelector(`[data-shul="${selectedShulId}"]`);
    selected?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedShulId, flatList]);

  const upcomingCount = useMemo(() => {
    return filteredGroups
      .flatMap((group) => group.occurrences)
      .filter((occurrence) => occurrence.minutesUntil >= 0 && occurrence.minutesUntil <= 90).length;
  }, [filteredGroups]);

  const mapShuls = useMemo<MapShul[]>(() => {
    return flatList.filter(({ group }) => {
      if (mapMode === "saved") return favoriteIds.has(group.shulId);
      if (mapMode === "next") return hasUpcomingOccurrence(group, dateOffset);
      return true;
    }).map(({ group, position }) => {
      const next = group.occurrences.find((occurrence) => occurrence.minutesUntil >= 0);
      return {
        shulId: group.shulId,
        shulName: group.shulName,
        address: group.address,
        lat: group.lat,
        lng: group.lng,
        distanceMiles: group.distanceMiles,
        nusach: NUSACH_LABELS[group.nusach] ?? group.nusach,
        phone: group.phone,
        rabbi: group.rabbi,
        position,
        nextTime: next?.time,
        prayer: next?.prayer,
        minutesUntil: next?.minutesUntil,
      };
    });
  }, [flatList, mapMode, favoriteIds, dateOffset]);

  const conditionTargets = useMemo<ShulConditionTarget[]>(() => {
    const selectedGroup = selectedShulId
      ? flatList.find(({ group }) => group.shulId === selectedShulId)?.group
      : undefined;
    const groups = [
      ...(selectedGroup ? [selectedGroup] : []),
      ...flatList.map(({ group }) => group),
    ];
    const seen = new Set<string>();
    const targets: ShulConditionTarget[] = [];

    for (const group of groups) {
      if (targets.length >= 8) break;
      if (seen.has(group.shulId)) continue;
      seen.add(group.shulId);

      const next = group.occurrences.find((occurrence) => occurrence.minutesUntil >= 0);
      if (!next) continue;
      targets.push({
        shulId: group.shulId,
        shulName: group.shulName,
        lat: group.lat,
        lng: group.lng,
        distanceMiles: group.distanceMiles,
        time: next.time,
        minutesUntil: next.minutesUntil,
      });
    }

    return targets;
  }, [flatList, selectedShulId]);

  const conditionTargetKey = useMemo(() => {
    return conditionTargets
      .map((target) => `${target.shulId}:${target.time}:${target.minutesUntil}:${target.lat.toFixed(4)},${target.lng.toFixed(4)}`)
      .join("|");
  }, [conditionTargets]);
  const targetIsoDate = getTargetIsoDate(dateOffset);

  useEffect(() => {
    if (searchLat === null || searchLng === null || conditionTargets.length === 0) {
      setConditions(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    fetch("/api/shuls/conditions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: { lat: searchLat, lng: searchLng },
        targetDate: targetIsoDate,
        prayerLabel: getPrayerLabel(filters.prayer),
        targets: conditionTargets,
      }),
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : null)
      .then((data: ShulConditionsResponse | null) => {
        if (cancelled) return;
        setConditions(data);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setConditions(null);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [searchLat, searchLng, targetIsoDate, filters.prayer, conditionTargetKey, conditionTargets]);

  const selectedRouteTarget = selectedShulId
    ? conditionTargets.find((target) => target.shulId === selectedShulId && conditions?.routes[target.shulId])
    : undefined;
  const nearestRouteTarget = [...conditionTargets]
    .filter((target) => conditions?.routes[target.shulId])
    .sort((a, b) => a.distanceMiles - b.distanceMiles)[0];
  const summaryRouteTarget = selectedRouteTarget ?? nearestRouteTarget;
  const summaryRoute = summaryRouteTarget ? conditions?.routes[summaryRouteTarget.shulId] : undefined;
  const travelNudge = summaryRouteTarget && summaryRoute
    ? `${selectedRouteTarget ? "Selected shul" : "Nearest minyan"}: ${formatDistance(summaryRoute.distanceMiles)} · ${formatDriveMinutes(summaryRoute.durationMinutes)} · ${formatLeaveHint(summaryRouteTarget.minutesUntil, summaryRoute)}`
    : null;

  function handleExpand(shulId: string) {
    setExpandedShulId(shulId);
    setSelectedShulId(shulId);
  }

  function handleTravelNudgeClick() {
    if (!summaryRouteTarget) return;
    const shulId = summaryRouteTarget.shulId;

    if (sections.discover.some((group) => group.shulId === shulId)) {
      setDiscoverCollapsed(false);
    }
    if (sections.expired.some((group) => group.shulId === shulId)) {
      setExpiredCollapsed(false);
    }
    if (sections.noTimes.some((group) => group.shulId === shulId)) {
      setNoTimesCollapsed(false);
    }

    setMapMode((current) => current === "saved" && !favoriteIds.has(shulId) ? "next" : current);
    handleExpand(shulId);
  }

  function handleCollapse(shulId: string) {
    setExpandedShulId((current) => current === shulId ? null : current);
    setSelectedShulId((current) => current === shulId ? null : current);
  }

  function handleAdd(occurrence: MinyanOccurrence) {
    const result = addMinyanToCalendar({
      storageScope,
      prayer: occurrence.prayer,
      shulName: occurrence.shulName,
      address: occurrence.address,
      time: occurrence.time,
      durationMins: 30,
      date: targetIsoDate,
    });

    setAddedKeys((current) => new Set([...current, occurrence.key]));

    const verb = result.kind === "replaced" ? "Switched" : "Added";
    toast.push({
      message: `${verb} ${result.goalTitle} at ${occurrence.shulName}`,
      subtext: `${formatTime(occurrence.time, prefs.timeFormat)} on ${targetIsoDate}`,
      href: "/planner?view=day",
      variant: "success",
    });
  }

  function handleToggleFavorite(group: ShulGroup) {
    if (favoriteIds.has(group.shulId)) {
      removeFavorite(group.shulId);
    } else {
      const sample: MinyanOccurrence = group.occurrences[0] ?? {
        key: group.shulId,
        shulId: group.shulId,
        shulName: group.shulName,
        address: group.address,
        lat: group.lat,
        lng: group.lng,
        nusach: group.nusach,
        phone: group.phone,
        rabbi: group.rabbi,
        prayer: filters.prayer,
        time: "00:00",
        distanceMiles: group.distanceMiles,
        minutesUntil: 0,
      };
      addFavorite(sample);
    }
    refreshFavorites();
  }

  function resetSmartDefaults() {
    setDateOffset(0);
    setFilters({
      prayer: getSmartPrayer(detectedPrayer, davenedToday),
      nusach: "all",
      distanceMi: 5,
      showShulsWithoutTimes: true,
    });
    setDiscoverCollapsed(true);
    setExpiredCollapsed(false);
    setNoTimesCollapsed(true);
    setShulSearch("");
    setMapMode("next");
    setClosestLimit(DEFAULT_CLOSEST_LIMIT);
  }

  function renderCard({ group, position }: { group: ShulGroup; position: number }) {
    return (
      <ShulCard
        key={group.shulId}
        group={group}
        position={position}
        activePrayer={filters.prayer}
        expanded={expandedShulId === group.shulId}
        isFav={favoriteIds.has(group.shulId)}
        addedKeys={addedKeys}
        timeFormat={prefs.timeFormat}
        dateOffset={dateOffset}
        routeInsight={conditions?.routes[group.shulId]}
        onExpand={() => handleExpand(group.shulId)}
        onCollapse={() => handleCollapse(group.shulId)}
        onAdd={handleAdd}
        onToggleFav={() => handleToggleFavorite(group)}
      />
    );
  }

  const favoriteItems = flatList.filter(({ group }) => sections.favorites.includes(group));
  const closestItems = flatList.filter(({ group }) => sections.closest.includes(group));
  const discoverItems = flatList.filter(({ group }) => sections.discover.includes(group));
  const expiredItems = flatList.filter(({ group }) => sections.expired.includes(group));
  const noTimesItems = flatList.filter(({ group }) => sections.noTimes.includes(group));
  const noTimesTitle = forceNoTimesOpen
    ? "Nearby Shuls"
    : dateOffset === 0
      ? "No Schedule Today"
      : dateOffset === 1
        ? "No Schedule Tomorrow"
        : "No Schedule";
  const savedLocationFromPrefs = getPreferenceLocation(prefs);

  return (
    <div className="flex flex-col gap-4">
      <SmartBar
        detectedPrayer={detectedPrayer}
        activePrayer={filters.prayer}
        davenedToday={davenedToday}
        upcomingCount={upcomingCount}
        totalShuls={shulGroups.length}
        loading={loading}
        travelNudge={travelNudge}
        travelProvider={summaryRoute?.provider}
        currentWeather={conditions?.currentWeather ?? null}
        weatherInsight={conditions?.weather ?? null}
        locationLabel={locationLabel}
        locationSource={locationSource}
        distanceMi={filters.distanceMi}
        nusach={filters.nusach}
        showShulsWithoutTimes={filters.showShulsWithoutTimes}
        closestLimit={closestLimit}
        dateOffset={dateOffset}
        calendarHref={`/planner?view=day&date=${targetIsoDate}`}
        onOpenLocation={() => setLocationOpen(true)}
        onPrayerChange={(prayer) => setFilters((current) => ({ ...current, prayer }))}
        onDistanceChange={(distanceMi) => setFilters((current) => ({ ...current, distanceMi }))}
        onNusachChange={(nusach) => setFilters((current) => ({ ...current, nusach }))}
        onShowShulsWithoutTimesChange={(showShulsWithoutTimes) => setFilters((current) => ({ ...current, showShulsWithoutTimes }))}
        onClosestLimitChange={(limit) => {
          if (isClosestLimit(limit)) setClosestLimit(limit);
        }}
        onResetSmartDefaults={resetSmartDefaults}
        onTravelNudgeClick={summaryRouteTarget ? handleTravelNudgeClick : undefined}
        onPrevDate={() => setDateOffset((d) => d - 1)}
        onNextDate={() => setDateOffset((d) => d + 1)}
        onToday={() => setDateOffset(0)}
      />

      {refetching && (
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-brand/10">
          <div className="h-full w-1/3 animate-pulse bg-brand" />
        </div>
      )}

      <div className="flex min-h-[520px] flex-col overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm sm:h-[calc(100vh-18rem)] sm:flex-row">
        <div ref={listRef} className="flex max-h-[52vh] w-full shrink-0 flex-col overflow-y-auto border-b border-slate-100 sm:max-h-none sm:w-[390px] sm:border-b-0 sm:border-r lg:w-[410px]">
          <div className="sticky top-0 z-[3] border-b border-slate-100 bg-white/95 p-3 backdrop-blur">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                value={shulSearch}
                onChange={(event) => setShulSearch(event.target.value)}
                placeholder="Search shuls"
                className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-slate-700 outline-none placeholder:text-slate-400"
              />
              {shulSearch && (
                <button
                  type="button"
                  onClick={() => setShulSearch("")}
                  className="rounded p-0.5 text-slate-400 transition hover:bg-white hover:text-slate-600"
                  aria-label="Clear shul search"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          {loading ? (
            <SkeletonList />
          ) : flatList.length === 0 && !refetching ? (
            <EmptyState onReset={resetSmartDefaults} />
          ) : flatList.length === 0 ? (
            <SkeletonList />
          ) : (
            <>
              {sections.favorites.length > 0 && (
                <>
                  <SectionHeader icon={Star} title="My Shuls" count={sections.favorites.length} />
                  {favoriteItems.map(renderCard)}
                </>
              )}

              {sections.closest.length > 0 && (
                <>
                  <SectionHeader
                    icon={MapPin}
                    title="Closest With Minyan"
                    count={sections.closest.length}
                    countControl={
                      <label className="relative inline-flex h-6 items-center">
                        <span className="sr-only">Closest shuls to show</span>
                        <select
                          value={closestLimit}
                          onChange={(event) => {
                            const nextLimit = Number(event.target.value);
                            if (isClosestLimit(nextLimit)) setClosestLimit(nextLimit);
                          }}
                          className="h-6 rounded-full border border-slate-200 bg-white py-0 pl-2 pr-6 text-[11px] font-extrabold text-slate-500 outline-none transition hover:border-brand/30 hover:text-brand focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
                          title="Closest shuls to show"
                        >
                          {CLOSEST_LIMIT_OPTIONS.map((limit) => (
                            <option key={limit} value={limit}>
                              {limit}
                            </option>
                          ))}
                        </select>
                      </label>
                    }
                  />
                  {closestItems.map(renderCard)}
                </>
              )}

              {sections.discover.length > 0 && (
                <>
                  <SectionHeader
                    icon={Search}
                    title="Discover Nearby"
                    count={sections.discover.length}
                    collapsed={discoverCollapsed}
                    onToggle={() => setDiscoverCollapsed((current) => !current)}
                  />
                  {!discoverCollapsed && discoverItems.map(renderCard)}
                </>
              )}

              {sections.expired.length > 0 && (
                <>
                  <SectionHeader
                    icon={Clock}
                    title={dateOffset === 0 ? "Missed Today" : "Earlier Times"}
                    count={sections.expired.length}
                    collapsed={!expiredExpanded}
                    onToggle={() => setExpiredCollapsed((current) => !current)}
                  />
                  {expiredExpanded && expiredItems.map(renderCard)}
                </>
              )}

              {shouldShowNoTimes && sections.noTimes.length > 0 && (
                <>
                  <SectionHeader
                    icon={Circle}
                    title={noTimesTitle}
                    count={sections.noTimes.length}
                    collapsed={!noTimesExpanded}
                    onToggle={() => setNoTimesCollapsed((current) => !current)}
                  />
                  {noTimesExpanded && noTimesItems.map(renderCard)}
                </>
              )}
            </>
          )}
        </div>

        <div className="relative min-h-[360px] flex-1 overflow-hidden bg-slate-100">
          <div className="absolute right-3 top-3 z-[1000] flex overflow-hidden rounded-lg border border-white/80 bg-white/95 p-0.5 shadow-lg backdrop-blur">
            {([
              ["next", "Next"],
              ["all", "All"],
              ["saved", "Saved"],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setMapMode(mode)}
                aria-pressed={mapMode === mode}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-bold transition",
                  mapMode === mode
                    ? "bg-brand text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {searchLat !== null && searchLng !== null ? (
            <ShulsMap
              shuls={mapShuls}
              selectedShulId={selectedShulId}
              onSelect={(shulId) => handleExpand(shulId)}
              userLat={searchLat}
              userLng={searchLng}
              favoriteIds={favoriteIds}
              timeFormat={prefs.timeFormat}
            />
          ) : (
            <div className="h-full w-full animate-pulse bg-slate-100" />
          )}
        </div>
      </div>

      <LocationSearch
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        currentLocationLabel={locationLabel}
        isUsingGps={isUsingGps}
        onSelectLocation={(location) => {
          setManualLocation(location);
          setExpandedShulId(null);
          setSelectedShulId(null);
        }}
        onUseGps={() => {
          setManualLocation(null);
          setExpandedShulId(null);
          setSelectedShulId(null);
        }}
        savedLocation={savedLocationFromPrefs}
      />
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
        <p className="text-[12px] font-semibold text-slate-600">Finding nearby shuls...</p>
        <p className="mt-0.5 text-[11px] text-slate-400">Checking GoDaven times can take a moment.</p>
      </div>
      {[1, 2, 3, 4, 5].map((index) => (
        <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <p className="text-[13px] font-semibold text-slate-600">No shuls match your filters</p>
      <p className="text-[11px] text-slate-400">Try widening the distance or changing nusach.</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-2 rounded-md bg-brand px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-strong"
      >
        Reset to smart defaults
      </button>
    </div>
  );
}
