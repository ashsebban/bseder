export type CalendarTimeFormat = "12h" | "24h";
export type MissedBehavior = "punish" | "forgive";
export type HavdalahOpinion = "tzeit-8_5" | "42" | "50" | "72";
export type Nusach = "ashkenaz" | "sfard" | "sephardi" | "temanim" | "chabad" | "custom";
export type HavdalahMode = "nusach" | "custom";
export type ObservanceLevel = "shabbos" | "not-shabbos" | "mixed" | "unknown";
export type HebrewDateFormat = "english" | "hebrew" | "both";

export interface CustomLocation {
  lat: number;
  lng: number;
  tzid: string;
  label: string;
}

export interface CalendarPreferences {
  // Location
  locationKey: string;
  customLocation?: CustomLocation;
  // My Judaism
  nusach: Nusach;
  havdalahMode: HavdalahMode;
  observanceLevel: ObservanceLevel;
  // Times
  timeFormat: CalendarTimeFormat;
  havdalahOpinion: HavdalahOpinion;
  // Calendar display
  showHebrewDates: boolean;
  showParsha: boolean;
  showOutsideMonthDays: boolean;
  showModernHolidays: boolean;
  weekStartsOn: 0 | 1;
  defaultView: "month" | "week" | "day";
  showRoshChodesh: boolean;
  timelineSnapMins: 5 | 15 | 30 | 60;
  timelineDefaultDurationMins: 15 | 30 | 45 | 60 | 90 | 120;
  // Goals display
  showHebrewDatesOnGoals: boolean;
  hebrewDateFormat: HebrewDateFormat;
  hebrewDateIncludeYear: boolean;
  // Tasks
  missedBehavior: MissedBehavior;
}
