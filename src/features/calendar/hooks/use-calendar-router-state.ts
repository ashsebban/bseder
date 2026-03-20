"use client";

import { useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CalendarView } from "@/features/calendar/types/calendar";
import { addDays, addMonths, parseIsoDate, startOfDay, todayIso, toIsoDate } from "@/features/calendar/lib/date";
import { parseCalendarQuery } from "@/features/calendar/lib/query-state";

function shiftDateForView(date: Date, view: CalendarView, direction: 1 | -1) {
  if (view === "month") return addMonths(date, direction);
  if (view === "week") return addDays(date, direction * 7);
  return addDays(date, direction);
}

export function useCalendarRouterState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const state = useMemo(() => {
    return parseCalendarQuery({
      view: searchParams.get("view") ?? undefined,
      date: searchParams.get("date") ?? undefined,
    });
  }, [searchParams]);

  const selectedDate = parseIsoDate(state.dateIso) ?? startOfDay(new Date());

  const setQuery = (next: Partial<{ view: CalendarView; dateIso: string }>) => {
    const params = new URLSearchParams(searchParams.toString());
    const view = next.view ?? state.view;
    const dateIso = next.dateIso ?? state.dateIso;
    params.set("view", view);
    params.set("date", dateIso);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  return {
    view: state.view,
    selectedDate,
    selectedDateIso: state.dateIso,
    isPending,
    setView: (view: CalendarView) => setQuery({ view }),
    setSelectedDate: (date: Date) => setQuery({ dateIso: toIsoDate(date) }),
    jumpToToday: () => setQuery({ dateIso: todayIso() }),
    goToPrevious: () => setQuery({ dateIso: toIsoDate(shiftDateForView(selectedDate, state.view, -1)) }),
    goToNext: () => setQuery({ dateIso: toIsoDate(shiftDateForView(selectedDate, state.view, 1)) }),
  };
}
