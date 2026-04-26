export type CalendarTimeFormat = "12h" | "24h";
export type HavdalahOpinion = "tzeit-8_5" | "42" | "50" | "72";

export interface CustomLocation {
  lat: number;
  lng: number;
  tzid: string;
  label: string;
}

export interface CalendarPreferences {
  locationKey: string;
  customLocation?: CustomLocation;
  timeFormat: CalendarTimeFormat;
  showHebrewDates: boolean;
  havdalahOpinion: HavdalahOpinion;
  showParsha: boolean;
  showOutsideMonthDays: boolean;
  showModernHolidays: boolean;
  weekStartsOn: 0 | 1;
  defaultView: "month" | "week" | "day";
  showRoshChodesh: boolean;
  timelineSnapMins: 5 | 15 | 30 | 60;
  timelineDefaultDurationMins: 15 | 30 | 45 | 60 | 90 | 120;
}
