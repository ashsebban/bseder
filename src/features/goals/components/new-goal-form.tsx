"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DayPicker } from "@/features/goals/components/day-picker";
import { HolidayChipSelect } from "@/features/goals/components/holiday-chip-select";
import { HolidayCustomDrawer } from "@/features/goals/components/holiday-custom-drawer";
import type { HolidayExcludes } from "@/features/goals/components/holiday-chip-select";
import type { Goal, GoalCadence, GoalType, IfUnfinished } from "@/features/goals/types/goal";
import { todayIso } from "@/lib/date";

const DEFAULT_ACTIVE_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

const ZMANIM_PERIODS = [
  "Alot HaShachar",
  "Misheyakir",
  "Netz HaChama",
  "Sof Zman Shema",
  "Sof Zman Tefilla",
  "Chatzot",
  "Mincha Gedola",
  "Mincha Ketana",
  "Plag HaMincha",
  "Shkiyah",
  "Bein HaShmashot",
  "Tzais HaKochavim",
  "Night",
] as const;
const DEFAULT_EXCLUDES: HolidayExcludes = { categories: [], individual: [] };

function buildSummary(fields: {
  title: string;
  cadence: GoalCadence;
  type: GoalType;
  target: string;
  targetUnit: string;
  activeDays: string[];
  holidayExcludes: HolidayExcludes;
  endType: string;
  endDate: string;
  endCount: string;
  startDate: string;
  monthDayType: string;
  specificMonthDay: string;
}): string {
  const name = fields.title.trim() || "Untitled goal";

  let measurement = "";
  if (fields.type === "binary") {
    measurement = "binary";
  } else {
    const amt = fields.target || "?";
    const unit = fields.targetUnit.trim() || "units";
    const per = fields.cadence === "daily" ? "day" : fields.cadence === "weekly" ? "week" : fields.cadence === "monthly" ? "month" : "year";
    measurement = `${amt} ${unit}/${per}`;
  }

  let schedule = "";
  if (fields.cadence === "daily") {
    const dayAbbrevs: Record<string, string> = { Sun: "Sun", Mon: "Mon", Tue: "Tue", Wed: "Wed", Thu: "Thu", Fri: "Fri", Sat: "Shabbos" };
    schedule = fields.activeDays.map((d) => dayAbbrevs[d] ?? d).join(", ");
    const allExcludes = [...(fields.holidayExcludes.categories ?? []), ...(fields.holidayExcludes.individual ?? [])];
    if (allExcludes.length > 0) {
      schedule += ` (excl. ${allExcludes[0]}${allExcludes.length > 1 ? "…" : ""})`;
    }
  } else if (fields.cadence === "weekly" && fields.activeDays.length > 0) {
    schedule = "on " + fields.activeDays.join(", ");
  } else if (fields.cadence === "monthly" && fields.monthDayType !== "flexible") {
    schedule = fields.monthDayType === "first" ? "1st of month"
      : fields.monthDayType === "last" ? "last of month"
      : fields.specificMonthDay ? `day ${fields.specificMonthDay}` : "";
  }

  let end = "ongoing";
  if (fields.endType === "date" && fields.endDate) {
    end = `until ${fields.endDate}`;
  } else if (fields.endType === "count" && fields.endCount) {
    end = `after ${fields.endCount} times`;
  }

  return [name, measurement, schedule, end].filter(Boolean).join(" – ") + ".";
}

// Shared input class
const inputClass =
  "h-12 w-full rounded-2xl border border-line bg-white px-4 text-base font-medium text-text shadow-soft transition placeholder:text-text-subtle focus:border-brand/40 focus:outline-none focus:ring-4 focus:ring-brand/15";

const labelClass = "text-xs font-semibold uppercase tracking-[0.2em] text-text-muted";

interface NewGoalFormProps {
  defaultCadence: GoalCadence;
  existingGoal?: Goal;
  onSave: (goal: Goal) => void;
  onClose: () => void;
}

