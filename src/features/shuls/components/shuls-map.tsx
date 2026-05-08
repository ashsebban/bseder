"use client";

import { useEffect, useRef, useState } from "react";
import type { Prayer } from "@/features/shuls/types/minyan";

const PRAYER_COLORS: Record<Prayer, string> = {
  shacharit: "#d97706",
  mincha: "#ea580c",
  maariv: "#4f46e5",
};

export interface MapShul {
  shulId: string;
  shulName: string;
  address: string;
  lat: number;
  lng: number;
  distanceMiles: number;
  nusach: string;
  phone?: string;
  rabbi?: string;
  position?: number;
  nextTime?: string;
  prayer?: Prayer;
  minutesUntil?: number;
}

interface ShulsMapProps {
  shuls: MapShul[];
  selectedShulId: string | null;
  onSelect: (shulId: string) => void;
  userLat: number;
  userLng: number;
  favoriteIds: Set<string>;
  timeFormat: "12h" | "24h";
}

function makePinHtml(color: string, size: number, label: string, isFav: boolean, isSelected: boolean): string {
  const border = isSelected ? "3px solid #fff" : "2px solid rgba(255,255,255,0.92)";
  const shadow = isSelected
    ? "0 8px 20px rgba(15,23,42,0.28), 0 0 0 4px rgba(255,255,255,0.55)"
    : "0 4px 10px rgba(15,23,42,0.18)";
  const favoriteBadge = isFav
    ? `<span style="
        position:absolute;right:-5px;top:-5px;width:14px;height:14px;border-radius:999px;
        background:#fff;color:#f59e0b;display:flex;align-items:center;justify-content:center;
        font-size:10px;line-height:1;box-shadow:0 2px 5px rgba(15,23,42,0.22);
      ">★</span>`
    : "";
  return `<div style="
    position:relative;
    width:${size}px;height:${size}px;border-radius:50%;
    background:${color};border:${border};box-shadow:${shadow};
    display:flex;align-items:center;justify-content:center;
    font-size:${isSelected ? 12 : 11}px;color:#fff;font-weight:900;
    cursor:pointer;transition:box-shadow 0.15s, transform 0.15s;
  ">${label}${favoriteBadge}</div>`;
}

function fmt24to12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = (h ?? 0) >= 12 ? "PM" : "AM";
  const h12 = (h ?? 0) % 12 || 12;
  return `${h12}:${(m ?? 0).toString().padStart(2, "0")} ${period}`;
}

function formatDistance(distance: number): string {
  return distance < 0.1 ? "< 0.1 mi" : `${distance.toFixed(2)} mi`;
}

function formatUntil(minutes: number | undefined): string {
  if (minutes === undefined) return "";
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `in ${hours}h` : `in ${hours}h ${remainder}m`;
}

