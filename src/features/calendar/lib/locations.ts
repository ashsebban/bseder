export interface CalendarLocationOption {
  key: string;
  label: string;
  lookupName: string;
}

export const calendarLocationOptions: CalendarLocationOption[] = [
  { key: "jerusalem", label: "Jerusalem", lookupName: "Jerusalem" },
  { key: "tel-aviv", label: "Tel Aviv", lookupName: "Tel Aviv" },
  { key: "new-york", label: "New York", lookupName: "New York" },
  { key: "los-angeles", label: "Los Angeles", lookupName: "Los Angeles" },
  { key: "london", label: "London", lookupName: "London" },
  { key: "miami", label: "Miami", lookupName: "Miami" },
];

export function getCalendarLocationByKey(key: string | null | undefined) {
  if (!key) return null;
  return calendarLocationOptions.find((option) => option.key === key) ?? null;
}
