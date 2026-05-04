import { cn } from "@/lib/cn";

export interface ProgressSegment {
  key: string;
  widthPct: number;
  className: string;
}

export function SegmentedProgressBar({
  segments,
  className,
  trackClassName,
  heightClassName = "h-[4px]",
}: {
  segments: ProgressSegment[];
  className?: string;
  trackClassName?: string;
  heightClassName?: string;
}) {
  const visibleSegments = segments.filter((segment) => segment.widthPct > 0);

  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-slate-100", heightClassName, trackClassName, className)}>
      <div className="flex h-full">
        {visibleSegments.map((segment) => (
          <div
            key={segment.key}
            className={cn("h-full transition-all duration-300", segment.className)}
            style={{ width: `${segment.widthPct}%` }}
          />
        ))}
      </div>
    </div>
  );
}
