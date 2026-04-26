"use client";

import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/cn";

type GoalListRowDensity = "compact" | "comfortable" | "panel";

const DENSITY_CLASSES: Record<
  GoalListRowDensity,
  {
    root: string;
    leading: string;
    checkbox: string;
    content: string;
    trailing: string;
  }
> = {
  compact: {
    root: "group flex w-full items-center gap-1 rounded-lg px-1 py-0.5 transition",
    leading: "flex h-4 w-2.5 shrink-0 items-center justify-center",
    checkbox: "flex shrink-0 items-center justify-center",
    content: "min-w-0 flex-1",
    trailing: "flex shrink-0 items-center justify-center",
  },
  comfortable: {
    root: "group flex w-full items-center gap-3 rounded-xl px-2 py-1.5 transition",
    leading: "flex h-5 w-3 shrink-0 items-center justify-center",
    checkbox: "flex shrink-0 items-center justify-center",
    content: "min-w-0 flex-1",
    trailing: "flex shrink-0 items-center justify-center",
  },
  panel: {
    root: "group flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm",
    leading: "flex h-5 w-3.5 shrink-0 items-center justify-center",
    checkbox: "flex shrink-0 items-center justify-center",
    content: "min-w-0 flex-1",
    trailing: "flex shrink-0 items-center justify-center",
  },
};

export function GoalRowGripIcon({
  className,
  width = 8,
  height = 12,
}: {
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 8 12"
      fill="currentColor"
      className={className}
    >
      <circle cx="2" cy="2" r="1.3" />
      <circle cx="6" cy="2" r="1.3" />
      <circle cx="2" cy="6" r="1.3" />
      <circle cx="6" cy="6" r="1.3" />
      <circle cx="2" cy="10" r="1.3" />
      <circle cx="6" cy="10" r="1.3" />
    </svg>
  );
}

export function GoalListRow({
  density = "comfortable",
  className,
  rowRef,
  rootProps,
  style,
  leading,
  checkbox,
  content,
  trailing,
}: {
  density?: GoalListRowDensity;
  className?: string;
  rowRef?: Ref<HTMLDivElement>;
  rootProps?: HTMLAttributes<HTMLDivElement>;
  style?: CSSProperties;
  leading?: ReactNode;
  checkbox: ReactNode;
  content: ReactNode;
  trailing?: ReactNode;
}) {
  const classes = DENSITY_CLASSES[density];

  return (
    <div ref={rowRef} style={style} className={cn(classes.root, className)} {...rootProps}>
      <div className={classes.leading}>{leading}</div>
      <div className={classes.checkbox}>{checkbox}</div>
      <div className={classes.content}>{content}</div>
      {trailing ? <div className={classes.trailing}>{trailing}</div> : null}
    </div>
  );
}

export function EditableGoalTitle({
  title,
  onRename,
  className,
  inputClassName,
  suffix,
  disabled = false,
}: {
  title: string;
  onRename?: (nextTitle: string) => void;
  className?: string;
  inputClassName?: string;
  suffix?: ReactNode;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  function finishRename(nextRaw: string) {
    const nextTitle = nextRaw.trim();
    setEditing(false);
    if (!onRename || !nextTitle || nextTitle === title) {
      setDraft(title);
      return;
    }
    onRename(nextTitle);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      finishRename(draft);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(title);
      setEditing(false);
    }
  }

  if (!onRename || disabled) {
    return (
      <span className={cn("block min-w-0", className)}>
        <span className="flex min-w-0 items-baseline">
          <span className="min-w-0 truncate">{title}</span>
          {suffix ? <span className="shrink-0">{suffix}</span> : null}
        </span>
      </span>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => finishRename(draft)}
        onKeyDown={handleKeyDown}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        className={cn(
          "block w-full rounded-md border border-brand/20 bg-white px-1 py-0.5 text-inherit outline-none ring-2 ring-brand/15",
          inputClassName,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "block w-full min-w-0 appearance-none bg-transparent p-0 text-left align-top",
        className,
      )}
    >
      <span className="flex min-w-0 items-baseline">
        <span className="min-w-0 truncate">{title}</span>
        {suffix ? <span className="shrink-0">{suffix}</span> : null}
      </span>
    </button>
  );
}
