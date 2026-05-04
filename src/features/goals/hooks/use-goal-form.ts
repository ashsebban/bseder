import { useState } from "react";
import type { HolidayExcludes } from "@/features/goals/components/holiday-chip-select";
import type { Goal, GoalCadence, GoalDayModel, GoalType, GoalOnMiss, GoalCarryover, IfUnfinished } from "@/features/goals/types/goal";
import { todayIso } from "@/lib/date";

export const DEFAULT_ACTIVE_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
export const DEFAULT_EXCLUDES: HolidayExcludes = { categories: [], individual: [] };

export const TIME_WINDOW_PRESETS = [
  { key: "any", label: "Any time", startsAt: "", expiresAt: "" },
  { key: "daylight", label: "Daylight", startsAt: "Netz HaChama", expiresAt: "Shkiyah" },
  { key: "morning", label: "Morning", startsAt: "Alot HaShachar", expiresAt: "Chatzot" },
  { key: "afternoon", label: "Afternoon", startsAt: "Chatzot", expiresAt: "Shkiyah" },
  { key: "after-sunset", label: "After sunset", startsAt: "Tzais HaKochavim", expiresAt: "Alot HaShachar" },
] as const;

export function getMatchingTimePresetKey(startsAt: string, expiresAt: string) {
  return TIME_WINDOW_PRESETS.find((preset) => preset.startsAt === startsAt && preset.expiresAt === expiresAt)?.key ?? "custom";
}

export function buildSummary(fields: {
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

export function useGoalForm({
  defaultCadence,
  existingGoal,
  onSave,
  onClose,
}: {
  defaultCadence: GoalCadence;
  existingGoal?: Goal;
  onSave: (goal: Goal) => void;
  onClose: () => void;
}) {
  const isEditing = !!existingGoal;
  const [cadence, setCadence] = useState<GoalCadence>(existingGoal?.cadence ?? defaultCadence);

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

  const [onMiss, setOnMiss] = useState<GoalOnMiss>(() => {
    if (existingGoal?.onMiss) return existingGoal.onMiss;
    if (existingGoal?.ifUnfinished === "track-failure" || existingGoal?.ifUnfinished === "backlog" || existingGoal?.ifUnfinished === "kill-streak") return "track";
    return "ignore";
  });
  const [carryover, setCarryover] = useState<GoalCarryover>(() => {
    if (existingGoal?.carryover) return existingGoal.carryover;
    if (existingGoal?.ifUnfinished === "backlog") return "backlog";
    return "drop";
  });
  const [killOnMiss, setKillOnMiss] = useState(() => {
    if (existingGoal?.killOnMiss !== undefined) return existingGoal.killOnMiss;
    return existingGoal?.ifUnfinished === "kill-streak";
  });

  const [dayModel, setDayModel] = useState<GoalDayModel | undefined>(existingGoal?.dayModel);
  const [noGettingAhead, setNoGettingAhead] = useState(existingGoal?.noGettingAhead ?? false);
  const [startsAt, setStartsAt] = useState(existingGoal?.startsAt ?? "");
  const [expiresAt, setExpiresAt] = useState(existingGoal?.expiresAt ?? "");
  const [timeWindowModalOpen, setTimeWindowModalOpen] = useState(false);
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
  const activeTimePreset = getMatchingTimePresetKey(startsAt, expiresAt);
  const showIfUnfinished = cadence !== "one-time" && cadence !== "yearly";


  const summary = buildSummary({
    title, cadence, type: goalType, target, targetUnit, activeDays, holidayExcludes, endType, endDate, endCount, startDate, monthDayType, specificMonthDay
  });

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
      dayModel: dayModel ?? undefined,
      startsAt: isDaily && startsAt ? startsAt : undefined,
      expiresAt: isDaily && expiresAt ? expiresAt : undefined,
      programKey: existingGoal?.programKey,
      lockInDays: (isDaily || (cadence === "weekly" && activeDays.length > 0)) ? lockInDays || undefined : undefined,
      onMiss: !isOneTime ? onMiss : undefined,
      carryover: !isOneTime ? carryover : undefined,
      killOnMiss: !isOneTime && killOnMiss ? true : undefined,
      startDate,
      endDate: endType === "date" ? endDate || undefined : undefined,
      endAfterPeriods: endType === "count" ? Number(endCount) || undefined : undefined,
      dueDate: isOneTime ? dueDate || undefined : undefined,
      ifUnfinished: showIfUnfinished ? ifUnfinished : undefined,
    };
    onSave(goal);
    onClose();
  }

  return {
    state: {
      cadence, title, goalType, target, targetUnit, activeDays, holidayExcludes,
      showHolidayPicker, startDate, endType, endDate, endCount, dueDate, ifUnfinished,
      onMiss, carryover, killOnMiss, dayModel, noGettingAhead, startsAt, expiresAt,
      timeWindowModalOpen, lockInDays, monthDayType, specificMonthDay,
    },
    setters: {
      setCadence, setTitle, setGoalType, setTarget, setTargetUnit, setActiveDays, setHolidayExcludes,
      setShowHolidayPicker, setStartDate, setEndType, setEndDate, setEndCount, setDueDate, setIfUnfinished,
      setOnMiss, setCarryover, setKillOnMiss, setDayModel, setNoGettingAhead, setStartsAt, setExpiresAt,
      setTimeWindowModalOpen, setLockInDays, setMonthDayType, setSpecificMonthDay,
    },
    computed: {
      isEditing, isOneTime, isDaily, isNumeric, activeTimePreset, summary, showIfUnfinished
    },
    handleSave,
  };
}