function formatPrayer(prayer: Prayer | undefined): string {
  if (prayer === "shacharit") return "Shacharit";
  if (prayer === "mincha") return "Mincha";
  if (prayer === "maariv") return "Maariv";
  return "Tefila";
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

export function ShulsMap({ shuls, selectedShulId, onSelect, userLat, userLng, favoriteIds, timeFormat }: ShulsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // shulId → leaflet marker
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerMapRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef = useRef<any>(null);
  const shulsRef = useRef<MapShul[]>([]);
  const lastFitKeyRef = useRef("");

  // ── Init map once ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      // Leaflet tags initialized DOM nodes. React Strict Mode and HMR can reuse
      // the same node before our ref is populated, so clear any stale instance.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((containerRef.current as any)._leaflet_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (containerRef.current as any)._leaflet_id;
      }

      const map = L.map(containerRef.current, { zoomSnap: 0.5 }).setView([userLat, userLng], 15);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap", maxZoom: 19,
      }).addTo(map);
      userMarkerRef.current = L.circleMarker([userLat, userLng], {
        radius: 8, fillColor: "#3a6fed", color: "#fff", weight: 3, fillOpacity: 1,
      }).addTo(map).bindPopup("You are here");
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      markerMapRef.current.forEach((marker) => marker.remove());
      markerMapRef.current.clear();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
      lastFitKeyRef.current = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Rebuild pins when shul list changes ───────────────────────────────────────
  // Does NOT run when selectedShulId changes — avoids zoom-out on click.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    shulsRef.current = shuls;
    let cancelled = false;

    import("leaflet").then((L) => {
      const map = mapRef.current;
      if (cancelled || !map) return;

      userMarkerRef.current?.setLatLng([userLat, userLng]);

      // Remove old markers
      markerMapRef.current.forEach((m) => m.remove());
      markerMapRef.current.clear();

      shuls.forEach((s) => {
        const isFav = favoriteIds.has(s.shulId);
        const isSelected = s.shulId === selectedShulId;
        const hasTime = s.nextTime !== undefined;
        const color = isFav ? "#f59e0b" : hasTime ? PRAYER_COLORS[s.prayer ?? "maariv"] : "#94a3b8";
        const size = isSelected ? 30 : 22;
        const label = s.position ? String(s.position) : "";

        const icon = L.divIcon({
          className: "",
          html: makePinHtml(color, size, label, isFav, isSelected),
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const displayTime = s.nextTime
          ? (timeFormat === "12h" ? fmt24to12(s.nextTime) : s.nextTime)
          : null;
        const untilLabel = s.minutesUntil !== undefined && s.minutesUntil >= 0
          ? formatUntil(s.minutesUntil)
          : "";
        const prayerLabel = formatPrayer(s.prayer);
        const timeLabel = displayTime
          ? `<div class="shul-popup-timeblock">
              <div class="shul-popup-prayer">${escapeHtml(prayerLabel)}</div>
              <div class="shul-popup-time-row">
                <span class="shul-popup-time" style="color:${color}">${escapeHtml(displayTime)}</span>
                ${untilLabel ? `<span class="shul-popup-until">${escapeHtml(untilLabel)}</span>` : ""}
              </div>
            </div>`
          : `<div class="shul-popup-empty">No upcoming ${escapeHtml(prayerLabel)} shown</div>`;
        const phoneHref = s.phone ? s.phone.replace(/\D/g, "") : "";
        const phoneLink = phoneHref
          ? `<a href="tel:${phoneHref}" class="shul-popup-action shul-popup-action-ghost">Call</a>`
          : "";
        const rabbiLabel = s.rabbi
          ? `<div class="shul-popup-rabbi">Rabbi ${escapeHtml(titleCase(s.rabbi))}</div>`
          : "";
        const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address)}`;

        const marker = L.marker([s.lat, s.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<div class="shul-popup-card">
              <div class="shul-popup-title">${escapeHtml(s.shulName)}</div>
              ${timeLabel}
              <div class="shul-popup-meta">
                <span>${escapeHtml(formatDistance(s.distanceMiles))}</span>
                <span aria-hidden="true">&middot;</span>
                <span>${escapeHtml(s.nusach)}</span>
              </div>
              <div class="shul-popup-address">${escapeHtml(s.address)}</div>
              ${rabbiLabel}
              <div class="shul-popup-actions">
                <button type="button" data-shul-popup-select="${escapeHtml(s.shulId)}" class="shul-popup-action shul-popup-action-primary">Details</button>
                <a href="${directionsHref}" target="_blank" rel="noreferrer" class="shul-popup-action shul-popup-action-secondary">Directions</a>
                ${phoneLink}
              </div>
            </div>`,
            { maxWidth: 320, minWidth: 270, offset: [0, -8], className: "shul-map-popup" },
          );

        marker.on("popupopen", () => {
          const popup = marker.getPopup();
          const root = popup?.getElement();
          const button = root?.querySelector<HTMLButtonElement>("[data-shul-popup-select]");
          button?.addEventListener("click", () => onSelect(s.shulId));
        });

        // Click: notify parent (selection effect handles panning + popup)
        marker.on("click", () => onSelect(s.shulId));
        markerMapRef.current.set(s.shulId, marker);
      });

      const fitKey = `${userLat.toFixed(5)},${userLng.toFixed(5)}:${shuls.map((s) => s.shulId).join(",")}`;
      if (lastFitKeyRef.current !== fitKey && shuls.length > 0) {
        lastFitKeyRef.current = fitKey;
        const pts: [number, number][] = [
          [userLat, userLng],
          ...shuls.map((s): [number, number] => [s.lat, s.lng]),
        ];
        map.fitBounds(pts, { padding: [48, 48], maxZoom: 15 });
      }
    });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuls, favoriteIds, userLat, userLng, timeFormat, mapReady]);

  // ── Handle selection change: restyle pin + pan + open popup ──────────────────
  // Intentionally does NOT include `shuls` or `favoriteIds` in deps to avoid rebuilding.
  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      const map = mapRef.current;
      if (cancelled || !map) return;

      markerMapRef.current.forEach((marker, shulId) => {
        const s = shulsRef.current.find((x) => x.shulId === shulId);
        if (!s) return;
        const isFav = favoriteIds.has(shulId);
        const isSelected = shulId === selectedShulId;
        const hasTime = s.nextTime !== undefined;
        const color = isFav ? "#f59e0b" : hasTime ? PRAYER_COLORS[s.prayer ?? "maariv"] : "#94a3b8";
        const size = isSelected ? 30 : 22;
        const label = s.position ? String(s.position) : "";
        marker.setIcon(L.divIcon({
          className: "",
          html: makePinHtml(color, size, label, isFav, isSelected),
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }));
      });

      if (selectedShulId) {
        const marker = markerMapRef.current.get(selectedShulId);
        if (marker) {
          // Pan to the pin smoothly — no zoom change
          const latlng = marker.getLatLng();
          map.panTo(latlng, { animate: true, duration: 0.35, easeLinearity: 0.5 });
          // Slight delay so pan finishes before popup opens
          setTimeout(() => {
            if (!cancelled && mapRef.current) marker.openPopup();
          }, 200);
        }
      } else {
        // Deselected — close any open popup
        map.closePopup();
      }
    });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShulId]);

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossOrigin="" />
      <style>{`
        .shul-map-popup .leaflet-popup-content-wrapper {
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 8px;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18);
          padding: 0;
        }

        .shul-map-popup .leaflet-popup-content {
          margin: 0;
          width: 270px !important;
        }

        .shul-map-popup .leaflet-popup-tip {
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
        }

        .shul-map-popup .leaflet-popup-close-button {
          color: #94a3b8;
          font: 22px/28px system-ui, sans-serif;
          height: 28px;
          right: 8px;
          top: 8px;
          width: 28px;
        }

        .shul-map-popup .leaflet-popup-close-button:hover {
          color: #475569;
        }

        .shul-popup-card {
          color: #1e293b;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          padding: 16px;
        }

        .shul-popup-title {
          display: -webkit-box;
          font-size: 15px;
          font-weight: 800;
          line-height: 1.2;
          overflow: hidden;
          padding-right: 22px;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .shul-popup-timeblock {
          border-top: 1px solid rgba(226, 232, 240, 0.9);
          margin-top: 11px;
          padding-top: 10px;
        }

        .shul-popup-prayer {
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          line-height: 1;
          text-transform: uppercase;
        }

        .shul-popup-time-row {
          align-items: baseline;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 4px;
        }

        .shul-popup-time {
          font-size: 22px;
          font-weight: 900;
          letter-spacing: 0;
          line-height: 1.05;
        }

        .shul-popup-until {
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
        }

        .shul-popup-empty {
          border-top: 1px solid rgba(226, 232, 240, 0.9);
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.35;
          margin-top: 11px;
          padding-top: 10px;
        }

        .shul-popup-meta {
          align-items: center;
          color: #94a3b8;
          display: flex;
          flex-wrap: wrap;
          font-size: 12px;
          font-weight: 800;
          gap: 6px;
          margin-top: 9px;
        }

        .shul-popup-address {
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.35;
          margin-top: 8px;
        }

        .shul-popup-rabbi {
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.35;
          margin-top: 3px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .shul-popup-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .shul-popup-action {
          align-items: center;
          appearance: none;
          border-radius: 7px;
          cursor: pointer;
          display: inline-flex;
          font-size: 12px;
          font-weight: 800;
          justify-content: center;
          line-height: 1;
          min-height: 32px;
          padding: 0 11px;
          text-decoration: none;
        }

        .shul-popup-action-primary {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #2563eb;
        }

        .shul-popup-action-secondary {
          background: #fff;
          border: 1px solid #e2e8f0;
          color: #475569;
        }

        .shul-popup-action-ghost {
          background: transparent;
          border: 1px solid transparent;
          color: #475569;
          padding-left: 4px;
          padding-right: 4px;
        }
      `}</style>
      <div ref={containerRef} className="h-full w-full bg-slate-100" />
    </>
  );
}
