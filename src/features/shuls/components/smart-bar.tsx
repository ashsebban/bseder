"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloudFog,
  CloudRain,
  CloudSnow,
  MapPin,
  Moon,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sun,
  Sunrise,
  Thermometer,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { Prayer } from "@/features/shuls/types/minyan";
import type { CurrentWeather, WeatherInsight } from "@/features/shuls/types/conditions";
import { getPrayerLabel } from "@/features/shuls/lib/prayer-detector";
import { cn } from "@/lib/cn";

type DistanceMi = 0.5 | 1 | 2 | 5;
type NusachFilter = "all" | "ashkenaz" | "sfard";
type MenuKey = "prayer" | "distance" | "nusach" | "more";

const DISTANCE_OPTIONS = [0.5, 1, 2, 5] as const;
const CLOSEST_LIMIT_OPTIONS = [5, 10, 15, 20] as const;

const PRAYER_ICONS: Record<Prayer, typeof Moon> = {
  shacharit: Sunrise,
  mincha: Sun,
  maariv: Moon,
};

const WEATHER_ICONS: Record<WeatherInsight["kind"], LucideIcon> = {
  rain: CloudRain,
  snow: CloudSnow,
  cold: Thermometer,
  heat: Thermometer,
  wind: Wind,
  fog: CloudFog,
};

const NUSACH_LABELS: Record<NusachFilter, string> = {
  all: "All nusach",
  ashkenaz: "Ashkenaz",
  sfard: "Sfard",
};

