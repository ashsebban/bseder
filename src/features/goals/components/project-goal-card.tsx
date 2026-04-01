"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Link2, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { todayIso } from "@/lib/date";
import type { Goal, GoalCadence, Milestone } from "@/features/goals/types/goal";

// ─── Progress bar with milestone markers ─────────────────────────────────────
function ProjectProgressBar({
  current,
  target,
  milestones,
}: {
  current: number;
  target: number;
  milestones?: Milestone[];
}) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  return (
    <div className="relative h-2 w-full rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-brand transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
      {milestones?.map((m) => {
        if (!m.markerAmount || target <= 0) return null;
        const markerPct = Math.min(100, (m.markerAmount / target) * 100);
        const done = !!m.completedDate;
        return (
          <div
            key={m.id}
            title={m.label}
            className={cn(
              "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-[3px] rounded-full",
              done ? "bg-success" : "bg-slate-400",
            )}
            style={{ left: `${markerPct}%` }}
          />
        );
      })}
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────
export function ProjectGoalCard({
  goal,
  childGoal,
  onUpdateProgress,
  onUpdateMilestones,
  onSaveChildGoal,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  /** The linked recurring child goal, if one has been created */
  childGoal?: Goal;
  onUpdateProgress: (id: string, newCurrent: number) => void;
  onUpdateMilestones: (id: string, milestones: Milestone[]) => void;
  onSaveChildGoal: (child: Goal) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [addProgressOpen, setAddProgressOpen] = useState(false);
  const [progressInput, setProgressInput] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkCadence, setLinkCadence] = useState<GoalCadence>("weekly");
  const [linkAmount, setLinkAmount] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [milestonesOpen, setMilestonesOpen] = useState(false);
  const [addMilestoneLabel, setAddMilestoneLabel] = useState("");
  const [addMilestoneAmount, setAddMilestoneAmount] = useState("");

  const current = goal.current ?? 0;
  const target = goal.target ?? 0;
  const unit = goal.targetUnit ?? "";
  const pct = target > 0 ? Math.round((current / target) * 100) : 0;
  const milestones = goal.milestones ?? [];

  // ── Add progress ──────────────────────────────────────────────────────────
  function handleAddProgress() {
    const delta = parseFloat(progressInput);
    if (isNaN(delta) || delta <= 0) return;
    onUpdateProgress(goal.id, current + delta);
    setProgressInput("");
    setAddProgressOpen(false);
  }

  // ── Link child goal ───────────────────────────────────────────────────────
  function handleLinkGoal() {
    const amount = parseFloat(linkAmount);
    if (isNaN(amount) || amount <= 0) return;
    const title = linkTitle.trim() || goal.title;
    const child: Goal = {
      id: crypto.randomUUID(),
      title,
      cadence: linkCadence,
      status: "ongoing",
      type: "quantified",
      target: amount,
      targetUnit: unit || undefined,
      parentGoalId: goal.id,
    };
    onSaveChildGoal(child);
    setLinkOpen(false);
    setLinkAmount("");
    setLinkTitle("");
  }

  // ── Milestones ────────────────────────────────────────────────────────────
  function toggleMilestone(m: Milestone) {
    const updated = milestones.map((ms) =>
      ms.id === m.id
        ? { ...ms, completedDate: ms.completedDate ? undefined : todayIso() }
        : ms,
    );
    onUpdateMilestones(goal.id, updated);
  }

  function addMilestone() {
    const label = addMilestoneLabel.trim();
    if (!label) return;
    const amount = parseFloat(addMilestoneAmount);
    const newMs: Milestone = {
      id: crypto.randomUUID(),
      label,
      markerAmount: isNaN(amount) ? undefined : amount,
    };
    onUpdateMilestones(goal.id, [...milestones, newMs]);
    setAddMilestoneLabel("");
    setAddMilestoneAmount("");
  }

  function removeMilestone(id: string) {
    onUpdateMilestones(goal.id, milestones.filter((m) => m.id !== id));
  }

  const cadenceLabels: Record<GoalCadence, string> = {
    "one-time": "One-time",
    yearly: "Yearly",
    monthly: "Monthly",
    weekly: "Weekly",
    daily: "Daily",
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight text-slate-800 truncate">{goal.title}</p>
          {goal.dueDate && (
            <p className="mt-0.5 text-[11px] text-slate-400">Due {goal.dueDate}</p>
          )}
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((s) => !s)}
            className="rounded-md p-1 text-slate-300 hover:text-slate-500 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="8" cy="13" r="1.4"/>
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-30 w-32 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onEdit(); }}
                className="w-full px-3 py-1.5 text-left text-[13px] text-slate-600 hover:bg-slate-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onDelete(); }}
                className="w-full px-3 py-1.5 text-left text-[13px] text-red-500 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <ProjectProgressBar current={current} target={target} milestones={milestones} />

      {/* Progress text */}
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-slate-500">
          {current}{unit ? ` ${unit}` : ""} / {target}{unit ? ` ${unit}` : ""}
        </span>
        <span className={cn("font-semibold", pct >= 100 ? "text-success" : "text-brand")}>
          {pct}%
        </span>
      </div>

      {/* Action buttons row */}
      <div className="flex flex-wrap gap-2">
        {/* Add progress */}
        {addProgressOpen ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              step="any"
              value={progressInput}
              onChange={(e) => setProgressInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddProgress(); if (e.key === "Escape") setAddProgressOpen(false); }}
              placeholder={`+ ${unit || "units"}`}
              autoFocus
              className="w-28 rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] text-slate-700 outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/20"
            />
            <button type="button" onClick={handleAddProgress} className="rounded-lg bg-brand px-2.5 py-1 text-[12px] font-semibold text-white">
              Add
            </button>
            <button type="button" onClick={() => setAddProgressOpen(false)} className="rounded-lg p-1 text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddProgressOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:border-brand/40 hover:text-brand transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add progress
          </button>
        )}

        {/* Link / show child goal */}
        {childGoal ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
            <Link2 className="h-3.5 w-3.5 text-brand/60" />
            <span className="text-[12px] text-slate-600">
              {childGoal.target} {childGoal.targetUnit ?? ""}/{cadenceLabels[childGoal.cadence].toLowerCase()}
            </span>
          </div>
        ) : linkOpen ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-brand/20 bg-brand/[0.04] p-2.5 w-full">
            <div className="flex gap-1">
              {(["daily", "weekly", "monthly"] as GoalCadence[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setLinkCadence(c)}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                    linkCadence === c ? "bg-brand text-white" : "bg-white text-slate-500 border border-slate-200 hover:border-brand/30",
                  )}
                >
                  {cadenceLabels[c]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 w-full">
              <input
                type="text"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleLinkGoal(); }}
                placeholder={goal.title}
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/20"
              />
              <input
                type="number"
                min="1"
                step="any"
                value={linkAmount}
                onChange={(e) => setLinkAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleLinkGoal(); }}
                placeholder={`Amount${unit ? ` (${unit})` : ""}`}
                className="w-24 rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/20"
              />
              <button type="button" onClick={handleLinkGoal} className="rounded-lg bg-brand px-2.5 py-1 text-[12px] font-semibold text-white">
                Create
              </button>
              <button type="button" onClick={() => setLinkOpen(false)} className="rounded-lg p-1 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLinkOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:border-brand/40 hover:text-brand transition-colors"
          >
            <Link2 className="h-3.5 w-3.5" />
            Link recurring goal
          </button>
        )}
      </div>

      {/* Milestones section */}
      <div>
        <button
          type="button"
          onClick={() => setMilestonesOpen((s) => !s)}
          className="flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
        >
          {milestonesOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Milestones
          {milestones.length > 0 && (
            <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0 text-[11px] text-slate-500">{milestones.length}</span>
          )}
        </button>

        {milestonesOpen && (
          <div className="mt-2 space-y-1.5">
            {milestones.map((m) => (
              <div key={m.id} className="group flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleMilestone(m)}
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
                    m.completedDate
                      ? "border-success bg-success"
                      : "border-slate-300 bg-white hover:border-brand/50",
                  )}
                >
                  {m.completedDate && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                </button>
                <span className={cn("flex-1 text-[12px]", m.completedDate ? "text-slate-400 line-through" : "text-slate-600")}>
                  {m.label}
                  {m.markerAmount && (
                    <span className="ml-1.5 text-[10px] text-slate-400">({m.markerAmount} {unit})</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => removeMilestone(m.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3 text-slate-300 hover:text-red-400" />
                </button>
              </div>
            ))}

            {/* Add milestone row */}
            <div className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                value={addMilestoneLabel}
                onChange={(e) => setAddMilestoneLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addMilestone(); }}
                placeholder="Milestone label…"
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/20"
              />
              <input
                type="number"
                min="0"
                step="any"
                value={addMilestoneAmount}
                onChange={(e) => setAddMilestoneAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addMilestone(); }}
                placeholder={unit || "amount"}
                className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/20"
              />
              <button
                type="button"
                onClick={addMilestone}
                className="rounded-lg bg-slate-100 p-1.5 text-slate-500 hover:bg-brand/10 hover:text-brand transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
