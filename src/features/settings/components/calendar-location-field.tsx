"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { Select } from "@/components/ui/select";
import { calendarLocationGroups, calendarLocationOptions, getCalendarLocationByKey } from "@/features/calendar/lib/locations";
import type { CalendarLocationOption } from "@/features/calendar/lib/locations";
import type { CustomLocation } from "@/features/settings/types/calendar-preferences";

type LocationMode = "preset" | "my-location" | "zip";

export interface CalendarLocationFieldValue {
  locationKey: string;
  customLocation?: CustomLocation;
}

interface CalendarLocationFieldProps {
  value: CalendarLocationFieldValue;
  onChange: (next: CalendarLocationFieldValue) => void;
  label?: string;
  description?: React.ReactNode;
  variant?: "compact" | "comfortable";
  allowBlankPreset?: boolean;
}

function deriveLocationMode(locationKey: string): LocationMode {
  if (locationKey === "my-location") return "my-location";
  if (locationKey === "zip") return "zip";
  return "preset";
}

/** Returns a human-readable label for whatever location is currently active. */
function getResolvedLabel(locationKey: string, customLocation?: CustomLocation): string | null {
  if (locationKey === "my-location" || locationKey === "zip") {
    return customLocation?.label ?? null;
  }
  return getCalendarLocationByKey(locationKey)?.label ?? null;
}

/**
 * Finds the nearest preset city to a lat/lng coordinate using Euclidean distance.
 * Used to label GPS coordinates with a real city name instead of "Current Location".
 */
function findNearestPreset(lat: number, lng: number): CalendarLocationOption | null {
  let nearest: CalendarLocationOption | null = null;
  let minDist = Infinity;
  for (const opt of calendarLocationOptions) {
    const d = Math.hypot(opt.lat - lat, opt.lng - lng);
    if (d < minDist) {
      minDist = d;
      nearest = opt;
    }
  }
  return nearest;
}