function getDateLabel(offset: number): string {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  if (offset === -1) return "Yesterday";
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

interface SmartBarProps {
  detectedPrayer: Prayer;
  activePrayer: Prayer;
  davenedToday: Record<Prayer, boolean>;
  upcomingCount: number;
  totalShuls: number;
  loading: boolean;
  travelNudge?: string | null;
  travelProvider?: "traffic" | "estimate";
  currentWeather?: CurrentWeather | null;
  weatherInsight?: WeatherInsight | null;
  locationLabel: string;
  locationSource: "gps" | "manual" | "saved";
  distanceMi: DistanceMi;
  nusach: NusachFilter;
  showShulsWithoutTimes: boolean;
  closestLimit: number;
  dateOffset: number;
  calendarHref: string;
  onOpenLocation: () => void;
  onPrayerChange: (prayer: Prayer) => void;
  onDistanceChange: (distance: DistanceMi) => void;
  onNusachChange: (nusach: NusachFilter) => void;
  onShowShulsWithoutTimesChange: (show: boolean) => void;
  onClosestLimitChange: (limit: number) => void;
  onResetSmartDefaults: () => void;
  onTravelNudgeClick?: () => void;
  onPrevDate: () => void;
  onNextDate: () => void;
  onToday: () => void;
}

export function SmartBar({
  detectedPrayer,
  activePrayer,
  davenedToday,
  upcomingCount,
  totalShuls,
  loading,
  travelNudge,
  travelProvider,
  currentWeather,
  weatherInsight,
  locationLabel,
  locationSource,
  distanceMi,
  nusach,
  showShulsWithoutTimes,
  closestLimit,
  dateOffset,
  calendarHref,
  onOpenLocation,
  onPrayerChange,
  onDistanceChange,
  onNusachChange,
  onShowShulsWithoutTimesChange,
  onClosestLimitChange,
  onResetSmartDefaults,
  onTravelNudgeClick,
  onPrevDate,
  onNextDate,
  onToday,
}: SmartBarProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const ActiveIcon = PRAYER_ICONS[activePrayer];
  const WeatherIcon = weatherInsight ? WEATHER_ICONS[weatherInsight.kind] : null;
  const undavenedNext = (["shacharit", "mincha", "maariv"] as Prayer[]).find((prayer) => !davenedToday[prayer]);
  const statusLine = dateOffset !== 0
    ? null
    : davenedToday[detectedPrayer] && undavenedNext && undavenedNext !== detectedPrayer
      ? `You davened ${getPrayerLabel(detectedPrayer)}. Next: ${getPrayerLabel(undavenedNext)}`
      : davenedToday[activePrayer]
        ? `Already davened ${getPrayerLabel(activePrayer)}`
        : null;

  useEffect(() => {
    if (!openMenu) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpenMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenu(null);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenu]);

  function toggleMenu(menu: MenuKey) {
    setOpenMenu((current) => current === menu ? null : menu);
  }

  return (
    <div ref={rootRef} className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            onClick={onOpenLocation}
            className="inline-flex min-w-0 items-center gap-2 rounded-md text-left transition hover:text-brand"
            title="Change location"
          >
            <MapPin className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
            <span className="max-w-[min(560px,calc(100vw-5rem))] truncate text-[17px] font-extrabold leading-6 text-slate-900">
              {locationLabel}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          </button>

          {locationSource === "gps" && (
            <span className="inline-flex h-6 items-center rounded-full border border-brand/15 bg-brand/[0.06] px-2 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-brand">
              Current
            </span>
          )}

          {!loading && upcomingCount > 0 && (
            <span className="inline-flex h-7 items-center rounded-full bg-green-50 px-3 text-[12px] font-extrabold text-green-700">
              {upcomingCount} soon
            </span>
          )}

          {!loading && totalShuls > 0 && (
            <span className="text-[12.5px] font-semibold text-slate-400">{totalShuls} nearby</span>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="inline-flex h-9 items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={onPrevDate}
              className="flex h-full w-9 items-center justify-center text-slate-400 transition hover:bg-white hover:text-slate-600"
              aria-label="Previous day"
              title="Previous day"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="min-w-[86px] px-2 text-center text-[12px] font-extrabold text-slate-600">
              {getDateLabel(dateOffset)}
            </span>
            <button
              type="button"
              onClick={onNextDate}
              className="flex h-full w-9 items-center justify-center text-slate-400 transition hover:bg-white hover:text-slate-600"
              aria-label="Next day"
              title="Next day"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {dateOffset !== 0 && (
            <button
              type="button"
              onClick={onToday}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Today
            </button>
          )}

          <Link
            href={calendarHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand/20 bg-brand/[0.06] px-3 text-[12px] font-bold text-brand transition hover:bg-brand/[0.12]"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Calendar
          </Link>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-slate-100 pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <FilterMenuButton
            open={openMenu === "prayer"}
            onClick={() => toggleMenu("prayer")}
            icon={ActiveIcon}
            label={getPrayerLabel(activePrayer)}
          >
            <MenuLabel>Prayer</MenuLabel>
            {(["shacharit", "mincha", "maariv"] as Prayer[]).map((prayer) => {
              const Icon = PRAYER_ICONS[prayer];
              return (
                <MenuOption
                  key={prayer}
                  selected={activePrayer === prayer}
                  onClick={() => {
                    onPrayerChange(prayer);
                    setOpenMenu(null);
                  }}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {getPrayerLabel(prayer)}
                </MenuOption>
              );
            })}
          </FilterMenuButton>

          <FilterMenuButton
            open={openMenu === "distance"}
            onClick={() => toggleMenu("distance")}
            icon={SlidersHorizontal}
            label={`${distanceMi} mi`}
          >
            <MenuLabel>Distance</MenuLabel>
            <div className="grid grid-cols-2 gap-1">
              {DISTANCE_OPTIONS.map((distance) => (
                <button
                  key={distance}
                  type="button"
                  onClick={() => {
                    onDistanceChange(distance);
                    setOpenMenu(null);
                  }}
                  className={cn(
                    "rounded-md border px-3 py-2 text-[12px] font-extrabold transition",
                    distanceMi === distance
                      ? "border-brand/25 bg-brand/[0.08] text-brand"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {distance} mi
                </button>
              ))}
            </div>
          </FilterMenuButton>

          <FilterMenuButton
            open={openMenu === "nusach"}
            onClick={() => toggleMenu("nusach")}
            icon={Settings2}
            label={NUSACH_LABELS[nusach]}
          >
            <MenuLabel>Nusach</MenuLabel>
            {(["all", "ashkenaz", "sfard"] as NusachFilter[]).map((option) => (
              <MenuOption
                key={option}
                selected={nusach === option}
                onClick={() => {
                  onNusachChange(option);
                  setOpenMenu(null);
                }}
              >
                {NUSACH_LABELS[option]}
              </MenuOption>
            ))}
          </FilterMenuButton>

          <FilterMenuButton
            open={openMenu === "more"}
            onClick={() => toggleMenu("more")}
            icon={SlidersHorizontal}
            label="More"
            align="right"
          >
            <MenuLabel>More Options</MenuLabel>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-700">
              <span>Show shuls without times</span>
              <input
                type="checkbox"
                checked={showShulsWithoutTimes}
                onChange={(event) => onShowShulsWithoutTimesChange(event.target.checked)}
                className="h-4 w-4 accent-brand"
              />
            </label>

            <div className="mt-3">
              <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                Closest section
              </p>
              <div className="grid grid-cols-4 gap-1">
                {CLOSEST_LIMIT_OPTIONS.map((limit) => (
                  <button
                    key={limit}
                    type="button"
                    onClick={() => onClosestLimitChange(limit)}
                    className={cn(
                      "rounded-md border px-2 py-1.5 text-[11px] font-extrabold transition",
                      closestLimit === limit
                        ? "border-brand/25 bg-brand/[0.08] text-brand"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {limit}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onResetSmartDefaults();
                setOpenMenu(null);
              }}
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white text-[12px] font-bold text-slate-600 transition hover:border-brand/30 hover:text-brand"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reset defaults
            </button>
          </FilterMenuButton>

          {travelNudge && (
            <button
              type="button"
              onClick={onTravelNudgeClick}
              disabled={!onTravelNudgeClick}
              className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-600 transition hover:border-brand/30 hover:bg-brand/[0.04] hover:text-slate-800 disabled:cursor-default disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-600"
              title="Show this minyan on the map and in the list"
            >
              <Car className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
              <span className="truncate">{travelNudge}</span>
              {travelProvider === "estimate" && <span className="text-slate-400">est.</span>}
            </button>
          )}

          {currentWeather && (
            <span
              className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-600"
              title={`Feels like ${currentWeather.apparentTemperatureF}°F · wind ${Math.round(currentWeather.windMph)} mph`}
            >
              <Thermometer className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
              <span className="truncate">{currentWeather.label}</span>
            </span>
          )}

          {weatherInsight && WeatherIcon && (
            <span
              className={cn(
                "inline-flex h-9 max-w-full items-center gap-1.5 rounded-lg border px-3 text-[12px] font-bold",
                weatherInsight.tone === "alert"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : weatherInsight.tone === "watch"
                    ? "border-sky-200 bg-sky-50 text-sky-800"
                    : "border-slate-200 bg-white text-slate-600",
              )}
              title={weatherInsight.detail}
            >
              <WeatherIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{weatherInsight.label}</span>
            </span>
          )}
        </div>

        {statusLine && (
          <p className="inline-flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-slate-500">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" aria-hidden="true" />
            <span className="truncate">{statusLine}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function FilterMenuButton({
  open,
  onClick,
  icon: Icon,
  label,
  align = "left",
  children,
}: {
  open: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  align?: "left" | "right";
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        aria-expanded={open}
        className={cn(
          "inline-flex h-9 min-w-0 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-bold transition",
          open
            ? "border-brand/30 bg-brand/[0.06] text-slate-800"
            : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white",
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
        <span className="max-w-[150px] truncate">{label}</span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <div
          className={cn(
            "absolute top-[calc(100%+0.5rem)] z-[1200] w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-xl",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 px-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
      {children}
    </p>
  );
}

function MenuOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[12px] font-bold transition",
        selected ? "bg-brand/[0.08] text-brand" : "text-slate-600 hover:bg-slate-50",
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
      </span>
      {children}
    </button>
  );
}
