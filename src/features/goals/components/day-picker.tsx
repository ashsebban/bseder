import { cn } from "@/lib/cn";
import type { DayKey } from "@/features/goals/lib/goal-progress";

const DAYS: { key: DayKey; label: string }[] = [
  { key: "Sun", label: "S" },
  { key: "Mon", label: "M" },
  { key: "Tue", label: "T" },
  { key: "Wed", label: "W" },
  { key: "Thu", label: "Th" },
  { key: "Fri", label: "F" },
  { key: "Sat", label: "ש" },
];

interface DayPickerProps {
  value: string[];
  onChange: (days: string[]) => void;
}

export function DayPicker({ value, onChange }: DayPickerProps) {
  function toggle(key: string) {
    if (value.includes(key)) {
      onChange(value.filter((d) => d !== key));
    } else {
      onChange([...value, key]);
    }
  }

  return (
    <div className="flex w-full gap-1.5">
      {DAYS.map((day) => {
        const active = value.includes(day.key);
        return (
          <button
            key={day.key}
            type="button"
            onClick={() => toggle(day.key)}
            className={cn(
              "flex flex-1 items-center justify-center rounded-xl py-2 text-sm font-semibold transition duration-150",
              active
                ? "bg-brand text-white shadow-sm"
                : "border border-line bg-surface text-text-muted hover:border-brand/40 hover:text-text",
            )}
          >
            {day.label}
          </button>
        );
      })}
    </div>
  );
}
