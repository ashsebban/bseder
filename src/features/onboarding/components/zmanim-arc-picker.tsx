"use client";

import { useRef, useState, useCallback, useEffect } from "react";

// ─── Zmanim data ─────────────────────────────────────────────────────────────

export interface ZmanNotch {
  key: string;
  label: string;
  frac: number;       // 0–1 position along the halachic day
  color: string;      // time-of-day color for dot + active tinting
}

export const ZMANIM_NOTCHES: ZmanNotch[] = [
  { key: "Alot HaShachar",   label: "Alot HaShachar",   frac: 0.00, color: "#4338ca" },
  { key: "Misheyakir",       label: "Misheyakir",       frac: 0.08, color: "#7c3aed" },
  { key: "Netz HaChama",     label: "Netz HaChama",     frac: 0.15, color: "#f97316" },
  { key: "Sof Zman Shema",   label: "Sof Zman Shema",   frac: 0.27, color: "#fbbf24" },
  { key: "Sof Zman Tefilla", label: "Sof Zman Tefilla", frac: 0.33, color: "#fde047" },
  { key: "Chatzot",          label: "Chatzot",          frac: 0.50, color: "#fff7aa" },
  { key: "Mincha Gedola",    label: "Mincha Gedola",    frac: 0.57, color: "#fde047" },
  { key: "Mincha Ketana",    label: "Mincha Ketana",    frac: 0.68, color: "#fb923c" },
  { key: "Plag HaMincha",    label: "Plag HaMincha",    frac: 0.77, color: "#f97316" },
  { key: "Shkiyah",          label: "Shkiyah",          frac: 0.85, color: "#ef4444" },
  { key: "Bein HaShmashot",  label: "Bein HaShmashot",  frac: 0.91, color: "#a855f7" },
  { key: "Tzais HaKochavim", label: "Tzais HaKochavim", frac: 0.96, color: "#6366f1" },
  { key: "Night",            label: "Night",            frac: 1.00, color: "#312e81" },
];

// ─── Arc geometry ─────────────────────────────────────────────────────────────

const SVG_W    = 340;
const SVG_H    = 158;
const MARGIN_X = 26;
const ARC_Y_BASE = 140;   // horizon y
const ARC_Y_PEAK = 14;    // apex y — taller = more dramatic

const P0 = { x: MARGIN_X,          y: ARC_Y_BASE };
const P1 = { x: SVG_W / 2,         y: ARC_Y_PEAK };
const P2 = { x: SVG_W - MARGIN_X,  y: ARC_Y_BASE };

function bezier(t: number) {
  const mt = 1 - t;
  return {
    x: mt * mt * P0.x + 2 * mt * t * P1.x + t * t * P2.x,
    y: mt * mt * P0.y + 2 * mt * t * P1.y + t * t * P2.y,
  };
}

function arcPath() {
  return `M ${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}`;
}

/** Closed path for the "dome" under the full arc — used for sky fill. */
function skyFillPath(steps = 60): string {
  const pts = Array.from({ length: steps + 1 }, (_, i) => bezier(i / steps));
  return (
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
    ` L ${P2.x} ${ARC_Y_BASE} L ${P0.x} ${ARC_Y_BASE} Z`
  );
}

/** Closed path for the active window fill between two fracs. */
function windowFillPath(a: number, b: number, steps = 50): string {
  const pts = Array.from({ length: steps + 1 }, (_, i) => bezier(a + (b - a) * (i / steps)));
  const start = pts[0];
  const end   = pts[pts.length - 1];
  return (
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
    ` L ${end.x.toFixed(1)} ${ARC_Y_BASE} L ${start.x.toFixed(1)} ${ARC_Y_BASE} Z`
  );
}

