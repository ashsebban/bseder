"use client";

import { useState, useMemo } from "react";
import { Check, ChevronLeft, ChevronRight, Pencil, Search, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  PREBUILT_GOALS,
  PREBUILT_CATEGORY_ORDER,
  BUNDLES,
  PREBUILT_GOAL_BY_ID,
  type PrebuiltGoalDef,
  type Bundle,
  type PackAddContext,
} from "@/features/goals/lib/prebuilt-goals";
import type { Goal } from "@/features/goals/types/goal";
import type { CalendarPreferences } from "@/features/settings/types/calendar-preferences";

interface AddGoalsModalProps {
  open: boolean;
  onClose: () => void;
  goals: Goal[];
  today: Date;
  onAddGoal: (goal: Goal) => void;
  onRemoveGoal: (goalId: string) => void;
  onEdit: (goal: Goal) => void;
  updatePreference: <K extends keyof CalendarPreferences>(key: K, value: CalendarPreferences[K]) => void;
  setGoals: (goals: Goal[]) => void;
}

type Tab = "individual" | "bundles";

export function AddGoalsModal({
  open,
  onClose,
  goals,
  today,
  onAddGoal,
  onRemoveGoal,
  onEdit,
  updatePreference,
  setGoals,
}: AddGoalsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("individual");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [search, setSearch] = useState("");

  function isActive(id: string): boolean {
    return goals.some((g) => g.id === id);
  }

  function findGoal(id: string): Goal | undefined {
    return goals.find((g) => g.id === id);
  }

  function getCtx(): PackAddContext {
    return { goals, setGoals, updatePreference, today };
  }

  function handleAdd(def: PrebuiltGoalDef) {
    if (def.buildGoal) onAddGoal(def.buildGoal(today));
    else if (def.addAction) def.addAction(getCtx());
  }

  function handleRemove(def: PrebuiltGoalDef) {
    if (def.removeAction) def.removeAction(getCtx());
    else onRemoveGoal(def.id);
  }

  function handleAddBundle(bundle: Bundle) {
    for (const id of bundle.goalIds) {
      if (isActive(id)) continue;
      const def = PREBUILT_GOAL_BY_ID.get(id);
      if (def) handleAdd(def);
    }
  }

  function handleClose() {
    setSelectedBundle(null);
    setSearch("");
    onClose();
  }

  const filteredGoals = useMemo(() => {
    let result =
      selectedCategory === "All"
        ? PREBUILT_GOALS
        : PREBUILT_GOALS.filter((g) => g.category === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.tagline.toLowerCase().includes(q),
      );
    }
    return result;
  }, [selectedCategory, search]);

  function isBundleActive(bundle: Bundle): boolean {
    return bundle.goalIds.every((id) => isActive(id));
  }

  function bundleActiveCount(bundle: Bundle): number {
    return bundle.goalIds.filter((id) => isActive(id)).length;
  }

  // Footer for bundle detail
  const bundleDefs = selectedBundle
    ? selectedBundle.goalIds
        .map((id) => PREBUILT_GOAL_BY_ID.get(id))
        .filter((d): d is PrebuiltGoalDef => d !== undefined)
    : [];
  const allBundleActive = bundleDefs.length > 0 && bundleDefs.every((d) => isActive(d.id));
  const remainingDefs = bundleDefs.filter((d) => !isActive(d.id));

  const footer = selectedBundle ? (
    allBundleActive ? (
      <p className="text-center text-sm font-semibold text-success">
        All goals in this bundle are active ✓
      </p>
    ) : (
      <Button
        variant="primary"
        className="w-full"
        onClick={() => handleAddBundle(selectedBundle)}
      >
        Add {remainingDefs.length} Remaining Goal
        {remainingDefs.length !== 1 ? "s" : ""}
      </Button>
    )
  ) : undefined;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={selectedBundle ? selectedBundle.name : "Browse Goals"}
      description={
        selectedBundle
          ? undefined
          : "Add prebuilt Jewish goals to your practice"
      }
      panelClassName="max-w-2xl w-full"
      bodyClassName="overflow-hidden p-0 flex flex-col"
      footer={footer}
    >
      {selectedBundle ? (
        /* ── Bundle detail ─────────────────────────────────────────────── */
        <>
          {/* Back nav + tagline */}
          <div className="shrink-0 border-b border-line/40 px-6 py-3">
            <button
              type="button"
              onClick={() => setSelectedBundle(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-text-muted transition hover:text-text"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              All Bundles
            </button>
            <p className="mt-1.5 text-sm text-text-muted leading-snug">
              {selectedBundle.tagline}
            </p>
          </div>

          {/* Goal list */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-2.5">
              {bundleDefs.map((def) => (
                <GoalCard
                  key={def.id}
                  def={def}
                  activeGoal={findGoal(def.id)}
                  onAdd={handleAdd}
                  onRemove={handleRemove}
                  onEdit={onEdit}
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        /* ── Main view ─────────────────────────────────────────────────── */
        <>
          {/* Underline tab bar */}
          <div className="flex shrink-0 border-b border-line/50">
            {(["individual", "bundles"] as Tab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "-mb-px flex-1 border-b-2 py-3 text-sm font-semibold transition-colors",
                  activeTab === tab
                    ? "border-brand text-brand"
                    : "border-transparent text-text-muted hover:text-text",
                )}
              >
                {tab === "individual" ? "Goals" : "Bundles"}
              </button>
            ))}
          </div>

          {/* Tab content — scrollable */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "individual" ? (
              <IndividualGoalsTab
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                search={search}
                onSearch={setSearch}
                filteredGoals={filteredGoals}
                findGoal={findGoal}
                onAdd={handleAdd}
                onRemove={handleRemove}
                onEdit={onEdit}
              />
            ) : (
              <BundlesTab
                isBundleActive={isBundleActive}
                bundleActiveCount={bundleActiveCount}
                onSelectBundle={setSelectedBundle}
                onAddBundle={handleAddBundle}
              />
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── Individual Goals tab ─────────────────────────────────────────────────────

function IndividualGoalsTab({
  selectedCategory,
  onSelectCategory,
  search,
  onSearch,
  filteredGoals,
  findGoal,
  onAdd,
  onRemove,
  onEdit,
}: {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  search: string;
  onSearch: (q: string) => void;
  filteredGoals: PrebuiltGoalDef[];
  findGoal: (id: string) => Goal | undefined;
  onAdd: (def: PrebuiltGoalDef) => void;
  onRemove: (def: PrebuiltGoalDef) => void;
  onEdit: (goal: Goal) => void;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
        <input
          type="text"
          placeholder="Search goals…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface-muted/50 py-2.5 pl-9 pr-3 text-sm text-text placeholder:text-text-subtle transition focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10"
        />
      </div>

      {/* Category pills — horizontal scroll, no wrap */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
        {["All", ...PREBUILT_CATEGORY_ORDER].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onSelectCategory(cat)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition",
              cat === selectedCategory
                ? "bg-brand text-white"
                : "bg-surface-muted text-text-muted hover:bg-surface-muted/80 hover:text-text",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Goal list */}
      {filteredGoals.length > 0 ? (
        <div className="flex flex-col gap-2">
          {filteredGoals.map((def) => (
            <GoalCard
              key={def.id}
              def={def}
              activeGoal={findGoal(def.id)}
              onAdd={onAdd}
              onRemove={onRemove}
              onEdit={onEdit}
              showCategory={selectedCategory === "All" && !search.trim()}
            />
          ))}
        </div>
      ) : (
        <div className="py-10 text-center">
          <p className="text-sm font-medium text-text-muted">No goals match your search</p>
          <button
            type="button"
            onClick={() => { onSearch(""); onSelectCategory("All"); }}
            className="mt-2 text-xs font-semibold text-brand hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Bundles tab ──────────────────────────────────────────────────────────────

function BundlesTab({
  isBundleActive,
  bundleActiveCount,
  onSelectBundle,
  onAddBundle,
}: {
  isBundleActive: (bundle: Bundle) => boolean;
  bundleActiveCount: (bundle: Bundle) => number;
  onSelectBundle: (bundle: Bundle) => void;
  onAddBundle: (bundle: Bundle) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 px-5 py-4">
      {BUNDLES.map((bundle) => {
        const allActive = isBundleActive(bundle);
        const activeCount = bundleActiveCount(bundle);
        const previewDefs = bundle.goalIds
          .slice(0, 8)
          .map((id) => PREBUILT_GOAL_BY_ID.get(id))
          .filter((d): d is PrebuiltGoalDef => d !== undefined);
        const extra = bundle.goalIds.length - 8;

        return (
          <div
            key={bundle.id}
            className="flex items-start gap-3.5 rounded-2xl border border-line/60 bg-white p-4 transition hover:border-line hover:shadow-sm"
          >
            {/* Emoji icon */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-2xl">
              {bundle.emoji}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-text">{bundle.name}</p>
                {activeCount > 0 && (
                  <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand">
                    {activeCount}/{bundle.goalIds.length}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs leading-snug text-text-muted">
                {bundle.tagline}
              </p>

              {/* Inline emoji preview */}
              <div className="mt-2.5 flex items-center gap-1">
                {previewDefs.map((def) => (
                  <span key={def.id} className="text-base leading-none" title={def.name}>
                    {def.emoji}
                  </span>
                ))}
                {extra > 0 && (
                  <span className="ml-0.5 text-[11px] font-semibold text-text-subtle">
                    +{extra}
                  </span>
                )}
              </div>
            </div>

            {/* Actions — stacked right */}
            <div className="flex shrink-0 flex-col items-end gap-2">
              {allActive ? (
                <span className="text-xs font-semibold text-success">✓ All active</span>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => onAddBundle(bundle)}
                >
                  Add all
                </Button>
              )}
              <button
                type="button"
                onClick={() => onSelectBundle(bundle)}
                className="flex items-center gap-0.5 text-xs font-semibold text-text-muted transition hover:text-brand"
              >
                View
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Goal card ────────────────────────────────────────────────────────────────

function GoalCard({
  def,
  activeGoal,
  onAdd,
  onRemove,
  onEdit,
  showCategory = false,
}: {
  def: PrebuiltGoalDef;
  activeGoal: Goal | undefined;
  onAdd: (def: PrebuiltGoalDef) => void;
  onRemove: (def: PrebuiltGoalDef) => void;
  onEdit: (goal: Goal) => void;
  showCategory?: boolean;
}) {
  const active = !!activeGoal;

  return (
    <div
      className={cn(
        "flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 transition",
        active
          ? "border-success/40 bg-success/5"
          : "border-line/60 bg-white hover:border-line hover:shadow-sm",
      )}
    >
      {/* Emoji */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-xl">
        {def.emoji}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-semibold text-text">{def.name}</p>
          {showCategory && (
            <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
              {def.category}
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-text-muted">
          {def.tagline}
        </p>
      </div>

      {/* Actions */}
      {active && activeGoal ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
            <Check className="h-3 w-3" strokeWidth={2.5} />
            Active
          </span>
          <button
            type="button"
            onClick={() => onEdit(activeGoal)}
            title="Edit goal"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-subtle transition hover:bg-surface-muted hover:text-text"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(def)}
            title="Remove goal"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-subtle transition hover:bg-red-50 hover:text-red-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={() => onAdd(def)}
        >
          Add
        </Button>
      )}
    </div>
  );
}
