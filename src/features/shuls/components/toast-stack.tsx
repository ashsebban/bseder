"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/cn";

interface Toast {
  id: string;
  message: string;
  subtext?: string;
  href?: string;
  variant?: "success" | "info";
}

interface ToastContextValue {
  push: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be inside ToastProvider");
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[2000] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => {
          const Icon = toast.variant === "success" ? CheckCircle2 : Info;
          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto rounded-lg border bg-white px-4 py-3 shadow-lg",
                toast.variant === "success" ? "border-green-200" : "border-slate-200",
              )}
            >
              <div className="flex items-start gap-2.5">
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    toast.variant === "success" ? "text-green-600" : "text-brand",
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800">{toast.message}</p>
                  {toast.subtext && <p className="mt-0.5 text-[11px] text-slate-500">{toast.subtext}</p>}
                  {toast.href && (
                    <a
                      href={toast.href}
                      className="mt-1 inline-block text-[11px] font-semibold text-brand hover:underline"
                    >
                      {toast.href.startsWith("/planner") ? "View on calendar" : "View"}
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
