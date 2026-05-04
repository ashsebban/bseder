import { cn } from "@/lib/cn";

export function CompletionBanner({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-success/20 bg-success/[0.07] px-4 py-2.5", className)}>
      <p className="text-[12.5px] font-semibold text-success">✓ {message}</p>
    </div>
  );
}

export function CompletionCount({
  completedCount,
  totalCount,
  density = "comfortable",
  className,
}: {
  completedCount: number;
  totalCount: number;
  density?: "compact" | "comfortable";
  className?: string;
}) {
  const allDone = totalCount > 0 && completedCount === totalCount;

  return (
    <span
      className={cn(
        "font-semibold tabular-nums transition-colors",
        density === "compact" ? "text-[10.5px]" : "text-[12.5px]",
        allDone ? "text-success" : "text-slate-500",
        className,
      )}
    >
      {completedCount}/{totalCount} done
    </span>
  );
}
