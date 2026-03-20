import type { CalendarDay, CalendarDayMetadata, CalendarMonth, CalendarView, CalendarWeek } from "@/features/calendar/types/calendar";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  formatMonthLabel,
  formatWeekRangeLabel,
  getRelativeDayLabel,
  isSameDay,
  startOfMonth,
  startOfWeek,
  toIsoDate,
} from "@/features/calendar/lib/date";

function createDay(
  date: Date,
  selectedDate: Date,
  currentMonth: Date,
  today: Date,
  metadata?: CalendarDayMetadata,
): CalendarDay {
  return {
    iso: toIsoDate(date),
    date,
    dayNumber: date.getDate(),
    inCurrentPeriod: date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear(),
    isToday: isSameDay(date, today),
    isSelected: isSameDay(date, selectedDate),
    isWeekend: date.getDay() === 0 || date.getDay() === 6,
    metadata,
  };
}

export function buildMonthView(
  anchorDate: Date,
  selectedDate: Date,
  today: Date,
  metadataByDate?: Map<string, CalendarDayMetadata>,
  weekStartsOn: 0 | 1 = 0,
): CalendarMonth {
  const monthStart = startOfMonth(anchorDate);
  const gridStart = startOfWeek(monthStart, weekStartsOn);
  const monthEnd = endOfMonth(anchorDate);
  const gridEnd = endOfWeek(monthEnd, weekStartsOn);
  const weeks: CalendarWeek[] = [];
  let cursor = gridStart;

  while (cursor <= gridEnd) {
    const weekStart = cursor;
    const days = Array.from({ length: 7 }, (_, offset) => {
      const date = addDays(weekStart, offset);
      return createDay(date, selectedDate, anchorDate, today, metadataByDate?.get(toIsoDate(date)));
    });
    const weekEnd = days[6].date;
    weeks.push({
      key: `${toIsoDate(weekStart)}:${toIsoDate(weekEnd)}`,
      label: formatWeekRangeLabel(weekStart, weekEnd),
      days,
    });
    cursor = addDays(weekStart, 7);
  }

  return {
    monthLabel: formatMonthLabel(anchorDate),
    weeks,
  };
}

export function buildWeekView(
  selectedDate: Date,
  today: Date,
  metadataByDate?: Map<string, CalendarDayMetadata>,
  weekStartsOn: 0 | 1 = 0,
): CalendarWeek {
  const weekStart = startOfWeek(selectedDate, weekStartsOn);
  const weekEnd = endOfWeek(selectedDate, weekStartsOn);
  return {
    key: `${toIsoDate(weekStart)}:${toIsoDate(weekEnd)}`,
    label: formatWeekRangeLabel(weekStart, weekEnd),
    days: Array.from({ length: 7 }, (_, offset) => {
      const date = addDays(weekStart, offset);
      return createDay(date, selectedDate, selectedDate, today, metadataByDate?.get(toIsoDate(date)));
    }),
  };
}

export function getViewTitle(view: CalendarView, selectedDate: Date, anchorDate: Date, today: Date, weekStartsOn: 0 | 1 = 0) {
  switch (view) {
    case "month":
      return {
        eyebrow: "Monthly View",
        title: formatMonthLabel(anchorDate),
        subtitle: "Select a location to add Friday candle-lighting and Saturday Shabbos times to the month.",
      };
    case "week":
      return {
        eyebrow: "Weekly View",
        title: formatWeekRangeLabel(startOfWeek(selectedDate, weekStartsOn), endOfWeek(selectedDate, weekStartsOn)),
        subtitle: `${getRelativeDayLabel(selectedDate, today)} remains the active planning day.`,
      };
    case "day":
      return {
        eyebrow: "Daily View",
        title: selectedDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        subtitle: "This is the smallest planning unit and the natural home for future tasks, goals, reminders, and notes.",
      };
  }
}
