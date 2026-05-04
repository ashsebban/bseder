"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CalendarView } from "@/features/calendar/types/calendar";
import { addDays, addMonths, parseIsoDate, startOfDay, toIsoDate } from "@/lib/date";
import { parseCalendarQuery } from "@/features/calendar/lib/query-state";

const LAST_VIEW_KEY = "planner.last-calendar-view";
const LAST_DATE_KEY = "planner.last-calendar-date";

const CALENDAR_VIEWS = new Set<CalendarView>(["month", "week", "day"]);

function readStoredView(): CalendarView | null {
  try {
    const v = localStorage.getItem(LAST_VIEW_KEY);
    return CALENDAR_VIEWS.has(v as CalendarView) ? (v as CalendarView) : null;
  } catch {
    return null;
  }
}

function readStoredDate(): Date | null {
  try {
    const d = localStorage.getItem(LAST_DATE_KEY);
    return d ? parseIsoDate(d) ?? null : null;
  } catch {
    return null;
  }
}

function shiftDateForView(date: Date, view: CalendarView, direction: 1 | -1) {
  if (view === "month") return addMonths(date, direction);
  if (view === "week") return addDays(date, direction * 7);
  return addDays(date, direction);
}

export function useCalendarRouterState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read URL params once synchronously for SSR compatibility; they're the initial seed.
  const urlState = parseCalendarQuery({
    view: searchParams.get("view") ?? undefined,
    date: searchParams.get("date") ?? undefined,
  });

  const viewFromUrl = searchParams.has("view");
  const dateFromUrl = searchParams.has("date");

  // On mount: use URL params if present (deep links / "Open Today"), else localStorage.
  // After mount, all state is local — no router.replace() on view switches.
  const [view, setViewState] = useState<CalendarView>(() => {
    if (viewFromUrl) return urlState.view;
    return "week"; // will be overwritten by localStorage in useEffect
  });

  const [selectedDate, setSelectedDateState] = useState<Date>(() => {
    if (dateFromUrl) return parseIsoDate(urlState.dateIso) ?? startOfDay(new Date());
    return startOfDay(new Date());
  });

  // Track which initial values came from the URL so CalendarWorkspace knows.
  const initialViewFromUrl = useRef(viewFromUrl);
  const initialDateFromUrl = useRef(dateFromUrl);

  // On mount: restore from localStorage (unless URL provided the value), then clean URL.
  useEffect(() => {
    if (!initialViewFromUrl.current) {
      const stored = readStoredView();
      if (stored) setViewState(stored);
    }
    if (!initialDateFromUrl.current) {
      const stored = readStoredDate();
      if (stored) setSelectedDateState(stored);
    }

    // Clean URL params so the address bar stays tidy and future navigations don't
    // re-seed stale values.
    if (initialViewFromUrl.current || initialDateFromUrl.current) {
      router.replace(pathname, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist to localStorage on every change.
  useEffect(() => {
    try {
      localStorage.setItem(LAST_VIEW_KEY, view);
    } catch { /* ignore */ }
  }, [view]);

  useEffect(() => {
    try {
      localStorage.setItem(LAST_DATE_KEY, toIsoDate(selectedDate));
    } catch { /* ignore */ }
  }, [selectedDate]);

  const setView = useCallback((v: CalendarView) => setViewState(v), []);
  const setSelectedDate = useCallback((d: Date) => setSelectedDateState(d), []);

  return {
    view,
    viewFromUrl: initialViewFromUrl.current,
    dateFromUrl: initialDateFromUrl.current,
    selectedDate,
    selectedDateIso: toIsoDate(selectedDate),
    isPending: false,
    setView,
    setSelectedDate,
    setDateAndView: useCallback((date: Date, v: CalendarView) => {
      setSelectedDateState(date);
      setViewState(v);
    }, []),
    jumpToToday: useCallback(() => setSelectedDateState(startOfDay(new Date())), []),
    goToPrevious: useCallback(() => {
      setSelectedDateState((d) => shiftDateForView(d, view, -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view]),
    goToNext: useCallback(() => {
      setSelectedDateState((d) => shiftDateForView(d, view, 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view]),
  };
}
