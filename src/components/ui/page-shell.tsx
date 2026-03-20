import * as React from "react";
import { cn } from "@/lib/cn";

export function PageShell({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "min-h-screen bg-[radial-gradient(circle_at_top,_rgba(93,142,255,0.18),_transparent_35%),linear-gradient(180deg,_#f4f8ff_0%,_#edf4ff_48%,_#f8fbff_100%)] text-text",
        className,
      )}
      {...props}
    />
  );
}

export function PageContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto max-w-[1360px] px-6 py-6 md:px-8 md:py-8", className)} {...props} />;
}
