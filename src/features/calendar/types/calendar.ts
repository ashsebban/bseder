export type CalendarView = "month" | "week" | "day";

export interface CalendarDayProgress {
  completed: number;
  total: number;
  missed?: number;
}

export interface CalendarDayMetadata {
  candleLighting?: string;
  shabbosEnds?: string;
  fastBegins?: string;
  fastEnds?: string;
  parsha?: string;
  hebrewDateLabel?: string;
  holidays?: string[];
  progress?: CalendarDayProgress;
  omerDay?: number;
}

export interface CalendarDay {
  iso: string;
  date: Date;
  dayNumber: number;
  inCurrentPeriod: boolean;
  isToday: boolean;
  isSelected: boolean;
  isWeekend: boolean;
  metadata?: CalendarDayMetadata;
}

export interface CalendarWeek {
  key: string;
  label: string;
  days: CalendarDay[];
}

export interface CalendarMonth {
  monthLabel: string;
  weeks: CalendarWeek[];
}
