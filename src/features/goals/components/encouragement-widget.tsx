"use client";

import { useState, useEffect } from "react";
import { getDailyEncouragement, type DailyQuote } from "@/features/goals/lib/encouragement-catalog";

export function EncouragementWidget() {
  const [quote, setQuote] = useState<DailyQuote | null>(null);

  useEffect(() => {
    setQuote(getDailyEncouragement());
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand/10 bg-gradient-to-br from-brand/[0.04] via-white to-white shadow-sm">
      {/* Top accent stripe */}
      <div className="h-[3px] bg-gradient-to-r from-brand via-brand/60 to-transparent" />

      {/* Giant background quote mark — purely decorative */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-3 left-5 select-none font-serif text-[9rem] leading-none text-brand/[0.07]"
      >
        &ldquo;
      </span>

      <div className="relative flex flex-col gap-5 px-8 py-7 md:flex-row md:items-center md:gap-10">
        {/* Label + quote */}
        <div className="flex flex-1 flex-col gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand/40">
            Encouragement of the Day
          </p>
          <blockquote className="text-[16px] font-[500] leading-[1.7] text-slate-800">
            {quote?.text ?? " "}
          </blockquote>
        </div>

        {/* Vertical divider — desktop only */}
        <div className="hidden h-14 w-px shrink-0 bg-slate-200/80 md:block" />

        {/* Attribution */}
        <div className="shrink-0 md:w-52">
          {quote && (
            <>
              <p className="text-[14px] font-bold leading-snug text-slate-700">
                {quote.attribution}
              </p>
              {quote.source && (
                <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
                  {quote.source}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