/** Partial arc stroke only. */
function partialArcPath(a: number, b: number, steps = 50): string {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const p = bezier(a + (b - a) * (i / steps));
    return `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(" ");
}

function xToFrac(svgX: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (bezier(mid).x < svgX) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function snapToNotch(frac: number): number {
  return ZMANIM_NOTCHES.reduce((best, n) =>
    Math.abs(n.frac - frac) < Math.abs(best.frac - frac) ? n : best
  ).frac;
}

function notchByFrac(frac: number): ZmanNotch {
  return ZMANIM_NOTCHES.find((n) => n.frac === frac) ?? ZMANIM_NOTCHES[0];
}

function withAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const FIRST_FRAC = ZMANIM_NOTCHES[0].frac;
const LAST_FRAC  = ZMANIM_NOTCHES[ZMANIM_NOTCHES.length - 1].frac;

interface ZmanimArcPickerProps {
  startKey: string | null;
  endKey:   string | null;
  onChange: (startKey: string | null, endKey: string | null) => void;
}

export function ZmanimArcPicker({ startKey, endKey, onChange }: ZmanimArcPickerProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const [startFrac, setStartFrac] = useState(
    () => ZMANIM_NOTCHES.find((n) => n.key === startKey)?.frac ?? FIRST_FRAC,
  );
  const [endFrac, setEndFrac] = useState(
    () => ZMANIM_NOTCHES.find((n) => n.key === endKey)?.frac ?? LAST_FRAC,
  );
  const [dragging, setDragging]   = useState<"start" | "end" | null>(null);
  const [hovered,  setHovered]    = useState<ZmanNotch | null>(null);

  // Notify parent
  useEffect(() => {
    onChange(
      startFrac === FIRST_FRAC ? null : notchByFrac(startFrac).key,
      endFrac   === LAST_FRAC  ? null : notchByFrac(endFrac).key,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startFrac, endFrac]);

  function svgXFromEvent(e: MouseEvent | TouchEvent): number {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    return (clientX - rect.left) * (SVG_W / rect.width);
  }

  function svgPointFromClient(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (SVG_W / rect.width),
      y: (clientY - rect.top) * (SVG_H / rect.height),
    };
  }

  function updateHoveredFromPoint(svgX: number, svgY: number) {
    const nearest = ZMANIM_NOTCHES.reduce<{ notch: ZmanNotch | null; distance: number }>((best, notch) => {
      const pt = bezier(notch.frac);
      const distance = Math.hypot(pt.x - svgX, pt.y - svgY);
      return distance < best.distance ? { notch, distance } : best;
    }, { notch: null, distance: Infinity });

    setHovered(nearest.distance <= 28 ? nearest.notch : null);
  }

  const onMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragging) return;
    const snapped = snapToNotch(xToFrac(svgXFromEvent(e)));
    if (dragging === "start") setStartFrac(Math.min(snapped, endFrac));
    else                      setEndFrac(Math.max(snapped, startFrac));
  }, [dragging, startFrac, endFrac]);

  const onUp = useCallback(() => setDragging(null), []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener("mousemove",  onMove);
    window.addEventListener("mouseup",    onUp);
    window.addEventListener("touchmove",  onMove,  { passive: false });
    window.addEventListener("touchend",   onUp);
    return () => {
      window.removeEventListener("mousemove",  onMove);
      window.removeEventListener("mouseup",    onUp);
      window.removeEventListener("touchmove",  onMove);
      window.removeEventListener("touchend",   onUp);
    };
  }, [dragging, onMove, onUp]);

  const startPt      = bezier(startFrac);
  const endPt        = bezier(endFrac);
  const isFullRange  = startFrac === FIRST_FRAC && endFrac === LAST_FRAC;
  const startNotch   = notchByFrac(startFrac);
  const endNotch     = notchByFrac(endFrac);

  return (
    <div className="select-none overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_52%,#fff9f1_100%)] px-3 pb-4 pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_24px_rgba(148,163,184,0.12)]">
      {/* SVG */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full touch-none"
        style={{ overflow: "visible" }}
        onMouseMove={(event) => {
          if (dragging) return;
          const point = svgPointFromClient(event.clientX, event.clientY);
          if (point) updateHoveredFromPoint(point.x, point.y);
        }}
        onMouseLeave={() => {
          if (!dragging) setHovered(null);
        }}
        onTouchMove={(event) => {
          if (dragging) return;
          const touch = event.touches[0];
          if (!touch) return;
          const point = svgPointFromClient(touch.clientX, touch.clientY);
          if (point) updateHoveredFromPoint(point.x, point.y);
        }}
      >
        <defs>
          {/* Sky dome fill — radial from peak */}
          <radialGradient id="skyDome" cx="50%" cy="0%" r="80%" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#fde68a" stopOpacity="0.38" />
            <stop offset="55%"  stopColor="#c7d2fe" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          {/* Active window fill */}
          <linearGradient id="windowFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#fbbf24" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.07" />
          </linearGradient>

          {/* Arc active stroke */}
          <linearGradient id="arcStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#6366f1" />
            <stop offset="30%"  stopColor="#f97316" />
            <stop offset="50%"  stopColor="#fde047" />
            <stop offset="70%"  stopColor="#f97316" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>

          {/* Horizon gradient */}
          <linearGradient id="horizGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.34" />
            <stop offset="20%"  stopColor="#f97316" stopOpacity="0.4" />
            <stop offset="50%"  stopColor="#fde047" stopOpacity="0.28" />
            <stop offset="80%"  stopColor="#f97316" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.34" />
          </linearGradient>

          {/* Handle glow filter */}
          <filter id="handleGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          {/* Active arc glow */}
          <filter id="arcGlow" x="-5%" y="-30%" width="110%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ── Sky dome background ── */}
        <path d={skyFillPath()} fill="url(#skyDome)" />

        {/* ── Active window fill ── */}
        {!isFullRange && (
          <path d={windowFillPath(startFrac, endFrac)} fill="url(#windowFill)" />
        )}

        {/* ── Horizon line ── */}
        <line
          x1={P0.x - 4} y1={ARC_Y_BASE}
          x2={P2.x + 4} y2={ARC_Y_BASE}
          stroke="url(#horizGrad)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* ── Tick marks from notch down to horizon ── */}
        {ZMANIM_NOTCHES.map((n) => {
          const pt = bezier(n.frac);
          const isActive = n.frac >= startFrac && n.frac <= endFrac;
          return (
            <line
              key={`tick-${n.key}`}
              x1={pt.x} y1={pt.y + 3}
              x2={pt.x} y2={ARC_Y_BASE - 1}
              stroke={isActive ? n.color : "#94a3b8"}
              strokeWidth={hovered?.frac === n.frac ? 1.25 : 1}
              strokeOpacity={hovered?.frac === n.frac ? 0.65 : isActive ? 0.45 : 0.38}
              strokeDasharray="2 2"
            />
          );
        })}

        {/* ── Full arc (dim track) ── */}
        <path
          d={arcPath()}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* ── Full day arc — color stays fixed regardless of selection ── */}
        <path
          d={arcPath()}
          fill="none"
          stroke="url(#arcStroke)"
          strokeWidth="4.5"
          strokeLinecap="round"
          filter="url(#arcGlow)"
        />

        {/* ── Dim the inactive left/right segments instead of recoloring the sky ── */}
        {!isFullRange && startFrac > FIRST_FRAC && (
          <path
            d={partialArcPath(FIRST_FRAC, startFrac)}
            fill="none"
            stroke="#f8fafc"
            strokeOpacity="0.8"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
        )}
        {!isFullRange && endFrac < LAST_FRAC && (
          <path
            d={partialArcPath(endFrac, LAST_FRAC)}
            fill="none"
            stroke="#f8fafc"
            strokeOpacity="0.8"
            strokeWidth="6.5"
            strokeLinecap="round"
          />
        )}

        {/* ── Notch dots ── */}
        {ZMANIM_NOTCHES.map((n) => {
          const pt       = bezier(n.frac);
          const isActive = n.frac >= startFrac && n.frac <= endFrac;
          const isHov    = hovered?.frac === n.frac;
          const r        = isHov ? 8 : isActive ? 6.5 : 5;

          return (
            <g key={n.key}>
              {/* Expanded hit area */}
              <circle
                cx={pt.x} cy={pt.y} r={16}
                fill="#ffffff"
                fillOpacity="0.001"
                pointerEvents="all"
                className="cursor-pointer"
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(null)}
                onTouchStart={() => setHovered(n)}
              />
              {/* Glow halo for active / hovered dots */}
              {(isActive || isHov) && (
                <circle
                  cx={pt.x} cy={pt.y} r={r + (isHov ? 5 : 4)}
                  fill={n.color}
                  fillOpacity={isHov ? 0.24 : 0.16}
                />
              )}
              {isHov && (
                <circle
                  cx={pt.x} cy={pt.y} r={r + 1.5}
                  fill="#ffffff"
                  stroke={n.color}
                  strokeWidth="2"
                />
              )}
              {/* Dot */}
              <circle
                cx={pt.x} cy={pt.y} r={r}
                fill={isActive || isHov ? n.color : "#ffffff"}
                stroke={isActive || isHov ? "#cbd5e1" : "#94a3b8"}
                strokeWidth={isActive || isHov ? 1.75 : 1.75}
                style={{ transition: "r 120ms ease, fill 150ms ease" }}
              />
            </g>
          );
        })}

        {/* ── Start handle ── */}
        <g
          style={{ cursor: dragging === "start" ? "grabbing" : "grab" }}
          onMouseDown={(e) => { e.preventDefault(); setDragging("start"); }}
          onTouchStart={(e) => { e.preventDefault(); setDragging("start"); }}
        >
          <circle cx={startPt.x} cy={startPt.y} r={18} fill="#ffffff" fillOpacity="0.001" pointerEvents="all" />
          <circle
            cx={startPt.x}
            cy={startPt.y}
            r={13}
            fill={withAlpha(startNotch.color, dragging === "start" ? "32" : "18")}
            filter="url(#handleGlow)"
          />
          <circle
            cx={startPt.x}
            cy={startPt.y}
            r={10.5}
            fill="#ffffff"
            stroke={startNotch.color}
            strokeWidth="2.25"
          />
        </g>

        {/* ── End handle ── */}
        <g
          style={{ cursor: dragging === "end" ? "grabbing" : "grab" }}
          onMouseDown={(e) => { e.preventDefault(); setDragging("end"); }}
          onTouchStart={(e) => { e.preventDefault(); setDragging("end"); }}
        >
          <circle cx={endPt.x} cy={endPt.y} r={18} fill="#ffffff" fillOpacity="0.001" pointerEvents="all" />
          <circle
            cx={endPt.x}
            cy={endPt.y}
            r={13}
            fill={withAlpha(endNotch.color, dragging === "end" ? "32" : "18")}
            filter="url(#handleGlow)"
          />
          <circle
            cx={endPt.x}
            cy={endPt.y}
            r={10.5}
            fill="#ffffff"
            stroke={endNotch.color}
            strokeWidth="2.25"
          />
        </g>
      </svg>

      {/* ── Name plate — shows hovered or selected zman names ── */}
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-end gap-3 px-1">
        {/* Start label */}
        <div className="min-w-0 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Starts</p>
          <span className="mt-1 inline-flex max-w-full truncate rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[12px] font-semibold leading-tight text-slate-900 shadow-sm">
            {startFrac === FIRST_FRAC ? "Any time" : startNotch.label}
          </span>
        </div>

        {/* Center — hover label or status */}
        <div className="min-w-[112px] text-center">
          {hovered ? (
            <span className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-900 shadow-sm">
              {hovered.label}
            </span>
          ) : isFullRange ? (
            <p className="text-[11px] font-medium text-slate-500">No time limit</p>
          ) : (
            <button
              type="button"
              onClick={() => { setStartFrac(FIRST_FRAC); setEndFrac(LAST_FRAC); }}
              className="text-[11px] font-medium text-slate-500 underline underline-offset-2 transition-colors hover:text-slate-700"
            >
              Reset
            </button>
          )}
        </div>

        {/* End label */}
        <div className="min-w-0 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ends</p>
          <span className="mt-1 inline-flex max-w-full truncate rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[12px] font-semibold leading-tight text-slate-900 shadow-sm">
            {endFrac === LAST_FRAC ? "No end" : endNotch.label}
          </span>
        </div>
      </div>
    </div>
  );
}