export function NewGoalForm({ defaultCadence, existingGoal, onSave, onClose }: NewGoalFormProps) {
  const cadence = defaultCadence; // locked — not editable
  const isEditing = !!existingGoal;

  const [title, setTitle] = useState(existingGoal?.title ?? "");
  const [goalType, setGoalType] = useState<GoalType>(existingGoal?.type ?? "binary");
  const [target, setTarget] = useState(existingGoal?.target ? String(existingGoal.target) : "");
  const [targetUnit, setTargetUnit] = useState(existingGoal?.targetUnit ?? "");
  const [activeDays, setActiveDays] = useState<string[]>(
    existingGoal?.activeDays ?? (defaultCadence === "daily" ? DEFAULT_ACTIVE_DAYS : [])
  );
  const [holidayExcludes, setHolidayExcludes] = useState<HolidayExcludes>(
    existingGoal?.excludes
      ? { categories: existingGoal.excludes.categories ?? [], individual: existingGoal.excludes.individual ?? [] }
      : DEFAULT_EXCLUDES,
  );
  const [showHolidayPicker, setShowHolidayPicker] = useState(false);
  const [startDate, setStartDate] = useState(existingGoal?.startDate ?? todayIso());
  const [endType, setEndType] = useState(
    existingGoal?.endDate ? "date" : existingGoal?.endAfterPeriods ? "count" : "none",
  );
  const [endDate, setEndDate] = useState(existingGoal?.endDate ?? "");
  const [endCount, setEndCount] = useState(existingGoal?.endAfterPeriods ? String(existingGoal.endAfterPeriods) : "90");
  const [dueDate, setDueDate] = useState(existingGoal?.dueDate ?? "");
  const [ifUnfinished, setIfUnfinished] = useState<IfUnfinished>(existingGoal?.ifUnfinished ?? "forgive");

  const [noGettingAhead, setNoGettingAhead] = useState(existingGoal?.noGettingAhead ?? false);
  const [startsAt, setStartsAt] = useState(existingGoal?.startsAt ?? "");
  const [expiresAt, setExpiresAt] = useState(existingGoal?.expiresAt ?? "");
  const [lockInDays, setLockInDays] = useState(existingGoal?.lockInDays ?? false);

  // Monthly scheduling state
  const defaultMonthDayType = (): "first" | "last" | "specific" | "flexible" => {
    const p = existingGoal?.preferredMonthDay;
    if (p === "first") return "first";
    if (p === "last") return "last";
    if (typeof p === "number") return "specific";
    return "flexible";
  };
  const [monthDayType, setMonthDayType] = useState<"first" | "last" | "specific" | "flexible">(defaultMonthDayType);
  const [specificMonthDay, setSpecificMonthDay] = useState(
    typeof existingGoal?.preferredMonthDay === "number" ? String(existingGoal.preferredMonthDay) : ""
  );

  const isOneTime = cadence === "one-time";
  const isDaily = cadence === "daily";
  const isNumeric = goalType === "quantified";
  const showIfUnfinished = cadence !== "one-time" && cadence !== "yearly";

  const summary = buildSummary({ title, cadence, type: goalType, target, targetUnit, activeDays, holidayExcludes, endType, endDate, endCount, startDate, monthDayType, specificMonthDay });

  // Sub-page: show holiday picker inline instead of the form
  if (showHolidayPicker) {
    return (
      <HolidayCustomDrawer
        value={holidayExcludes}
        onChange={setHolidayExcludes}
        onBack={() => setShowHolidayPicker(false)}
      />
    );
  }

  function handleSave() {
    const goal: Goal = {
      id: existingGoal?.id ?? crypto.randomUUID(),
      title: title.trim() || "Untitled goal",
      cadence,
      status: existingGoal?.status ?? "ongoing",
      type: goalType,
      target: isNumeric && target ? Number(target) : undefined,
      targetUnit: isNumeric && targetUnit ? targetUnit.trim() : undefined,
      current: existingGoal?.current ?? 0,
      completedDates: existingGoal?.completedDates ?? (isDaily && !isNumeric ? [] : undefined),

      noGettingAhead: isNumeric && !isDaily && !isOneTime ? noGettingAhead : undefined,
      backlog: existingGoal?.backlog,
      activeDays: cadence === "daily" ? activeDays
        : cadence === "weekly" && activeDays.length > 0 ? activeDays
        : undefined,
      preferredMonthDay: cadence === "monthly" && monthDayType !== "flexible"
        ? (monthDayType === "specific" ? (Number(specificMonthDay) || undefined) : monthDayType)
        : undefined,
      excludes: isDaily && (holidayExcludes.categories.length > 0 || holidayExcludes.individual.length > 0)
        ? { categories: holidayExcludes.categories, individual: holidayExcludes.individual }
        : undefined,
      startsAt: isDaily && startsAt ? startsAt : undefined,
      expiresAt: isDaily && expiresAt ? expiresAt : undefined,
      lockInDays: (isDaily || (cadence === "weekly" && activeDays.length > 0)) ? lockInDays || undefined : undefined,
      ifUnfinished: showIfUnfinished ? ifUnfinished : undefined,
      startDate,
      endDate: endType === "date" ? endDate || undefined : undefined,
      endAfterPeriods: endType === "count" ? Number(endCount) || undefined : undefined,
      dueDate: isOneTime ? dueDate || undefined : undefined,
    };
    onSave(goal);
    onClose();
  }

  return (
    <div className="space-y-5">
      {/* Goal title */}
      <div className="space-y-1.5">
        <label className={labelClass}>Goal title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Wrap Tefillin"
          className={inputClass}
        />
      </div>

      {/* Track as */}
      <div className="space-y-1.5">
        <label className={labelClass}>Track as</label>
        <Select value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)}>
          <option value="binary">Done / not done</option>
          <option value="quantified">Numeric target</option>
        </Select>
      </div>


      {/* Numeric target fields */}
      {isNumeric ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelClass}>Target amount</label>
            <input
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="10"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Unit</label>
            <input
              type="text"
              value={targetUnit}
              onChange={(e) => setTargetUnit(e.target.value)}
              placeholder="pages, daf, km…"
              className={inputClass}
            />
          </div>
        </div>
      ) : null}

      {/* Daily: days picker + toggles + time window + exceptions */}
      {isDaily ? (
        <div className="space-y-4 rounded-2xl border border-line/60 bg-surface-muted/40 p-4">
          {/* 1. Days */}
          <div className="space-y-2">
            <label className={labelClass}>Days</label>
            <DayPicker value={activeDays} onChange={setActiveDays} />
          </div>

          {/* 2. Lock In + Done Ahead */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setLockInDays((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-3 py-2.5 transition hover:border-brand/30"
            >
              <div className="text-left">
                <p className="text-sm font-semibold text-text">Lock in days</p>
                <p className="mt-0.5 text-xs text-text-subtle">
                  {lockInDays ? "Fixed — can't be moved to another day" : "Flexible — can be dragged to another day"}
                </p>
              </div>
              <div className={`ml-3 flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${lockInDays ? "bg-brand" : "bg-line"}`}>
                <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${lockInDays ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
            </button>
          </div>

          {/* 3. Time Window */}
          <div className="space-y-1.5">
            <label className={labelClass}>
              Time window{" "}
              <span className="font-normal normal-case tracking-normal text-text-subtle">(optional)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={startsAt} onChange={(e) => setStartsAt(e.target.value)}>
                <option value="">Starts: any time</option>
                {ZMANIM_PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
              <Select value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}>
                <option value="">Expires: never</option>
                {ZMANIM_PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </div>
            {(startsAt || expiresAt) && (
              <p className="text-[11px] text-text-subtle">Goal dims outside this window — tap still works.</p>
            )}
          </div>

          {/* 4. Exceptions */}
          <div className="space-y-1.5">
            <label className={labelClass}>Except</label>
            <HolidayChipSelect
              value={holidayExcludes}
              onChange={setHolidayExcludes}
              onCustomize={() => setShowHolidayPicker(true)}
            />
          </div>
        </div>
      ) : null}

      {/* Weekly: day-of-week picker */}
      {cadence === "weekly" ? (
        <div className="space-y-3 rounded-2xl border border-line/60 bg-surface-muted/40 p-4">
          <label className={labelClass}>Preferred days (optional)</label>
          <DayPicker value={activeDays} onChange={setActiveDays} />
          <p className="mt-1 text-xs text-text-subtle">
            Drag to the week → auto-assigns to these days.
          </p>
          {activeDays.length > 0 && (
            <button
              type="button"
              onClick={() => setLockInDays((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-3 py-2.5 transition hover:border-brand/30"
            >
              <div className="text-left">
                <p className="text-sm font-semibold text-text">Lock in days</p>
                <p className="mt-0.5 text-xs text-text-subtle">
                  {lockInDays ? "Fixed — can't be moved to another day" : "Flexible — can be dragged to another day"}
                </p>
              </div>
              <div className={`ml-3 flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${lockInDays ? "bg-brand" : "bg-line"}`}>
                <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${lockInDays ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
            </button>
          )}
        </div>
      ) : null}

      {/* Monthly: when in the month? */}
      {cadence === "monthly" ? (
        <div className="space-y-3 rounded-2xl border border-line/60 bg-surface-muted/40 p-4">
          <label className={labelClass}>When in the month?</label>
          <div className="flex flex-wrap gap-2">
            {(["first", "last", "specific", "flexible"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setMonthDayType(opt)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-sm font-medium transition",
                  monthDayType === opt
                    ? "bg-brand text-white"
                    : "border border-line bg-white text-text-muted hover:border-brand/30",
                )}
              >
                {opt === "first" ? "First day" : opt === "last" ? "Last day" : opt === "specific" ? "Specific date" : "Flexible"}
              </button>
            ))}
          </div>
          {monthDayType === "specific" && (
            <input
              type="number"
              min={1}
              max={31}
              value={specificMonthDay}
              onChange={(e) => setSpecificMonthDay(e.target.value)}
              placeholder="Day of month (1–31)"
              className={inputClass}
            />
          )}
          {monthDayType !== "flexible" && (
            <p className="text-xs text-text-subtle">
              Drag to any week → auto-assigns to this day of the month.
            </p>
          )}
        </div>
      ) : null}

      {/* One-time: due date */}
      {isOneTime ? (
        <div className="space-y-1.5">
          <label className={labelClass}>Due date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputClass}
          />
        </div>
      ) : null}

      {/* Change 3: Unified Duration row — no new rows on end condition change */}
      {!isOneTime ? (
        <div className="space-y-1.5">
          <label className={labelClass}>Duration</label>
          <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-line bg-white px-4 shadow-soft">
            {/* Start date */}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-base font-medium text-text focus:outline-none"
            />
            {/* Arrow separator */}
            <span className="shrink-0 text-text-subtle">→</span>
            {/* End condition — transforms in place */}
            {endType === "none" ? (
              <select
                value={endType}
                onChange={(e) => setEndType(e.target.value)}
                className="flex-1 appearance-none bg-transparent text-base font-medium text-text-muted focus:outline-none"
              >
                <option value="none">No end</option>
                <option value="date">On a date…</option>
                <option value="count">After N times…</option>
              </select>
            ) : endType === "date" ? (
              <>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 bg-transparent text-base font-medium text-text focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setEndType("none")}
                  className="shrink-0 rounded-lg p-1 text-text-subtle transition hover:bg-surface-muted hover:text-text"
                  aria-label="Clear end date"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <span className="shrink-0 text-sm text-text-muted">After</span>
                <input
                  type="number"
                  min={1}
                  value={endCount}
                  onChange={(e) => setEndCount(e.target.value)}
                  className="w-16 bg-transparent text-base font-medium text-text focus:outline-none"
                />
                <span className="shrink-0 text-sm text-text-muted">times</span>
                <button
                  type="button"
                  onClick={() => setEndType("none")}
                  className="ml-auto shrink-0 rounded-lg p-1 text-text-subtle transition hover:bg-surface-muted hover:text-text"
                  aria-label="Clear end condition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* No getting ahead toggle — quantified non-daily goals only */}
      {isNumeric && !isDaily && !isOneTime ? (
        <button
          type="button"
          onClick={() => setNoGettingAhead((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 shadow-soft transition hover:border-brand/30"
        >
          <div className="text-left">
            <p className="text-sm font-semibold text-text">Cap at target (no getting ahead)</p>
            <p className="mt-0.5 text-xs text-text-subtle">
              {noGettingAhead
                ? `Can't plan more than ${target || "?"} ${targetUnit || "units"} per ${cadence}`
                : "You can plan beyond the target to get ahead"}
            </p>
          </div>
          <div className={`ml-3 flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${noGettingAhead ? "bg-brand" : "bg-line"}`}>
            <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${noGettingAhead ? "translate-x-5" : "translate-x-0.5"}`} />
          </div>
        </button>
      ) : null}

      {/* If unfinished */}
      {showIfUnfinished ? (
        <div className="space-y-1.5">
          <label className={labelClass}>If unfinished</label>
          <Select value={ifUnfinished} onChange={(e) => setIfUnfinished(e.target.value as IfUnfinished)}>
            <option value="forgive">Forgive — no penalty</option>
            <option value="backlog">Backlog — track debt</option>
            <option value="track-failure">Track Failure — show red</option>
            <option value="kill-streak">Kill Streak — streak ends on miss</option>
          </Select>
        </div>
      ) : null}

      {/* Live summary */}
      <div className="rounded-2xl border border-brand/20 bg-brand-soft/40 px-4 py-3">
        <p className="text-sm font-medium leading-relaxed text-text">{summary}</p>
      </div>

      <Button variant="primary" className="w-full" onClick={handleSave}>
        {isEditing ? "Update Goal" : "Save Goal"}
      </Button>
    </div>
  );
}
