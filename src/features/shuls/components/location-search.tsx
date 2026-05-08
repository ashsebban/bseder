"use client";

import { useEffect, useState } from "react";
import { Clock3, Home, LocateFixed, MapPin, Search, X } from "lucide-react";
import { autocompleteAddress, type GeocodedLocation } from "@/features/shuls/lib/geocode";
import { loadRecentLocations, pushRecentLocation, type RecentLocation } from "@/features/shuls/lib/recent-locations";

interface LocationSearchProps {
  open: boolean;
  onClose: () => void;
  currentLocationLabel: string;
  isUsingGps: boolean;
  onSelectLocation: (location: GeocodedLocation) => void;
  onUseGps: () => void;
  savedLocation?: { lat: number; lng: number; label: string };
}

export function LocationSearch({
  open,
  onClose,
  currentLocationLabel,
  isUsingGps,
  onSelectLocation,
  onUseGps,
  savedLocation,
}: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodedLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [recents, setRecents] = useState<RecentLocation[]>([]);

  useEffect(() => {
    if (open) setRecents(loadRecentLocations());
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const handle = window.setTimeout(async () => {
      const nextResults = await autocompleteAddress(query);
      setResults(nextResults);
      setSearching(false);
    }, 300);

    return () => window.clearTimeout(handle);
  }, [query, open]);

  function pick(location: GeocodedLocation) {
    pushRecentLocation(location);
    setRecents(loadRecentLocations());
    onSelectLocation(location);
    setQuery("");
    setResults([]);
    onClose();
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[1900] bg-black/10" onClick={onClose} />
      <div
        className="fixed left-1/2 top-32 z-[2000] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-4 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Search location"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-bold text-slate-800">Search a different location</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
            aria-label="Close location search"
            title="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Address or city, e.g. Edison, NJ"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-[13px] focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
        </label>

        {searching && <p className="mt-2 text-[11px] text-slate-400">Searching...</p>}

        {results.length > 0 && (
          <div className="mt-3 flex flex-col gap-1">
            {results.map((result) => (
              <button
                key={`${result.lat}-${result.lng}-${result.label}`}
                type="button"
                onClick={() => pick(result)}
                className="flex min-w-0 items-center gap-2 rounded-md px-3 py-2 text-left text-[12.5px] text-slate-700 transition hover:bg-slate-50"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="truncate">{result.label}</span>
              </button>
            ))}
          </div>
        )}

        {recents.length > 0 && query.length === 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Recent</p>
            <div className="flex flex-col gap-1">
              {recents.map((recent) => (
                <button
                  key={`${recent.lat}-${recent.lng}-${recent.label}`}
                  type="button"
                  onClick={() => pick(recent)}
                  className="flex min-w-0 items-center gap-2 rounded-md px-3 py-2 text-left text-[12.5px] text-slate-700 transition hover:bg-slate-50"
                >
                  <Clock3 className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="truncate">{recent.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {savedLocation && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => pick(savedLocation)}
              className="flex w-full min-w-0 items-center gap-2 rounded-md px-3 py-2 text-left text-[12.5px] text-slate-700 transition hover:bg-slate-50"
            >
              <Home className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="truncate">{savedLocation.label}</span>
              <span className="ml-auto text-[10px] text-slate-400">Saved</span>
            </button>
          </div>
        )}

        {!isUsingGps && (
          <button
            type="button"
            onClick={() => {
              onUseGps();
              onClose();
            }}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-brand-strong"
          >
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
            Use my current location
          </button>
        )}

        <p className="mt-3 text-center text-[10.5px] text-slate-400">Currently: {currentLocationLabel}</p>
      </div>
    </>
  );
}
