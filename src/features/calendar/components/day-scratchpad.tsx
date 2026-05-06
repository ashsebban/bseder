"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";

const LINE_HEIGHT = 28;

type FontChoice = "sans" | "serif" | "mono";

const FONT_STYLES: Record<FontChoice, React.CSSProperties> = {
  sans: { fontFamily: "inherit" },
  serif: { fontFamily: "Georgia, 'Times New Roman', serif" },
  mono: { fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace" },
};

const FONT_CYCLE: FontChoice[] = ["sans", "serif", "mono"];

// Standard Hebrew alphabet + common punctuation
const HEBREW_ROWS = [
  ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י"],
  ["כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ", "ק", "ר"],
  ["ש", "ת", "ך", "ם", "ן", "ף", "ץ", "׳", "״", "–"],
];

function storageKey(isoDate: string) {
  return `bseder_scratch_${isoDate}`;
}

export function DayScratchpad({ isoDate, className }: { isoDate: string; className?: string }) {
  const key = storageKey(isoDate);
  const [text, setText] = useState("");
  const [rtl, setRtl] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [font, setFont] = useState<FontChoice>("sans");
  const [copied, setCopied] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(localStorage.getItem(key) ?? "");
  }, [key]);

  function handleChange(value: string) {
    setText(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    }, 400);
  }

  function handleCopy() {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1800);
    });
  }

  function cycleFont() {
    setFont((f) => FONT_CYCLE[(FONT_CYCLE.indexOf(f) + 1) % FONT_CYCLE.length]);
  }

  function toggleRtl() {
    const next = !rtl;
    setRtl(next);
    if (!next) setShowKeyboard(false);
  }

  const insertChar = useCallback((char: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const newText = text.slice(0, start) + char + text.slice(end);
    handleChange(newText);
    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + char.length, start + char.length);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  return (
    <div
      className={cn("flex flex-col overflow-hidden rounded-2xl shadow-sm", className)}
      style={{ border: "1px solid rgba(210, 220, 240, 0.8)" }}
    >
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between gap-2 border-b px-4 py-2.5"
        style={{ backgroundColor: "#fdf8ee", borderColor: "rgba(225, 205, 160, 0.45)" }}
      >
        <p
          className="text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ color: "rgba(175, 135, 90, 0.75)" }}
        >
          Notes
        </p>

        <div className="flex items-center gap-1">
          {/* Font toggle */}
          <button
            type="button"
            onClick={cycleFont}
            title={`Font: ${font}`}
            className="flex h-6 w-7 items-center justify-center rounded-md text-[10px] font-semibold transition hover:bg-amber-100/60"
            style={{ color: "rgba(175, 135, 90, 0.75)" }}
          >
            Aa
          </button>

          {/* RTL / Hebrew toggle */}
          <button
            type="button"
            onClick={toggleRtl}
            title={rtl ? "Switch to LTR" : "Switch to RTL (Hebrew)"}
            className={cn(
              "flex h-6 w-7 items-center justify-center rounded-md text-[13px] font-semibold transition",
              rtl ? "bg-amber-100/80" : "hover:bg-amber-100/60",
            )}
            style={{ color: "rgba(175, 135, 90, 0.75)", fontFamily: "serif" }}
          >
            א
          </button>

          {/* Hebrew keyboard toggle (only when RTL active) */}
          {rtl && (
            <button
              type="button"
              onClick={() => setShowKeyboard((v) => !v)}
              title={showKeyboard ? "Hide keyboard" : "Show Hebrew keyboard"}
              className="flex h-6 w-6 items-center justify-center rounded-md transition hover:bg-amber-100/60"
              style={{ color: "rgba(175, 135, 90, 0.75)" }}
            >
              {showKeyboard ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}

          {/* Copy to clipboard */}
          <button
            type="button"
            onClick={handleCopy}
            title="Copy notes"
            className={cn(
              "flex h-6 items-center justify-center gap-1 rounded-md px-1.5 text-[10px] font-semibold transition",
              copied ? "bg-emerald-100/80 text-emerald-600" : "hover:bg-amber-100/60",
            )}
            style={copied ? undefined : { color: "rgba(175, 135, 90, 0.75)" }}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" strokeWidth={2.5} />
                <span>Copied</span>
              </>
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      {/* Hebrew soft keyboard */}
      {rtl && showKeyboard && (
        <div
          className="shrink-0 border-b px-3 py-2"
          style={{ backgroundColor: "#fdf6e8", borderColor: "rgba(225, 205, 160, 0.45)" }}
        >
          <div className="flex flex-col gap-1">
            {HEBREW_ROWS.map((row, ri) => (
              <div key={ri} className="flex justify-end gap-0.5">
                {row.map((char) => (
                  <button
                    key={char}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault(); // keep textarea focus
                      insertChar(char);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-200/60 bg-white/80 text-[14px] transition hover:bg-amber-50 hover:border-amber-300 active:bg-amber-100"
                    style={{
                      color: "#5a3e1b",
                      fontFamily: "serif",
                      lineHeight: 1,
                    }}
                  >
                    {char}
                  </button>
                ))}
              </div>
            ))}
          </div>
          {/* Space + Backspace row */}
          <div className="mt-1 flex justify-end gap-0.5">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertChar(" "); }}
              className="flex h-7 flex-1 items-center justify-center rounded-lg border border-amber-200/60 bg-white/80 text-[10px] text-amber-700/60 transition hover:bg-amber-50"
            >
              space
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                const el = textareaRef.current;
                if (!el) return;
                const start = el.selectionStart ?? text.length;
                const end = el.selectionEnd ?? text.length;
                if (start === end && start > 0) {
                  const newText = text.slice(0, start - 1) + text.slice(end);
                  handleChange(newText);
                  requestAnimationFrame(() => {
                    el.focus();
                    el.setSelectionRange(start - 1, start - 1);
                  });
                } else if (start !== end) {
                  const newText = text.slice(0, start) + text.slice(end);
                  handleChange(newText);
                  requestAnimationFrame(() => {
                    el.focus();
                    el.setSelectionRange(start, start);
                  });
                }
              }}
              className="flex h-7 w-14 items-center justify-center rounded-lg border border-amber-200/60 bg-white/80 text-[10px] text-amber-700/60 transition hover:bg-amber-50"
            >
              ⌫
            </button>
          </div>
        </div>
      )}

      {/* Ruled paper */}
      <div
        className="relative min-h-0 flex-1"
        style={{
          backgroundColor: "#fefcf7",
          backgroundImage: [
            `repeating-linear-gradient(
              transparent,
              transparent ${LINE_HEIGHT - 1}px,
              rgba(155, 195, 255, 0.55) ${LINE_HEIGHT - 1}px,
              rgba(155, 195, 255, 0.55) ${LINE_HEIGHT}px
            )`,
            rtl
              ? `linear-gradient(
                  to left,
                  transparent 47px,
                  rgba(230, 95, 105, 0.4) 47px,
                  rgba(230, 95, 105, 0.4) 49px,
                  transparent 49px
                )`
              : `linear-gradient(
                  to right,
                  transparent 47px,
                  rgba(230, 95, 105, 0.4) 47px,
                  rgba(230, 95, 105, 0.4) 49px,
                  transparent 49px
                )`,
          ].join(", "),
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={rtl ? "התחל לכתוב…" : "Start writing…"}
          dir={rtl ? "rtl" : "ltr"}
          spellCheck
          className="absolute inset-0 h-full w-full resize-none bg-transparent focus:outline-none placeholder:text-slate-300/70"
          style={{
            lineHeight: `${LINE_HEIGHT}px`,
            paddingTop: "2px",
            paddingLeft: rtl ? "16px" : "58px",
            paddingRight: rtl ? "58px" : "16px",
            paddingBottom: "16px",
            fontSize: "13px",
            color: "#374151",
            caretColor: "#6366f1",
            ...FONT_STYLES[font],
          }}
        />
      </div>
    </div>
  );
}
