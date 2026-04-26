import { useState } from "react";
import { cn } from "@/lib/cn";
import { EmptyState, type EmptyStateProps } from "@/components/ui/empty-state";

type InlineAddTaskDensity = "compact" | "comfortable";

const DENSITY_CLASSES: Record<
  InlineAddTaskDensity,
  {
    input: string;
    button: string;
  }
> = {
  compact: {
    input: "w-full rounded-lg border border-brand/30 bg-white px-2 py-1 text-[12px] text-slate-800 placeholder-slate-300 outline-none focus:ring-1 focus:ring-brand/20",
    button: "flex w-full items-center gap-1 rounded-lg px-1.5 py-1 text-left text-[11px] text-slate-300 transition hover:text-slate-400",
  },
  comfortable: {
    input: "mx-2 rounded-xl border border-brand/30 px-3 py-2 text-[13px] text-slate-800 placeholder-slate-300 outline-none focus:ring-1 focus:ring-brand/20",
    button: "flex items-center gap-1.5 rounded-xl px-2 py-2 text-left text-[12px] text-slate-300 transition hover:text-slate-500",
  },
};

export function InlineAddTask({
  onAddTask,
  density = "comfortable",
  addLabel = "+ Add task",
  placeholder = "Task name…",
  className,
}: {
  onAddTask?: (title: string) => void;
  density?: InlineAddTaskDensity;
  addLabel?: string;
  placeholder?: string;
  className?: string;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState("");

  if (!onAddTask) return null;
  const handleAddTask = onAddTask;

  const classes = DENSITY_CLASSES[density];

  function commit() {
    const title = draft.trim();
    if (title) handleAddTask(title);
    setDraft("");
    setIsAdding(false);
  }

  if (isAdding) {
    return (
      <input
        autoFocus
        type="text"
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && draft.trim()) {
            event.preventDefault();
            event.stopPropagation();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setDraft("");
            setIsAdding(false);
          }
        }}
        onBlur={commit}
        className={cn(classes.input, className)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsAdding(true)}
      className={cn(classes.button, className)}
    >
      {addLabel}
    </button>
  );
}

export function TaskListEmptyState({
  message,
  description,
  variant = "text",
  active = false,
  className,
}: EmptyStateProps) {
  return (
    <EmptyState
      message={message}
      description={description}
      variant={variant}
      active={active}
      className={className}
    />
  );
}