function stateFromIsoCode(value: string | undefined): string | null {
  if (!value) return null;
  const parts = value.split("-");
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

function regionFromFallbackLabel(label: string): string | null {
  const parts = label.split(",");
  if (parts.length < 2) return null;
  return parts[1].trim() || null;
}

async function lookupPostalAwareLabel(
  lat: number,
  lng: number,
  fallbackLabel: string,
): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&zoom=18&addressdetails=1`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en",
        },
      },
    );
    if (!response.ok) return fallbackLabel;

    const data = await response.json() as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        hamlet?: string;
        municipality?: string;
        county?: string;
        state?: string;
        postcode?: string;
        ["ISO3166-2-lvl4"]?: string;
      };
    };

    const address = data.address;
    if (!address) return fallbackLabel;

    const city =
      address.city ||
      address.town ||
      address.village ||
      address.hamlet ||
      address.municipality ||
      address.county ||
      fallbackLabel.split(",")[0].trim();

    const region =
      stateFromIsoCode(address["ISO3166-2-lvl4"]) ||
      address.state ||
      regionFromFallbackLabel(fallbackLabel);

    const postcode = address.postcode?.trim();

    if (city && region && postcode) return `${city}, ${region} ${postcode}`;
    if (city && region) return `${city}, ${region}`;
    if (postcode) return `${fallbackLabel} ${postcode}`;
    return fallbackLabel;
  } catch {
    return fallbackLabel;
  }
}

export function CalendarLocationField({
  value,
  onChange,
  label = "Location",
  description,
  variant = "comfortable",
  allowBlankPreset = false,
}: CalendarLocationFieldProps) {
  const hasCustomSelection = value.locationKey === "my-location" || value.locationKey === "zip";
  const [locationMode, setLocationMode] = useState<LocationMode>(() => deriveLocationMode(value.locationKey));
  const [zipInput, setZipInput] = useState("");
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    setLocationMode(deriveLocationMode(value.locationKey));
  }, [value.locationKey]);

  const resolvedLabel = useMemo(
    () => getResolvedLabel(value.locationKey, value.customLocation),
    [value.locationKey, value.customLocation],
  );

  const sizing = useMemo(() => {
    if (variant === "compact") {
      return {
        tabClassName: "py-1 text-[11px]",
        selectClassName: "h-8 rounded-lg px-3 pr-8 text-[12.5px]",
        inputClassName: "h-8 rounded-lg px-3 text-[12.5px]",
        buttonClassName: "h-8 rounded-lg px-3 text-[12.5px]",
        labelClassName: "mb-1.5 block text-[12.5px] font-medium text-text",
        descriptionClassName: "mb-2 text-[11px] text-text-subtle",
        helpClassName: "text-[11px]",
        usingClassName: "text-[10.5px]",
      };
    }
    return {
      tabClassName: "py-2 text-[12.5px]",
      selectClassName: "h-12 rounded-2xl px-4 pr-11 text-sm",
      inputClassName: "h-12 rounded-2xl px-4 text-sm",
      buttonClassName: "h-12 rounded-2xl px-4 text-sm",
      labelClassName: "mb-2 block text-sm font-medium text-text",
      descriptionClassName: "mb-3 text-xs text-text-subtle",
      helpClassName: "text-xs",
      usingClassName: "text-xs",
    };
  }, [variant]);

  function switchMode(mode: LocationMode) {
    setLocationMode(mode);
    setLocationStatus("idle");
    setLocationError("");
    // Tabs are different ways to edit the same location.
    // Switching tabs should not change the selected value by itself.
  }

  function applyCustomLocation(key: "my-location" | "zip", customLocation: CustomLocation) {
    onChange({ locationKey: key, customLocation });
  }

  function handleDetectLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationError("Geolocation not supported by this browser");
      return;
    }

    setLocationStatus("loading");
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        // Label with the nearest known city so it's human-readable and
        // cross-tab matching (GPS → City) works correctly.
        const nearest = findNearestPreset(lat, lng);
        const fallbackLabel = nearest ? nearest.label : "Current Location";
        const label = await lookupPostalAwareLabel(lat, lng, fallbackLabel);
        applyCustomLocation("my-location", { lat, lng, tzid, label });
        setLocationStatus("success");
      },
      (error) => {
        setLocationStatus("error");
        setLocationError(error.code === 1 ? "Location permission denied" : "Could not detect location");
      },
      { timeout: 10_000 },
    );
  }

  async function handleZipLookup() {
    const zip = zipInput.trim();
    if (!/^\d{5}$/.test(zip)) {
      setLocationStatus("error");
      setLocationError("Enter a valid 5-digit ZIP code");
      return;
    }

    setLocationStatus("loading");
    setLocationError("");
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!res.ok) throw new Error("not found");

      const data = await res.json() as {
        places: { latitude: string; longitude: string; "place name": string; "state abbreviation": string }[];
      };
      const place = data.places[0];
      if (!place) throw new Error("not found");

      const tzid = Intl.DateTimeFormat().resolvedOptions().timeZone;
      applyCustomLocation("zip", {
        lat: parseFloat(place.latitude),
        lng: parseFloat(place.longitude),
        tzid,
        label: `${place["place name"]}, ${place["state abbreviation"]} ${zip}`,
      });
      setLocationStatus("success");
    } catch {
      setLocationStatus("error");
      setLocationError("ZIP code not found");
    }
  }

  return (
    <div>
      <label className={sizing.labelClassName}>{label}</label>
      {description ? <p className={sizing.descriptionClassName}>{description}</p> : null}

      {/* Tab bar */}
      <div className="mb-2 flex rounded-lg border border-line/60 bg-canvas p-0.5">
        {(["preset", "my-location", "zip"] as LocationMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => switchMode(mode)}
            className={cn(
              "flex-1 rounded-md font-medium transition-colors",
              sizing.tabClassName,
              locationMode === mode ? "bg-surface text-text shadow-sm" : "text-text-subtle hover:text-text",
            )}
          >
            {mode === "preset" ? "City" : mode === "my-location" ? "GPS" : "ZIP"}
          </button>
        ))}
      </div>

      {/* Currently-active location label — persists across tab switches */}
      {resolvedLabel ? (
        <div className={cn("mb-2 flex items-center gap-1.5 text-text-subtle", sizing.usingClassName)}>
          <span className="text-green-500">✓</span>
          <span>{resolvedLabel}</span>
        </div>
      ) : null}

      {/* Mode-specific input */}
      {locationMode === "preset" && (
        <Select
          className={sizing.selectClassName}
          value={hasCustomSelection ? "__current_custom__" : value.locationKey}
          onChange={(event) => onChange({ locationKey: event.target.value })}
        >
          {hasCustomSelection ? <option value="__current_custom__" disabled>Choose a city</option> : null}
          {allowBlankPreset ? <option value="">No location</option> : null}
          {calendarLocationGroups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      )}

      {locationMode === "my-location" && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={locationStatus === "loading"}
            className={cn(
              "w-full border border-line/60 bg-surface font-medium text-text transition-colors hover:bg-canvas disabled:opacity-50",
              sizing.buttonClassName,
            )}
          >
            {locationStatus === "loading" ? "Detecting…" : locationStatus === "success" ? "Update Location" : "Detect My Location"}
          </button>
          {locationStatus === "error" ? (
            <p className={cn("text-red-500", sizing.helpClassName)}>{locationError}</p>
          ) : null}
        </div>
      )}

      {locationMode === "zip" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="ZIP code"
              value={zipInput}
              onChange={(event) => setZipInput(event.target.value.replace(/\D/g, ""))}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleZipLookup();
              }}
              className={cn(
                "flex-1 border border-line/60 bg-surface text-text placeholder:text-text-subtle focus:outline-none focus:ring-1 focus:ring-brand",
                sizing.inputClassName,
              )}
            />
            <button
              type="button"
              onClick={() => void handleZipLookup()}
              disabled={locationStatus === "loading"}
              className={cn(
                "border border-line/60 bg-surface font-medium text-text transition-colors hover:bg-canvas disabled:opacity-50",
                sizing.buttonClassName,
              )}
            >
              {locationStatus === "loading" ? "…" : "Look up"}
            </button>
          </div>
          {locationStatus === "error" ? (
            <p className={cn("text-red-500", sizing.helpClassName)}>{locationError}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
