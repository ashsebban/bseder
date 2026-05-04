"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowRight, BookOpen, CalendarOff, ChevronLeft, ChevronRight, Clock, Repeat, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/features/onboarding/actions/onboarding-actions";
import { CalendarLocationField } from "@/features/settings/components/calendar-location-field";
import { ValuePropositionCard } from "@/features/onboarding/components/value-proposition-card";
import { HavdalahPicker } from "@/features/onboarding/components/observance-picker";
import { FirstGoalStep } from "@/features/onboarding/components/first-goal-step";
import {
  PREBUILT_CATEGORY_ORDER,
  PREBUILT_GOALS,
  type PrebuiltCategory,
  type PrebuiltGoalDef,
} from "@/features/goals/lib/prebuilt-goals";
import {
  defaultCalendarPreferences,
  loadCalendarPreferencesFromStorage,
  saveCalendarPreferencesToStorage,
} from "@/features/settings/lib/calendar-preferences";
import { saveGoals, loadGoals } from "@/features/goals/lib/goal-store";
import { cn } from "@/lib/cn";
import type { CalendarPreferences, CustomLocation } from "@/features/settings/types/calendar-preferences";
import type { Goal } from "@/features/goals/types/goal";
import type { HavdalahOpinion } from "@/features/onboarding/lib/observance-utils";

const TOTAL_STEPS = 5;

const REFERRAL_OPTIONS = [
  "Word of mouth",
  "Reddit",
  "Instagram",
  "Twitter / X",
  "Search",
  "Other",
];

function mergeGoalsById(existingGoals: Goal[], incomingGoals: Goal[]): Goal[] {
  const incomingById = new Map(incomingGoals.map((goal) => [goal.id, goal]));
  const existingIds = new Set(existingGoals.map((goal) => goal.id));
  const merged = existingGoals.map((goal) => incomingById.get(goal.id) ?? goal);
  return [
    ...merged,
    ...incomingGoals.filter((goal) => !existingIds.has(goal.id)),
  ];
}

