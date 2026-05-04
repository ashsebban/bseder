import { useRef } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { cn } from "@/lib/cn";
import { GoalRowGripIcon } from "@/features/calendar/components/goal-list-row";

export function ReorderGrip({
  itemId,
  itemIds,
  onReorder,
  rowStepPx,
  onDragStart,
  onDragEnd,
  className,
  iconWidth,
  iconHeight,
  disabled = false,
}: {
  itemId: string;
  itemIds: string[];
  onReorder: (prev: string[], next: string[]) => void;
  rowStepPx: number;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  className?: string;
  iconWidth?: number;
  iconHeight?: number;
  disabled?: boolean;
}) {
  const dragRef = useRef<{ lastY: number; currentIdx: number } | null>(null);

  return (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      aria-label={disabled ? "Reordering unavailable" : "Reorder within this day"}
      title={disabled ? "Reordering unavailable" : "Reorder within this day"}
      className={cn(
        "shrink-0 touch-none transition-all active:scale-105",
        disabled ? "cursor-default text-slate-200/70" : "cursor-grab text-slate-300 hover:text-slate-400 active:cursor-grabbing",
        className,
      )}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        if (disabled) return;
        const startIdx = itemIds.indexOf(itemId);
        if (startIdx === -1) return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        onDragStart?.();
        dragRef.current = { lastY: event.clientY, currentIdx: startIdx };
      }}
      onPointerMove={(event) => {
        if (!dragRef.current) return;
        event.stopPropagation();
        const delta = event.clientY - dragRef.current.lastY;
        if (Math.abs(delta) < rowStepPx * 0.6) return;
        const direction = delta > 0 ? 1 : -1;
        const nextIdx = Math.max(0, Math.min(itemIds.length - 1, dragRef.current.currentIdx + direction));
        if (nextIdx === dragRef.current.currentIdx) return;
        onReorder(itemIds, arrayMove(itemIds, dragRef.current.currentIdx, nextIdx));
        dragRef.current = { lastY: event.clientY, currentIdx: nextIdx };
      }}
      onPointerUp={(event) => {
        if (!dragRef.current) return;
        event.stopPropagation();
        dragRef.current = null;
        onDragEnd?.();
      }}
      onPointerCancel={() => {
        dragRef.current = null;
        onDragEnd?.();
      }}
    >
      <GoalRowGripIcon width={iconWidth} height={iconHeight} />
    </button>
  );
}
