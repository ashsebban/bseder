import { DayPicker } from "@/features/goals/components/day-picker";
import { HolidayChipSelect } from "@/features/goals/components/holiday-chip-select";
import { cn } from "@/lib/cn";
import { TIME_WINDOW_PRESETS } from "@/features/goals/hooks/use-goal-form";

export function DailyScheduleFields({
  activeDays,
  setActiveDays,
  lockInDays,
  setLockInDays,
  timeWindowSummary,
  activeTimePreset,
  setStartsAt,
  setExpiresAt,
  setTimeWindowModalOpen,
  holidayExcludes,
  setHolidayExcludes,
  setShowHolidayPicker,
}: any) {
  const labelClass = "text-xs font-semibold uppercase tracking-[0.2em] text-text-muted";

  return (
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
          role="switch"
          aria-checked={lockInDays}
          onClick={() => setLockInDays((v: boolean) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-3 py-2.5 transition hover:border-brand/30"
        >
          <div className="text-left">
            <p className="text-sm font-semibold text-text">Lock in days</p>
            <p className="mt-0.5 text-xs text-text-subtle">
              {lockInDays ? "Set in stone — can't be moved to another day or removed from it" : "Flexible — can be dragged to another day or removed from it"}
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
        <div className="space-y-3 rounded-2xl border border-line bg-white p-3 shadow-soft">
          <button
            type="button"
            onClick={() => setTimeWindowModalOpen(true)}
            className="flex w-full items-start justify-between gap-3 rounded-xl px-1 py-0.5 text-left transition hover:bg-surface-muted/60"
          >
            <div>
              <p className="text-sm font-semibold text-text">{timeWindowSummary.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-text-subtle">{timeWindowSummary.detail}</p>
            </div>
            <span className="shrink-0 rounded-full border border-line/80 px-2.5 py-1 text-[11px] font-semibold text-text-muted">
              Custom
            </span>
          </button>

          <div className="flex flex-wrap gap-2">
            {TIME_WINDOW_PRESETS.map((preset) => {
              const active = activeTimePreset === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => {
                    setStartsAt(preset.startsAt);
                    setExpiresAt(preset.expiresAt);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    active
                      ? "border-brand/50 bg-brand-soft text-brand"
                      : "border-line/80 bg-surface text-text-muted hover:border-brand/30 hover:text-text",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setTimeWindowModalOpen(true)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                activeTimePreset === "custom"
                  ? "border-brand/50 bg-brand-soft text-brand"
                  : "border-line/80 bg-surface text-text-muted hover:border-brand/30 hover:text-text",
              )}
            >
              Custom…
            </button>
          </div>
        </div>
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
  );
}
