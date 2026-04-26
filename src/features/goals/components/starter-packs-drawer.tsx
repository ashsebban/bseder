"use client";

import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { STARTER_PACKS, type StarterPack } from "@/features/goals/lib/packs";
import type { Goal } from "@/features/goals/types/goal";
import type { CalendarPreferences } from "@/features/settings/types/calendar-preferences";

interface StarterPacksDrawerProps {
  open: boolean;
  onClose: () => void;
  goals: Goal[];
  today: Date;
  onAddGoal: (goal: Goal) => void;
  onRemoveGoal: (goalId: string) => void;
  updatePreference: <K extends keyof CalendarPreferences>(key: K, value: CalendarPreferences[K]) => void;
  setGoals: (goals: Goal[]) => void;
}

export function StarterPacksDrawer({
  open,
  onClose,
  goals,
  today,
  onAddGoal,
  onRemoveGoal,
  updatePreference,
  setGoals,
}: StarterPacksDrawerProps) {
  function isActive(pack: StarterPack): boolean {
    return goals.some((g) => g.id === pack.activeGoalId);
  }

  function handleAdd(pack: StarterPack) {
    if (pack.buildGoal) {
      onAddGoal(pack.buildGoal(today));
    } else if (pack.addAction) {
      pack.addAction({ goals, setGoals, updatePreference, today });
    }
  }

  function handleRemove(pack: StarterPack) {
    if (pack.removeAction) {
      pack.removeAction({ goals, setGoals, updatePreference, today });
    } else {
      onRemoveGoal(pack.activeGoalId);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Starter Packs"
      subtitle="Jewish Planner"
    >
      <div className="flex flex-col gap-3">
        {STARTER_PACKS.map((pack) => {
          const active = isActive(pack);
          return (
            <div
              key={pack.activeGoalId}
              className="flex items-center gap-4 rounded-2xl border border-line bg-surface-muted/40 p-4"
            >
              {/* Emoji icon */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-2xl">
                {pack.emoji}
              </div>

              {/* Text */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">{pack.name}</p>
                <p className="mt-0.5 text-xs text-text-muted">{pack.description}</p>
              </div>

              {/* Action */}
              {active ? (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold text-brand">Active ✓</span>
                  <Button variant="ghost" size="sm" onClick={() => handleRemove(pack)}>
                    Remove
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" size="sm" className="shrink-0" onClick={() => handleAdd(pack)}>
                  Add
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}
