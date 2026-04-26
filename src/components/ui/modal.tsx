"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  panelClassName?: string;
  bodyClassName?: string;
}

export function Modal({ open, onClose, title, description, children, footer, panelClassName, bodyClassName }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-text/30 backdrop-blur-[3px]"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      >
        <div
          className={cn(
            "flex w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-surface shadow-panel",
            "max-h-[90vh]",
            panelClassName,
          )}
        >
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line/50 px-6 pt-5 pb-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-text">{title}</h2>
              {description ? (
                <p className="mt-1 text-sm text-text-muted">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-0.5 shrink-0 rounded-xl p-1.5 text-text-muted transition hover:bg-surface-muted hover:text-text"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className={cn("min-h-0 flex-1", bodyClassName ?? "overflow-y-auto px-6 py-5")}>
            {children}
          </div>

          {/* Footer */}
          {footer ? (
            <div className="shrink-0 border-t border-line/50 px-6 py-4">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

interface KillStreakModalProps {
  open: boolean;
  goalTitle: string;
  onForgive: () => void;
  onBacklog: () => void;
  onTrackFailure: () => void;
  onKillStreak: () => void;
  onStartAgain: () => void;
  onFalseAccusation: () => void;
}

export function KillStreakModal({
  open,
  goalTitle,
  onForgive,
  onBacklog,
  onTrackFailure,
  onKillStreak,
  onStartAgain,
  onFalseAccusation,
}: KillStreakModalProps) {
  const actions = [
    { label: "Forgive", sub: "No penalty, keep going", onClick: onForgive, variant: "secondary" as const },
    { label: "Backlog", sub: "Add to debt counter", onClick: onBacklog, variant: "secondary" as const },
    { label: "Track Failure", sub: "Mark as red on bar", onClick: onTrackFailure, variant: "secondary" as const },
    { label: "Kill Streak", sub: "End the streak", onClick: onKillStreak, variant: "destructive" as const },
    { label: "Start Again", sub: "Reset to zero, keep goal", onClick: onStartAgain, variant: "secondary" as const },
    { label: "I actually did it", sub: "False accusation — log it done", onClick: onFalseAccusation, variant: "primary" as const },
  ];

  return (
    <Modal
      open={open}
      onClose={onForgive}
      title={`Your "${goalTitle}" streak ended.`}
      description="What would you like to do?"
    >
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={cn(
              "flex flex-col items-start rounded-2xl border px-3 py-2.5 text-left transition",
              action.variant === "primary"
                ? "border-brand/40 bg-brand-soft/60 hover:bg-brand-soft"
                : action.variant === "destructive"
                  ? "border-destructive-line bg-destructive-soft hover:bg-destructive-soft/80"
                  : "border-line bg-surface hover:bg-surface-muted",
            )}
          >
            <span className={cn(
              "text-sm font-semibold",
              action.variant === "primary" ? "text-brand" :
              action.variant === "destructive" ? "text-destructive" : "text-text",
            )}>
              {action.label}
            </span>
            <span className="mt-0.5 text-xs text-text-subtle">{action.sub}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
