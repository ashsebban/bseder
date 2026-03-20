// Canonical implementations live in @/lib/date.
// This file preserves existing import paths for calendar-feature consumers.
export {
  parseIsoDate,
  startOfDay,
  toIsoDate,
  todayIso,
  addDays,
  addMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameDay,
  formatLongDate,
  formatMonthLabel,
  formatWeekRangeLabel,
  getRelativeDayLabel,
} from "@/lib/date";
