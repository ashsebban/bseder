import { z } from "zod";
import type { CalendarView } from "@/features/calendar/types/calendar";
import { parseIsoDate, todayIso, toIsoDate } from "@/lib/date";

const viewSchema = z.enum(["month", "week", "day"]);

export interface CalendarQueryState {
  view: CalendarView;
  dateIso: string;
}

export function parseCalendarQuery(input: Record<string, string | string[] | undefined>): CalendarQueryState {
  const rawView = Array.isArray(input.view) ? input.view[0] : input.view;
  const rawDate = Array.isArray(input.date) ? input.date[0] : input.date;
  const parsedView = viewSchema.safeParse(rawView);
  const parsedDate = rawDate ? parseIsoDate(rawDate) : null;

  return {
    view: parsedView.success ? parsedView.data : "month",
    dateIso: parsedDate ? toIsoDate(parsedDate) : todayIso(),
  };
}
