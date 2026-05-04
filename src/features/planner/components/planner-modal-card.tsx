import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PlannerModalAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}

export function PlannerModalCard({
  title,
  subtitle,
  onClose,
  widthClassName = "w-72",
  children,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  widthClassName?: string;
  children?: ReactNode;
  actions?: PlannerModalAction[];
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={cn("rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/10", widthClassName)}>
        <p className="text-[13.5px] font-bold text-slate-800">{title}</p>
        {subtitle ? <div className="mt-1 text-[12px] text-slate-500">{subtitle}</div> : null}
        {children}
        {actions && actions.length > 0 ? (
          <div className="mt-4 flex gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={cn(
                  "flex-1 rounded-xl py-2 text-[12px] font-semibold transition",
                  action.variant === "primary"
                    ? "bg-brand text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50",
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
