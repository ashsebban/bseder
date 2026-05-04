"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { DayPicker } from "@/features/goals/components/day-picker";
import { ZmanimArcPicker } from "@/features/onboarding/components/zmanim-arc-picker";
import { HolidayChipSelect } from "@/features/goals/components/holiday-chip-select";
import { HolidayCustomDrawer } from "@/features/goals/components/holiday-custom-drawer";
import type { HolidayExcludes } from "@/features/goals/components/holiday-chip-select";
import type { Goal, GoalCadence, GoalType, IfUnfinished } from "@/features/goals/types/goal";

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];


const CADENCE_OPTIONS: { value: GoalCadence; label: string; sublabel: string }[] = [
  { value: "daily",    label: "Daily",   sublabel: "Every day"    },
  { value: "weekly",   label: "Weekly",  sublabel: "Once a week"  },
  { value: "monthly",  label: "Monthly", sublabel: "Once a month" },
  { value: "one-time", label: "Project", sublabel: "One-time"     },
];

const IF_UNFINISHED_OPTIONS: {
  value: IfUnfinished; emoji: string; label: string; description: string;
}[] = [
  { value: "forgive",       emoji: "🕊️", label: "Forgive",     description: "Missed periods disappear. No guilt, no debt. Best for sustainable habits." },
  { value: "backlog",       emoji: "📋", label: "Backlog",     description: "Missed work rolls over. Catch up whenever you can. Great for quantified goals." },
  { value: "kill-streak",   emoji: "🔥", label: "Kill Streak", description: "One miss resets your streak to zero. High accountability." },
  { value: "track-failure", emoji: "📊", label: "Mark Failed", description: "Missed periods stay marked red. Full transparency on your record." },
];

const DEFAULT_EXCLUDES: HolidayExcludes = { categories: [], individual: [] };

// ─── Sub-pages ───────────────────────────────────────────────────────────────
// Each sub-page is a named stage rendered inside the step card.
// Navigation is local — parent only sees the final save/skip.

