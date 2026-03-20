"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, description, children }: ModalProps) {
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
        <div className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-panel">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-text">{title}</h2>
              {description ? (
                <p className="mt-1 text-sm text-text-muted">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl p-1.5 text-text-muted transition hover:bg-surface-muted hover:text-text"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {children}
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
                  ? "border-red-200 bg-red-50 hover:bg-red-100"
                  : "border-line bg-surface hover:bg-surface-muted",
            )}
          >
            <span className={cn(
              "text-sm font-semibold",
              action.variant === "primary" ? "text-brand" :
              action.variant === "destructive" ? "text-red-600" : "text-text",
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
