// Static mini-calendar mockup showing what B'Seder looks like.
// No data, no props, no interactivity — purely illustrative.

const DAYS = [
  { short: "Sun", heb: "א׳ אייר" },
  { short: "Mon", heb: "ב׳ אייר" },
  { short: "Tue", heb: "ג׳ אייר" },
  { short: "Wed", heb: "ד׳ אייר" },
  { short: "Thu", heb: "ה׳ אייר" },
  { short: "Fri", heb: "ו׳ אייר" },
  { short: "Shab", heb: "ז׳ אייר" },
];

interface Chip {
  label: string;
  variant: "goal" | "zman" | "shabbos";
}

const DAY_CHIPS: Record<number, Chip[]> = {
  0: [{ label: "Mussar", variant: "goal" }],
  1: [{ label: "Daf Yomi", variant: "goal" }, { label: "Exercise", variant: "goal" }],
  2: [{ label: "Daf Yomi", variant: "goal" }],
  3: [{ label: "Daf Yomi", variant: "goal" }, { label: "Mussar", variant: "goal" }],
  4: [{ label: "Daf Yomi", variant: "goal" }],
  5: [{ label: "Candles 7:24", variant: "zman" }],
  6: [{ label: "Shabbos rest", variant: "shabbos" }],
};

const variantStyles: Record<Chip["variant"], string> = {
  goal: "bg-brand/10 text-brand border border-brand/20",
  zman: "bg-amber-50 text-amber-700 border border-amber-200",
  shabbos: "bg-violet-50 text-violet-600 border border-violet-200",
};

export function ValuePropositionCard() {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-line/60 bg-surface shadow-sm">
      {/* Mini week-grid header */}
      <div className="grid grid-cols-7 border-b border-line/40 bg-canvas">
        {DAYS.map((d) => (
          <div key={d.short} className="flex flex-col items-center px-1 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-text-subtle">{d.short}</span>
            <span className="mt-0.5 text-[8px] text-text-subtle/60">{d.heb}</span>
          </div>
        ))}
      </div>

      {/* Mini week-grid body */}
      <div className="grid grid-cols-7 gap-px bg-line/20 p-px">
        {DAYS.map((d, i) => (
          <div
            key={d.short}
            className="flex min-h-[64px] flex-col gap-1 bg-surface p-1"
          >
            {(DAY_CHIPS[i] ?? []).map((chip) => (
              <span
                key={chip.label}
                className={`truncate rounded-md px-1.5 py-0.5 text-[9px] font-medium leading-tight ${variantStyles[chip.variant]}`}
              >
                {chip.label}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* Caption */}
      <div className="border-t border-line/40 bg-canvas px-3 py-2">
        <p className="text-center text-[10px] font-medium text-text-subtle">Goals adapt to the Jewish calendar automatically.</p>
      </div>
    </div>
  );
}