export function OnboardingWizard({ initialStorageScope }: { initialStorageScope?: string }) {
  const { data: session } = useSession();
  const storageScope = session?.user?.id ?? initialStorageScope;

  const [step, setStep] = useState(1);

  // Step 2
  const [displayName, setDisplayName] = useState(session?.user?.displayName ?? session?.user?.name ?? "");

  // Step 3
  const [locationKey, setLocationKey] = useState(defaultCalendarPreferences.locationKey);
  const [customLocation, setCustomLocation] = useState<CustomLocation | undefined>(undefined);
  const [havdalahOpinion, setHavdalahOpinion] = useState<HavdalahOpinion>("tzeit-8_5");

  // Step 4
  const [selectedGoals, setSelectedGoals] = useState<Goal[]>([]);
  const [showGoalReview, setShowGoalReview] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateTopicIndex, setTemplateTopicIndex] = useState(0);
  const [customGoalCreatorOpen, setCustomGoalCreatorOpen] = useState(false);

  // Step 5
  const [referralSource, setReferralSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addSelectedGoal(goal: Goal) {
    setSelectedGoals((current) => mergeGoalsById(current, [goal]));
    setShowGoalReview(true);
    setCustomGoalCreatorOpen(false);
  }

  function handleGoalSave(goal: Goal) {
    addSelectedGoal(goal);
  }

  function handleGoalSkip() {
    if (selectedGoals.length > 0) {
      setShowGoalReview(true);
      setCustomGoalCreatorOpen(false);
      return;
    }
    setStep(5);
  }

  function handleRemoveSelectedGoal(goalId: string) {
    setSelectedGoals((current) => current.filter((goal) => goal.id !== goalId));
  }

  function handleAddTemplateGoal(def: PrebuiltGoalDef) {
    if (!def.buildGoal) return;
    const goal = def.buildGoal(new Date());
    setSelectedGoals((current) => mergeGoalsById(current, [goal]));
  }

  function handleOpenTemplatePicker() {
    setShowGoalReview(false);
    setCustomGoalCreatorOpen(false);
    setTemplatePickerOpen(true);
    setTemplateTopicIndex(0);
  }

  async function finish() {
    setLoading(true);
    setError(null);
    try {
      const result = await completeOnboarding({
        displayName,
        locationKey,
        weekStartsOn: 0,
        timeFormat: "12h",
        havdalahOpinion,
        referralSource: referralSource ?? undefined,
      });

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      try {
        if (storageScope) {
          const existing = loadCalendarPreferencesFromStorage(storageScope) ?? {};
          saveCalendarPreferencesToStorage(storageScope, {
            ...existing,
            locationKey,
            customLocation,
            weekStartsOn: 0,
            timeFormat: "12h",
            havdalahOpinion,
          } satisfies Partial<CalendarPreferences>);
        }
      } catch {
        // Ignore localStorage failures; onboarding already succeeded.
      }

      if (selectedGoals.length > 0) {
        try {
          if (storageScope) {
            saveGoals(storageScope, mergeGoalsById(loadGoals(storageScope), selectedGoals));
          }
        } catch {
          // Ignore; goal can be added manually after onboarding.
        }
      }

      window.location.href = "/planner";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const firstName = displayName.split(" ")[0] || "there";
  const selectedGoalTitle = selectedGoals[0]?.title ?? "Untitled goal";
  const selectedGoalCountLabel = selectedGoals.length === 1 ? "1 goal" : `${selectedGoals.length} goals`;
  const goalStepTitle = showGoalReview && selectedGoals.length > 0
    ? `You're starting with ${selectedGoalCountLabel}`
    : templatePickerOpen
      ? "Choose templates"
      : customGoalCreatorOpen
        ? "Create a custom goal"
        : "Choose your first goal";
  const goalStepDescription = showGoalReview && selectedGoals.length > 0
    ? "These goals will be ready in your planner. Add more now, or keep it simple."
    : templatePickerOpen
      ? "Pick a few starter goals. You can change or remove them later."
    : customGoalCreatorOpen
      ? "Name it, choose the rhythm, and set the rules that make it yours."
      : "Start with a template, or create your own goal from scratch.";
  const onboardingTemplates = PREBUILT_GOALS.filter((def): def is PrebuiltGoalDef & { buildGoal: NonNullable<PrebuiltGoalDef["buildGoal"]> } => !!def.buildGoal);
  const templateTopics = PREBUILT_CATEGORY_ORDER
    .map((category) => ({
      category,
      goals: onboardingTemplates.filter((def) => def.category === category),
    }))
    .filter((topic) => topic.goals.length > 0);
  const templateTopicCount = Math.max(1, templateTopics.length);
  const safeTemplateTopicIndex = Math.min(templateTopicIndex, templateTopicCount - 1);
  const activeTemplateTopic = templateTopics[safeTemplateTopicIndex] ?? {
    category: "Tefila" as PrebuiltCategory,
    goals: [],
  };
  const visibleTemplates = activeTemplateTopic.goals;
  const goalsSummary =
    selectedGoals.length === 1
      ? `Goal selected: "${selectedGoalTitle}"`
      : `Goals selected: ${selectedGoals.length}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Progress dots */}
      <div className="mb-8 flex gap-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              i + 1 === step ? "w-6 bg-brand" : i + 1 < step ? "w-2 bg-brand/40" : "w-2 bg-line",
            )}
          />
        ))}
      </div>

      <div className="w-full max-w-lg">

        {/* ── Step 1: Value Proposition ── */}
        {step === 1 && (
          <StepCard>
            <h2 className="mb-1 text-2xl font-bold text-text">Plan your week around Jewish time</h2>
            <p className="mb-4 text-sm leading-relaxed text-text-subtle">
              B&apos;Seder brings goals, zmanim, Shabbos, and Yom Tov into one planner.
            </p>

            <ValuePropositionCard />

            <ul className="mt-5 space-y-3">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <CalendarOff className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text">Skip days that shouldn&apos;t count</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-text-subtle">
                    Set Shabbos, Yom Tov, and holiday exceptions once.
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Clock className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text">See time-sensitive mitzvot in context</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-text-subtle">
                    Candle lighting, Havdalah, and zmanim sit next to your day.
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Repeat className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-text">Build rhythms that fit your life</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-text-subtle">
                    Learning, davening, health, chesed, and custom goals in one planner.
                  </span>
                </span>
              </li>
            </ul>

            <Button className="mt-6 w-full gap-2" onClick={() => setStep(2)}>
              Set up my planner
              <ArrowRight className="h-4 w-4" />
            </Button>
          </StepCard>
        )}

        {/* ── Step 2: Display Name ── */}
        {step === 2 && (
          <StepCard>
            <h2 className="mb-1 text-2xl font-bold text-text">What should we call you?</h2>
            <p className="mb-6 text-sm text-text-subtle">This appears in the nav and on your profile.</p>
            <input
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && displayName.trim()) setStep(3); }}
              className={inputClass}
              autoFocus
            />
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" onClick={() => setStep(3)} disabled={!displayName.trim()}>Next →</Button>
            </div>
          </StepCard>
        )}

        {/* ── Step 3: Location + Havdalah ── */}
        {step === 3 && (
          <StepCard>
            <h2 className="mb-1 text-2xl font-bold text-text">Your Jewish rhythm</h2>
            <p className="mb-6 text-sm text-text-subtle">
              Used for zmanim (candle lighting, Havdalah) and to set smart defaults for your goals.
            </p>

            <div className="space-y-6">
              <CalendarLocationField
                label="Where are you located?"
                value={{ locationKey, customLocation }}
                onChange={(next) => {
                  setLocationKey(next.locationKey);
                  setCustomLocation(next.customLocation);
                }}
              />
              <HavdalahPicker value={havdalahOpinion} onChange={setHavdalahOpinion} />
            </div>

            <p className="mt-4 text-xs text-text-subtle">You can change all of this anytime in Settings.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>Back</Button>
              <Button className="flex-1" onClick={() => setStep(4)}>Next →</Button>
            </div>
          </StepCard>
        )}

        {/* ── Step 4: First Goal ── */}
        {step === 4 && (
          <StepCard>
            <h2 className="mb-1 text-2xl font-bold text-text">{goalStepTitle}</h2>
            <p className="mb-4 text-sm leading-relaxed text-text-subtle">
              {goalStepDescription}
            </p>

            {showGoalReview ? (
              <div className="space-y-5">
                {selectedGoals.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-text">Selected goals</p>
                      <span className="rounded-full bg-brand-soft px-2 py-1 text-xs font-semibold text-brand">
                        {selectedGoalCountLabel}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {selectedGoals.map((goal) => (
                        <div
                          key={goal.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-line/70 bg-canvas px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-text">{goal.title}</p>
                            <p className="mt-0.5 text-xs capitalize text-text-subtle">
                              {goal.cadence.replace("-", " ")} · {goal.type === "quantified" ? "count progress" : "done / not done"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSelectedGoal(goal.id)}
                            aria-label={`Remove ${goal.title}`}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-subtle transition hover:bg-surface-muted hover:text-text"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="rounded-2xl border border-line/60 bg-canvas px-4 py-3 text-sm text-text-subtle">
                    No goals selected yet.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowGoalReview(false);
                      setCustomGoalCreatorOpen(true);
                    }}
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    Add custom goal
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleOpenTemplatePicker}
                    className="gap-1.5"
                  >
                    <BookOpen className="h-4 w-4" />
                    Browse templates
                  </Button>
                </div>
                <Button className="w-full gap-2" onClick={() => setStep(5)}>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : templatePickerOpen ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line/60 bg-canvas px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-text">{activeTemplateTopic.category}</p>
                    <p className="mt-0.5 text-xs text-text-subtle">
                      {visibleTemplates.length} {visibleTemplates.length === 1 ? "template" : "templates"}
                    </p>
                  </div>
                  {selectedGoals.length > 0 ? (
                    <p className="rounded-full bg-brand-soft px-2 py-1 text-xs font-semibold text-brand">
                      {selectedGoalCountLabel} selected
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  {visibleTemplates.map((def) => {
                    const activeGoal = selectedGoals.find((goal) => goal.id === def.id);
                    const active = !!activeGoal;
                    return (
                      <div
                        key={def.id}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition",
                          active
                            ? "border-brand/35 bg-brand-soft/35"
                            : "border-line/70 bg-canvas",
                        )}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-soft">
                          {def.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-text">{def.name}</p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-text-subtle">{def.tagline}</p>
                        </div>
                        {active ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveSelectedGoal(def.id)}
                            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand transition hover:bg-white"
                          >
                            Added
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddTemplateGoal(def)}
                            className="shrink-0 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:border-brand/30 hover:text-brand"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-line/60 bg-canvas px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setTemplateTopicIndex((index) => Math.max(0, index - 1))}
                    disabled={safeTemplateTopicIndex === 0}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous topic
                  </button>
                  <p className="text-center text-xs font-semibold text-text-subtle">
                    {safeTemplateTopicIndex + 1} of {templateTopicCount}
                  </p>
                  <button
                    type="button"
                    onClick={() => setTemplateTopicIndex((index) => Math.min(templateTopicCount - 1, index + 1))}
                    disabled={safeTemplateTopicIndex >= templateTopicCount - 1}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-text-muted transition hover:bg-surface-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Next topic
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTemplatePickerOpen(false);
                      setCustomGoalCreatorOpen(true);
                    }}
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    Create custom instead
                  </Button>
                  {selectedGoals.length > 0 ? (
                    <p className="text-sm font-semibold text-brand">{selectedGoalCountLabel} selected</p>
                  ) : null}
                </div>

                <Button
                  className="w-full gap-2"
                  disabled={selectedGoals.length === 0}
                  onClick={() => {
                    setTemplatePickerOpen(false);
                    setShowGoalReview(true);
                  }}
                >
                  Review selected goals
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : customGoalCreatorOpen ? (
              <FirstGoalStep onSave={handleGoalSave} onSkip={handleGoalSkip} />
            ) : (
              <>
                <div className="mb-5 space-y-3">
                  <p className="text-sm font-semibold text-text">Start with</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleOpenTemplatePicker}
                      className="group flex items-start gap-3 rounded-2xl border border-line/70 bg-surface px-3.5 py-3 text-left transition hover:border-brand/35 hover:bg-brand-soft/25"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand transition group-hover:bg-white">
                        <BookOpen className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-text">Template</span>
                        <span className="mt-0.5 block text-xs leading-snug text-text-subtle">
                          Pick Tefillin, Daf Yomi, davening, and more.
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCustomGoalCreatorOpen(true)}
                      className="flex items-start gap-3 rounded-2xl border border-brand/45 bg-brand-soft/35 px-3.5 py-3 text-left transition hover:border-brand/60 hover:bg-brand-soft/50"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-brand shadow-soft">
                        <Plus className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-brand">Custom</span>
                        <span className="mt-0.5 block text-xs leading-snug text-text-subtle">
                          Name it yourself and choose the rhythm.
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGoalSkip}
                  className="mt-3 block w-full text-center text-sm font-medium text-text-subtle transition hover:text-text"
                >
                  Skip goal setup
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                if (templatePickerOpen) {
                  setTemplatePickerOpen(false);
                  return;
                }
                if (customGoalCreatorOpen) {
                  setCustomGoalCreatorOpen(false);
                  return;
                }
                setStep(3);
              }}
              className="mt-3 inline-flex items-center gap-1 text-sm text-text-subtle transition hover:text-text"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          </StepCard>
        )}

        {/* ── Step 5: Confirmation + Referral ── */}
        {step === 5 && (
          <StepCard>
            <div className="mb-3 text-4xl">🎉</div>
            <h2 className="mb-2 text-2xl font-bold text-text">You&apos;re set, {firstName}!</h2>

            <div className="mb-6 space-y-1.5 rounded-2xl border border-line/60 bg-canvas px-4 py-3 text-sm text-text-subtle">
              <p>📍 {customLocation?.label ?? locationKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</p>
              <p>🕯️ Havdalah at {havdalahOpinion === "tzeit-8_5" ? "tzeit (8.5°)" : `${havdalahOpinion} min after shekia`}</p>
              {selectedGoals.length > 0 ? (
                <p>🎯 {goalsSummary}</p>
              ) : (
                <p className="text-text-subtle/60">No goal added yet — add one from the planner.</p>
              )}
            </div>

            <div className="mb-6">
              <p className="mb-2 text-sm font-medium text-text">How did you hear about B&apos;Seder? <span className="font-normal text-text-subtle">(optional)</span></p>
              <div className="flex flex-wrap gap-2">
                {REFERRAL_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setReferralSource(referralSource === opt ? null : opt)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      referralSource === opt
                        ? "border-brand bg-brand/5 text-brand"
                        : "border-line/60 bg-surface text-text-subtle hover:text-text",
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
            )}

            <Button className="w-full" onClick={finish} disabled={loading}>
              {loading ? "Saving…" : "Go to my planner →"}
            </Button>

            <button
              type="button"
              onClick={() => setStep(4)}
              className="mt-3 block text-sm text-text-subtle underline-offset-2 hover:text-text hover:underline"
            >
              ← Back
            </button>
          </StepCard>
        )}
      </div>
    </div>
  );
}

function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-line/60 bg-surface p-8 shadow-panel">
      {children}
    </div>
  );
}

const inputClass = cn(
  "h-12 w-full rounded-2xl border px-4 text-sm text-text placeholder:text-text-subtle",
  "bg-surface outline-none transition-colors",
  "focus:border-brand focus:ring-2 focus:ring-brand/20 border-line/80",
);
