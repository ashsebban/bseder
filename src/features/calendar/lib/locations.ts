import { Location } from "@hebcal/core";
import type { CalendarPreferences } from "@/features/settings/types/calendar-preferences";

export interface CalendarLocationOption {
  key: string;
  label: string;
  group: string;
  lat: number;
  lng: number;
  tzid: string;
}

export interface CalendarLocationGroup {
  label: string;
  options: CalendarLocationOption[];
}

function toLocationKey(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function preset(group: string, label: string, lat: number, lng: number, tzid: string, key = toLocationKey(label)): CalendarLocationOption {
  return {
    key,
    label,
    group,
    lat,
    lng,
    tzid,
  };
}

export const calendarLocationGroups: CalendarLocationGroup[] = [
  {
    label: "Israel",
    options: [
      preset("Israel", "Jerusalem", 31.768959, 35.216209, "Asia/Jerusalem"),
      preset("Israel", "Bnei Brak", 32.084041, 34.833912, "Asia/Jerusalem"),
      preset("Israel", "Tel Aviv", 32.087719, 34.77956, "Asia/Jerusalem"),
      preset("Israel", "Haifa", 32.794044, 34.989571, "Asia/Jerusalem"),
      preset("Israel", "Beit Shemesh", 31.74329, 34.99065, "Asia/Jerusalem"),
      preset("Israel", "Modiin", 31.89378, 35.01015, "Asia/Jerusalem"),
      preset("Israel", "Raanana", 32.18433, 34.87154, "Asia/Jerusalem"),
    ],
  },
  {
    label: "US — Northeast",
    options: [
      preset("US — Northeast", "New York", 40.712776, -74.005974, "America/New_York"),
      preset("US — Northeast", "Brooklyn, NY", 40.650002, -73.949997, "America/New_York"),
      preset("US — Northeast", "Manhattan, NY", 40.758896, -73.98513, "America/New_York"),
      preset("US — Northeast", "Monsey, NY", 41.11129, -74.06868, "America/New_York"),
      preset("US — Northeast", "Five Towns, NY", 40.62756, -73.73069, "America/New_York"),
      preset("US — Northeast", "Lakewood, NJ", 40.09576, -74.21773, "America/New_York"),
      preset("US — Northeast", "Teaneck, NJ", 40.8917, -74.01265, "America/New_York"),
      preset("US — Northeast", "Baltimore, MD", 39.290385, -76.61219, "America/New_York"),
      preset("US — Northeast", "Boston, MA", 42.360082, -71.05888, "America/New_York"),
      preset("US — Northeast", "Philadelphia, PA", 39.952584, -75.165222, "America/New_York"),
    ],
  },
  {
    label: "US — Midwest & South",
    options: [
      preset("US — Midwest & South", "Chicago, IL", 41.878114, -87.629798, "America/Chicago"),
      preset("US — Midwest & South", "Detroit, MI", 42.331427, -83.045754, "America/Detroit"),
      preset("US — Midwest & South", "Cleveland, OH", 41.49932, -81.69436, "America/New_York"),
      preset("US — Midwest & South", "Miami, FL", 25.774266, -80.193659, "America/New_York", "miami"),
      preset("US — Midwest & South", "Aventura, FL", 25.95619, -80.13923, "America/New_York"),
      preset("US — Midwest & South", "Houston, TX", 29.760427, -95.369804, "America/Chicago"),
      preset("US — Midwest & South", "Dallas, TX", 32.776664, -96.796988, "America/Chicago"),
    ],
  },
  {
    label: "US — West",
    options: [
      preset("US — West", "Los Angeles, CA", 34.052235, -118.243683, "America/Los_Angeles", "los-angeles"),
      preset("US — West", "Palm Springs, CA", 33.830292, -116.545868, "America/Los_Angeles"),
      preset("US — West", "San Francisco, CA", 37.774929, -122.419418, "America/Los_Angeles"),
      preset("US — West", "Las Vegas, NV", 36.174969, -115.137341, "America/Los_Angeles"),
      preset("US — West", "Denver, CO", 39.739236, -104.984862, "America/Denver"),
      preset("US — West", "Scottsdale, AZ", 33.49417, -111.926048, "America/Phoenix"),
    ],
  },
  {
    label: "Canada",
    options: [
      preset("Canada", "Montreal, QC", 45.501689, -73.567256, "America/Toronto"),
      preset("Canada", "Toronto, ON", 43.65107, -79.347015, "America/Toronto"),
    ],
  },
  {
    label: "United Kingdom",
    options: [
      preset("United Kingdom", "London", 51.507351, -0.127758, "Europe/London"),
      preset("United Kingdom", "Manchester", 53.480759, -2.242631, "Europe/London"),
      preset("United Kingdom", "Gateshead", 54.96278, -1.60391, "Europe/London"),
    ],
  },
  {
    label: "Europe",
    options: [
      preset("Europe", "Antwerp", 51.219449, 4.402464, "Europe/Brussels"),
      preset("Europe", "Paris", 48.856613, 2.352222, "Europe/Paris"),
      preset("Europe", "Amsterdam", 52.370216, 4.895168, "Europe/Amsterdam"),
      preset("Europe", "Zurich", 47.376887, 8.541694, "Europe/Zurich"),
      preset("Europe", "Vienna", 48.208174, 16.373819, "Europe/Vienna"),
    ],
  },
  {
    label: "Latin America",
    options: [
      preset("Latin America", "Buenos Aires", -34.603722, -58.381592, "America/Argentina/Buenos_Aires"),
      preset("Latin America", "Sao Paulo", -23.55052, -46.633308, "America/Sao_Paulo"),
      preset("Latin America", "Mexico City", 19.432608, -99.133208, "America/Mexico_City"),
    ],
  },
  {
    label: "Australia & South Africa",
    options: [
      preset("Australia & South Africa", "Melbourne", -37.813628, 144.963058, "Australia/Melbourne"),
      preset("Australia & South Africa", "Sydney", -33.86882, 151.20929, "Australia/Sydney"),
      preset("Australia & South Africa", "Johannesburg", -26.195246, 28.034088, "Africa/Johannesburg"),
      preset("Australia & South Africa", "Cape Town", -33.924869, 18.424055, "Africa/Johannesburg"),
    ],
  },
];

export const calendarLocationOptions = calendarLocationGroups.flatMap((group) => group.options);

export function getCalendarLocationByKey(key: string | null | undefined) {
  if (!key) return null;
  return calendarLocationOptions.find((option) => option.key === key) ?? null;
}

export function buildCustomLocation(lat: number, lng: number, tzid: string, label: string): Location {
  return new Location(lat, lng, false, tzid, label, "");
}

export function resolveLocation(preferences: Pick<CalendarPreferences, "locationKey" | "customLocation">): Location | null {
  if (preferences.locationKey === "my-location" || preferences.locationKey === "zip") {
    const custom = preferences.customLocation;
    if (!custom) return null;
    return buildCustomLocation(custom.lat, custom.lng, custom.tzid, custom.label);
  }

  const option = getCalendarLocationByKey(preferences.locationKey);
  if (!option) return null;
  return buildCustomLocation(option.lat, option.lng, option.tzid, option.label);
}
