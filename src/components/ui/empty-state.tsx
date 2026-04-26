import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  message: string;
  description?: string;
  variant?: "text" | "dropzone";
  active?: boolean;
  className?: string;
}

export function EmptyState({
  message,
  description,
  variant = "text",
  active = false,
  className,
}: EmptyStateProps) {
  if (variant === "dropzone") {
    return (
      <div
        className={cn(
          "flex flex-1 items-center justify-center rounded-xl border border-dashed m-1 transition-colors",
          active ? "border-brand/40 bg-brand/[0.04]" : "border-subtle",
          className,
        )}
      >
        <p className={cn("text-[10px]", active ? "text-brand/60" : "text-text-subtle/60")}>
          {message}
        </p>
      </div>
    );
  }

  return (
    <div className={cn(className)}>
      <p className="text-[12px] text-text-subtle">{message}</p>
      {description ? <p className="mt-1 text-[11px] leading-relaxed text-text-subtle/80">{description}</p> : null}
    </div>
  );
}
