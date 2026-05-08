"use client";

import { Check, MapPin, Navigation, Phone, Plus, Star, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { MinyanOccurrence, Prayer, ShulGroup } from "@/features/shuls/types/minyan";
import type { RouteInsight } from "@/features/shuls/types/conditions";
import { getPrayerLabel } from "@/features/shuls/lib/prayer-detector";

const NUSACH_LABELS: Record<string, string> = {
  ashkenaz: "Ashkenaz",
  sfard: "Sfard",
  sephardi: "Sephardi",
  chabad: "Chabad",
  temanim: "Temanim",
  custom: "Custom",
};

function formatTime(hhmm: string, timeFormat: "12h" | "24h"): string {
  const [hour, minute] = hhmm.split(":").map(Number);
  if (timeFormat === "12h") {
    const period = (hour ?? 0) >= 12 ? "PM" : "AM";
    const h12 = (hour ?? 0) % 12 || 12;
    return `${h12}:${(minute ?? 0).toString().padStart(2, "0")} ${period}`;
  }
  return hhmm;
}

function parseTimeMins(hhmm: string): number {
  const [hour, minute] = hhmm.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function formatUntil(minutes: number): string {
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `in ${hours}h` : `in ${hours}h ${remainder}m`;
}

function formatDistance(distance: number): string {
  return distance < 0.1 ? "< 0.1 mi" : `${distance.toFixed(2)} mi`;
}

function formatDriveMinutes(minutes: number): string {
  return minutes <= 1 ? "1 min drive" : `${minutes} min drive`;
}

function formatLeaveHint(occurrence: MinyanOccurrence, route: RouteInsight): string {
  const bufferMins = 2;
  const leaveIn = occurrence.minutesUntil - route.durationMinutes - bufferMins;
  const arrivalMargin = occurrence.minutesUntil - route.durationMinutes;

  if (arrivalMargin < -2) return "too tight";
  if (leaveIn <= 0) return "leave now";
  if (leaveIn < 60) return `leave in ${leaveIn} min`;
  const hours = Math.floor(leaveIn / 60);
  const mins = leaveIn % 60;
  return mins === 0 ? `leave in ${hours}h` : `leave in ${hours}h ${mins}m`;
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function formatOccurrenceStatus(occurrence: MinyanOccurrence, dateOffset: number): string | null {
  if (dateOffset !== 0) return null;
  if (occurrence.minutesUntil < -5) return "passed";
  return formatUntil(occurrence.minutesUntil);
}

function canAddOccurrence(occurrence: MinyanOccurrence, dateOffset: number): boolean {
  return dateOffset >= 0 && (dateOffset !== 0 || occurrence.minutesUntil >= -5);
}

function isPassed(occurrence: MinyanOccurrence | undefined, dateOffset: number): boolean {
  return Boolean(occurrence && dateOffset === 0 && occurrence.minutesUntil < -5);
}

function statusClassName(occurrence: MinyanOccurrence, dateOffset: number): string {
  if (isPassed(occurrence, dateOffset)) return "text-slate-400";
  if (dateOffset === 0 && occurrence.minutesUntil <= 10) return "text-amber-600";
  return "text-slate-500";
}

interface ShulCardProps {
  group: ShulGroup;
  position: number;
  activePrayer: Prayer;
  expanded: boolean;
  isFav: boolean;
  addedKeys: Set<string>;
  timeFormat: "12h" | "24h";
  dateOffset: number;
  routeInsight?: RouteInsight;
  onExpand: () => void;
  onCollapse: () => void;
  onAdd: (occurrence: MinyanOccurrence) => void;
  onToggleFav: () => void;
}

export function ShulCard({
  group,
  position,
  activePrayer,
  expanded,
  isFav,
  addedKeys,
  timeFormat,
  dateOffset,
  routeInsight,
  onExpand,
  onCollapse,
  onAdd,
  onToggleFav,
}: ShulCardProps) {
  const dateLabel = dateOffset === 0 ? "today" : dateOffset === 1 ? "tomorrow" : dateOffset === -1 ? "yesterday" : "that day";
  const chronological = [...group.occurrences].sort((a, b) => parseTimeMins(a.time) - parseTimeMins(b.time));
  const upcoming = chronological.filter((occurrence) => occurrence.minutesUntil >= -5);
  const mostRecentPassed = [...chronological].reverse().find((occurrence) => occurrence.minutesUntil < -5);
  const displayOccurrences = dateOffset === 0 && upcoming.length > 0
    ? [...upcoming, ...chronological.filter((occurrence) => occurrence.minutesUntil < -5)]
    : chronological;
  const next = upcoming[0] ?? (dateOffset === 0 ? mostRecentPassed : chronological[0]);
  const nextStatus = next ? formatOccurrenceStatus(next, dateOffset) : null;
  const canAddNext = next ? canAddOccurrence(next, dateOffset) : false;
  const nextWasAdded = next ? addedKeys.has(next.key) : false;
  const phoneHref = group.phone?.replace(/\D/g, "") ?? "";
  const routeHint = next && routeInsight && !isPassed(next, dateOffset)
    ? {
        drive: formatDriveMinutes(routeInsight.durationMinutes),
        leave: formatLeaveHint(next, routeInsight),
        estimated: routeInsight.provider === "estimate",
      }
    : null;

  return (
    <div
      className={cn(
        "border-b border-slate-100 bg-white transition-colors last:border-0",
        expanded ? "shadow-[inset_3px_0_0_rgb(var(--color-brand))]" : "hover:bg-slate-50/80",
      )}
      data-shul={group.shulId}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={expanded ? onCollapse : onExpand}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (expanded) onCollapse();
            else onExpand();
          }
        }}
        className={cn(
          "grid w-full cursor-pointer grid-cols-[1.75rem,minmax(0,1fr),auto] items-center gap-3 px-4 py-3 text-left",
          expanded && "bg-brand/[0.035]",
        )}
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold tabular-nums",
            expanded
              ? "bg-brand text-white shadow-sm"
              : isFav
                ? "border border-amber-200 bg-amber-50 text-amber-700"
                : "bg-slate-100 text-slate-500",
          )}
        >
          {position}
        </span>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            {isFav && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" aria-hidden="true" />}
            <p className={cn("truncate text-[13.5px] font-extrabold leading-5", expanded ? "text-brand" : "text-slate-800")}>
              {group.shulName}
            </p>
          </div>

          {next ? (
            <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] leading-4 text-slate-400">
              <span
                className={cn(
                  "font-bold tabular-nums",
                  isPassed(next, dateOffset) ? "text-slate-400" : "text-slate-700",
                )}
              >
                {formatTime(next.time, timeFormat)}
              </span>
              {nextStatus && (
                <span className={cn("font-semibold", statusClassName(next, dateOffset))}>
                  {nextStatus}
                </span>
              )}
              <span className="text-slate-300">/</span>
              <span>{formatDistance(group.distanceMiles)}</span>
              <span className="text-slate-300">/</span>
              <span className="truncate">{NUSACH_LABELS[group.nusach] ?? group.nusach}</span>
            </p>
          ) : (
            <p className="mt-0.5 truncate text-[11.5px] leading-4 text-slate-400">
              No {getPrayerLabel(activePrayer)} times {dateLabel}
              <span className="ml-1.5">/ {formatDistance(group.distanceMiles)}</span>
            </p>
          )}
          {!expanded && routeHint && (
            <p
              className={cn(
                "mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-semibold leading-4",
                routeHint.leave === "too tight" ? "text-amber-700" : routeHint.leave === "leave now" ? "text-brand" : "text-slate-500",
              )}
            >
              <Navigation className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{routeHint.drive}{routeHint.estimated ? " est." : ""}</span>
              <span className="text-slate-300">/</span>
              <span>{routeHint.leave}</span>
            </p>
          )}
        </div>

        {!expanded && next && canAddNext && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAdd(next);
            }}
            disabled={nextWasAdded}
            className={cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/25",
              nextWasAdded
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-brand/20 bg-brand/[0.06] text-brand hover:bg-brand/[0.12]",
            )}
            aria-label={nextWasAdded ? "Minyan added" : `Add ${formatTime(next.time, timeFormat)} minyan`}
            title={nextWasAdded ? "Added" : "Add to calendar"}
          >
            {nextWasAdded ? <Check className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4">
          <div className="ml-10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5 text-[12px] leading-5 text-slate-500">
                <p className="font-medium text-slate-600">{group.address}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-medium text-slate-400">
                  {group.rabbi && <span className="max-w-full truncate">Rabbi {titleCase(group.rabbi)}</span>}
                  {group.phone && (
                    <a
                      href={`tel:${phoneHref}`}
                      className="inline-flex items-center gap-1 transition hover:text-slate-600"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      {group.phone}
                    </a>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatDistance(group.distanceMiles)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCollapse();
                }}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Collapse shul"
                title="Collapse"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3">
              <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                {getPrayerLabel(activePrayer)} times {dateLabel}
              </p>
              {displayOccurrences.length === 0 ? (
                <p className="text-[12px] text-slate-400">No {getPrayerLabel(activePrayer)} times {dateLabel}</p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {displayOccurrences.map((occurrence) => {
                    const added = addedKeys.has(occurrence.key);
                    const canAdd = canAddOccurrence(occurrence, dateOffset);
                    const status = formatOccurrenceStatus(occurrence, dateOffset);
                    const primary = next?.key === occurrence.key && canAdd && !added;
                    return (
                      <button
                        key={occurrence.key}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (canAdd) onAdd(occurrence);
                        }}
                        disabled={added || !canAdd}
                        className={cn(
                          "flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-md border px-2 text-[12px] font-bold tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20",
                          added
                            ? "border-green-200 bg-green-50 text-green-700"
                            : !canAdd
                              ? "cursor-default border-slate-200 bg-slate-50 text-slate-400"
                              : primary
                                ? "border-brand/25 bg-brand/[0.07] text-slate-800 hover:border-brand/40 hover:bg-brand/[0.11]"
                                : "border-slate-200 bg-white text-slate-700 hover:border-brand/30 hover:bg-brand/[0.04]",
                        )}
                        title={canAdd ? "Add to calendar" : undefined}
                      >
                        {added && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                        <span className="truncate">{formatTime(occurrence.time, timeFormat)}</span>
                        {status && (
                          <span className={cn("truncate text-[10.5px] font-semibold", added ? "text-green-600" : statusClassName(occurrence, dateOffset))}>
                            {added ? "added" : status}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {routeHint && (
              <div
                className={cn(
                  "mt-3 flex flex-wrap items-center gap-1.5 rounded-md border px-3 py-2 text-[12px] font-semibold",
                  routeHint.leave === "too tight"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-brand/15 bg-brand/[0.04] text-slate-600",
                )}
              >
                <Navigation className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
                <span>{routeHint.drive}{routeHint.estimated ? " est." : ""}</span>
                <span className="text-slate-300">/</span>
                <span>{routeHint.leave}</span>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleFav();
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-bold transition",
                  isFav
                    ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:text-amber-700",
                )}
              >
                <Star className={cn("h-3.5 w-3.5", isFav && "fill-current")} aria-hidden="true" />
                {isFav ? "Saved" : "Save"}
              </button>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(group.address)}`}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                Directions
              </a>
              {group.phone && (
                <a
                  href={`tel:${phoneHref}`}
                  onClick={(event) => event.stopPropagation()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  Call
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