type SubPage =
  | "basics"       // title + cadence
  | "measure"      // binary vs quantified + target
  | "schedule"     // days / preferred day / month day / due date + time window + lock
  | "exceptions"   // holiday exclusions (daily only)
  | "holiday-all"  // full holiday drawer (replaces exceptions)
  | "miss"         // if-unfinished

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface FirstGoalStepProps {
  onSave: (goal: Goal) => void;
  onSkip: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FirstGoalStep({ onSave, onSkip }: FirstGoalStepProps) {
  // Navigation
  const [page, setPage] = useState<SubPage>("basics");

  // Basics
  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState<GoalCadence>("daily");

  // Measure
  const [goalType, setGoalType] = useState<GoalType>("binary");
  const [target, setTarget] = useState("");
  const [targetUnit, setTargetUnit] = useState("");

  // Schedule
  const [activeDays, setActiveDays] = useState<string[]>(ALL_DAYS);
  const [preferredDay, setPreferredDay] = useState<string | null>(null);
  const [monthDayType, setMonthDayType] = useState<"first" | "last" | "specific" | "flexible">("flexible");
  const [specificMonthDay, setSpecificMonthDay] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [lockInDays, setLockInDays] = useState(false);

  // Exceptions
  const [excludes, setExcludes] = useState<HolidayExcludes>(DEFAULT_EXCLUDES);

  // Miss behaviour
  const [ifUnfinished, setIfUnfinished] = useState<IfUnfinished>("forgive");

  const isDaily   = cadence === "daily";
  const isWeekly  = cadence === "weekly";
  const isMonthly = cadence === "monthly";
  const isOneTime = cadence === "one-time";
  const isNumeric = goalType === "quantified";

  // Pages in order (exceptions only for daily)
  function nextPage(cur: SubPage): SubPage {
    if (cur === "basics")     return "measure";
    if (cur === "measure")    return "schedule";
    if (cur === "schedule")   return isDaily ? "exceptions" : (isOneTime ? "save" as SubPage : "miss");
    if (cur === "exceptions") return "miss";
    return "miss";
  }
  function prevPage(cur: SubPage): SubPage {
    if (cur === "miss")       return isDaily ? "exceptions" : "schedule";
    if (cur === "exceptions") return "schedule";
    if (cur === "schedule")   return "measure";
    if (cur === "measure")    return "basics";
    return "basics";
  }

  function handleSave() {
    const goal: Goal = {
      id: crypto.randomUUID(),
      title: title.trim() || "Untitled goal",
      cadence,
      status: "ongoing",
      type: goalType,
      startDate: todayIso(),
      target: isNumeric && target ? Number(target) : undefined,
      targetUnit: isNumeric && targetUnit ? targetUnit.trim() : undefined,
      current: isNumeric ? 0 : undefined,
      completedDates: isDaily && !isNumeric ? [] : undefined,
      activeDays: isDaily
        ? activeDays
        : isWeekly && preferredDay
          ? [preferredDay]
          : undefined,
      preferredMonthDay: isMonthly && monthDayType !== "flexible"
        ? (monthDayType === "specific" ? (Number(specificMonthDay) || undefined) : monthDayType)
        : undefined,
      excludes:
        isDaily && (excludes.categories.length > 0 || excludes.individual.length > 0)
          ? { categories: excludes.categories, individual: excludes.individual }
          : undefined,
      startsAt: isDaily && startsAt ? startsAt : undefined,
      expiresAt: isDaily && expiresAt ? expiresAt : undefined,
      lockInDays: lockInDays || undefined,
      ifUnfinished: !isOneTime ? ifUnfinished : undefined,
      dueDate: isOneTime && dueDate ? dueDate : undefined,
    };
    onSave(goal);
  }

  // ── Full holiday drawer ──────────────────────────────────────────────────
  if (page === "holiday-all") {
    return (
      <HolidayCustomDrawer
        value={excludes}
        onChange={setExcludes}
        onBack={() => setPage("exceptions")}
      />
    );
  }

  // ── Shared layout ────────────────────────────────────────────────────────
  const PAGES_ORDERED: SubPage[] = ["basics", "measure", "schedule", ...(isDaily ? ["exceptions" as SubPage] : []), "miss"];
  const pageIndex = PAGES_ORDERED.indexOf(page);
  const totalPages = PAGES_ORDERED.length;

  return (
    <div>
      {/* Mini progress dots */}
      <div className="mb-5 flex gap-1.5">
        {PAGES_ORDERED.map((p, i) => (
          <div
            key={p}
            className={cn(
              "h-1 rounded-full transition-all duration-200",
              i === pageIndex ? "w-5 bg-brand" : i < pageIndex ? "w-2 bg-brand/30" : "w-2 bg-line/60",
            )}
          />
        ))}
      </div>

      {/* ── Page: Basics ─────────────────────────────────────────────────── */}
      {page === "basics" && (
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-text">Goal name</label>
            <input
              type="text"
              autoFocus
              placeholder="Daf Yomi, exercise, mussar"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) setPage("measure"); }}
              className="h-12 w-full rounded-2xl border border-line/60 bg-surface px-4 text-sm text-text placeholder:text-text-subtle focus:border-brand/50 focus:outline-none focus:ring-1 focus:ring-brand/25"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-text">Repeat</p>
            <div className="grid grid-cols-4 gap-1.5">
              {CADENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCadence(opt.value)}
                  className={cn(
                    "rounded-xl border px-2 py-2.5 text-center transition-colors",
                    cadence === opt.value
                      ? "border-brand bg-brand/5 text-brand"
                      : "border-line/60 bg-surface text-text hover:border-brand/40",
                  )}
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="mt-0.5 text-[10px] text-text-subtle">{opt.sublabel}</p>
                </button>
              ))}
            </div>
          </div>

          <NavRow
            pageIndex={pageIndex}
            totalPages={totalPages}
            canNext={title.trim().length > 0}
            onNext={() => setPage("measure")}
            onSkip={onSkip}
            disabledHint="Add a goal name to continue."
          />
        </div>
      )}

      {/* ── Page: Measure ────────────────────────────────────────────────── */}
      {page === "measure" && (
        <div className="space-y-5">
          <div>
            <p className="mb-1 text-sm font-medium text-text">How do you track progress?</p>
            <p className="mb-3 text-xs text-text-subtle">This affects how the app counts completions and shows your progress bar.</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGoalType("binary")}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition-colors",
                  goalType === "binary"
                    ? "border-brand bg-brand/5 text-brand"
                    : "border-line/60 bg-surface text-text hover:border-brand/40",
                )}
              >
                <p className="text-sm font-semibold">Done / Not done</p>
                <p className="mt-1 text-[11px] leading-snug text-text-subtle">Simple checkbox. Did you do it today?</p>
              </button>
              <button
                type="button"
                onClick={() => setGoalType("quantified")}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition-colors",
                  goalType === "quantified"
                    ? "border-brand bg-brand/5 text-brand"
                    : "border-line/60 bg-surface text-text hover:border-brand/40",
                )}
              >
                <p className="text-sm font-semibold">Count progress</p>
                <p className="mt-1 text-[11px] leading-snug text-text-subtle">Track a number — daf, pages, minutes…</p>
              </button>
            </div>
          </div>

          {isNumeric && (
            <div>
              <p className="mb-2 text-xs font-medium text-text-subtle">
                Target per {isDaily ? "day" : isWeekly ? "week" : isOneTime ? "total" : "month"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={1}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="4"
                  className="h-10 w-full rounded-xl border border-line/60 bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
                <input
                  type="text"
                  value={targetUnit}
                  onChange={(e) => setTargetUnit(e.target.value)}
                  placeholder="daf, pages, km…"
                  className="h-10 w-full rounded-xl border border-line/60 bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
              </div>
            </div>
          )}

          <NavRow
            pageIndex={pageIndex}
            totalPages={totalPages}
            onBack={() => setPage("basics")}
            onNext={() => setPage("schedule")}
          />
        </div>
      )}

      {/* ── Page: Schedule ───────────────────────────────────────────────── */}
      {page === "schedule" && (
        <div className="space-y-5">

          {/* Daily: day picker */}
          {isDaily && (
            <div>
              <p className="mb-1 text-sm font-medium text-text">Which days?</p>
              <p className="mb-2 text-xs text-text-subtle">On these days, the goal will appear in your planner. You can still do it on other days — this just sets the default schedule.</p>
              <DayPicker value={activeDays} onChange={setActiveDays} />
            </div>
          )}

          {/* Weekly: preferred day */}
          {isWeekly && (
            <div>
              <p className="mb-1 text-sm font-medium text-text">Preferred day? <span className="font-normal text-text-subtle">(optional)</span></p>
              <p className="mb-2 text-xs text-text-subtle">When you drag this goal to your calendar, it auto-assigns to this day each week.</p>
              <DayPicker
                value={preferredDay ? [preferredDay] : []}
                onChange={(days) => setPreferredDay(days[days.length - 1] ?? null)}
              />
            </div>
          )}

          {/* Monthly: when */}
          {isMonthly && (
            <div>
              <p className="mb-2 text-sm font-medium text-text">When in the month?</p>
              <div className="flex flex-wrap gap-2">
                {(["first", "last", "specific", "flexible"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setMonthDayType(opt)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm font-medium transition",
                      monthDayType === opt
                        ? "border-brand bg-brand/5 text-brand"
                        : "border-line/60 bg-surface text-text-subtle hover:text-text",
                    )}
                  >
                    {opt === "first" ? "First day" : opt === "last" ? "Last day" : opt === "specific" ? "Specific date" : "Flexible"}
                  </button>
                ))}
              </div>
              {monthDayType === "specific" && (
                <input
                  type="number" min={1} max={31}
                  value={specificMonthDay}
                  onChange={(e) => setSpecificMonthDay(e.target.value)}
                  placeholder="Day of month (1–31)"
                  className="mt-2 h-10 w-full rounded-xl border border-line/60 bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
              )}
            </div>
          )}

          {/* One-time: due date */}
          {isOneTime && (
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Due date <span className="font-normal text-text-subtle">(optional)</span></label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-12 w-full rounded-2xl border border-line/60 bg-surface px-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            </div>
          )}

          {/* Daily: time window (zmanim arc) */}
          {isDaily && (
            <div>
              <p className="mb-1 text-sm font-medium text-text">Time window <span className="font-normal text-text-subtle">(optional)</span></p>
              <p className="mb-3 text-xs text-text-subtle">
                Drag the Start and End handles to set when this goal is active. Hover or tap a dot to preview a zman. Leave the full arc selected for no time limit.
              </p>
              <ZmanimArcPicker
                startKey={startsAt || null}
                endKey={expiresAt || null}
                onChange={(s, e) => { setStartsAt(s ?? ""); setExpiresAt(e ?? ""); }}
              />
            </div>
          )}

          {/* Lock in days — daily or weekly with preferred day */}
          {(isDaily || (isWeekly && preferredDay)) && (
            <button
              type="button"
              onClick={() => setLockInDays((v) => !v)}
              className="flex w-full items-start justify-between gap-3 rounded-xl border border-line/60 bg-surface px-4 py-3 text-left transition-colors hover:border-brand/40"
            >
              <div>
                <p className="text-sm font-semibold text-text">Lock in days</p>
                <p className="mt-0.5 text-xs text-text-subtle">
                  {lockInDays
                    ? "Set in stone — can't be moved to another day or removed from it."
                    : "Off — you can freely drag this goal to different days on the calendar or remove it from a day."}
                </p>
              </div>
              <div className={cn("mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", lockInDays ? "bg-brand" : "bg-line")}>
                <div className={cn("h-5 w-5 rounded-full bg-white shadow transition-transform", lockInDays ? "translate-x-5" : "translate-x-0.5")} />
              </div>
            </button>
          )}

          <NavRow
            pageIndex={pageIndex}
            totalPages={totalPages}
            onBack={() => setPage("measure")}
            onNext={() => setPage(isDaily ? "exceptions" : (isOneTime ? "save" as SubPage : "miss"))}
            nextLabel={isOneTime ? "Save goal →" : undefined}
            onNextDirect={isOneTime ? handleSave : undefined}
          />
        </div>
      )}

      {/* ── Page: Exceptions ─────────────────────────────────────────────── */}
      {page === "exceptions" && (
        <div className="space-y-5">
          <div>
            <p className="mb-1 text-sm font-medium text-text">Skip on <span className="font-normal text-text-subtle">(optional)</span></p>
            <p className="mb-3 text-xs text-text-subtle">
              On these days the goal won&apos;t appear and they won&apos;t count against you. Yom Tov covers all major holidays (Rosh Hashana, Yom Kippur, Pesach, Sukkos, Shavuos). Customize individual days with the link below.
            </p>
            <HolidayChipSelect
              value={excludes}
              onChange={setExcludes}
              onCustomize={() => setPage("holiday-all")}
            />
          </div>

          <NavRow
            pageIndex={pageIndex}
            totalPages={totalPages}
            onBack={() => setPage("schedule")}
            onNext={() => setPage("miss")}
          />
        </div>
      )}

      {/* ── Page: Miss ───────────────────────────────────────────────────── */}
      {page === "miss" && (
        <div className="space-y-5">
          <div>
            <p className="mb-1 text-sm font-medium text-text">
              If you miss a {isDaily ? "day" : isWeekly ? "week" : "month"}…
            </p>
            <p className="mb-3 text-xs text-text-subtle">
              This controls how the app responds when a period passes without being completed. You can change this anytime.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {IF_UNFINISHED_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIfUnfinished(opt.value)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                    ifUnfinished === opt.value
                      ? "border-brand bg-brand/5"
                      : "border-line/60 bg-surface hover:border-brand/40",
                  )}
                >
                  <span className="mt-0.5 text-lg">{opt.emoji}</span>
                  <div>
                    <p className={cn("text-sm font-semibold", ifUnfinished === opt.value ? "text-brand" : "text-text")}>{opt.label}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-text-subtle">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <NavRow
            pageIndex={pageIndex}
            totalPages={totalPages}
            onBack={() => setPage(prevPage("miss"))}
            onNext={handleSave}
            nextLabel="Save goal →"
          />
        </div>
      )}

      {/* Skip link — always visible */}
      <button
        type="button"
        onClick={onSkip}
        className="mt-3 block w-full text-center text-sm font-medium text-text-subtle transition hover:text-text"
      >
        Skip goal setup
      </button>
    </div>
  );
}

// ─── Shared Nav Row ───────────────────────────────────────────────────────────

interface NavRowProps {
  pageIndex: number;
  totalPages: number;
  canNext?: boolean;
  onBack?: () => void;
  onNext?: () => void;
  onNextDirect?: () => void;
  nextLabel?: string;
  onSkip?: () => void;
  disabledHint?: string;
}

function NavRow({ canNext = true, onBack, onNext, onNextDirect, nextLabel = "Next →", disabledHint }: NavRowProps) {
  return (
    <div className="pt-1">
      <div className="flex gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex-1 rounded-2xl border border-line/60 py-3 text-sm font-medium text-text-subtle transition-colors hover:text-text"
          >
            Back
          </button>
        ) : null}
        <button
          type="button"
          onClick={onNextDirect ?? onNext}
          disabled={!canNext}
          className="flex-1 rounded-2xl bg-brand py-3 text-sm font-medium text-white transition-colors disabled:bg-brand-soft disabled:text-brand/50"
        >
          {nextLabel}
        </button>
      </div>
      {!canNext && disabledHint ? (
        <p className="mt-2 text-center text-xs font-medium text-text-subtle">{disabledHint}</p>
      ) : null}
    </div>
  );
}
