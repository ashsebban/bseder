"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/features/onboarding/actions/onboarding-actions";
import { CalendarLocationField } from "@/features/settings/components/calendar-location-field";
import { ValuePropositionCard } from "@/features/onboarding/components/value-proposition-card";
import { HavdalahPicker } from "@/features/onboarding/components/observance-picker";
import { FirstGoalStep } from "@/features/onboarding/components/first-goal-step";
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
  const [firstGoal, setFirstGoal] = useState<Goal | null>(null);
  const [goalStepDone, setGoalStepDone] = useState(false);

  // Step 5
  const [referralSource, setReferralSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleGoalSave(goal: Goal) {
    setFirstGoal(goal);
    setGoalStepDone(true);
    setStep(5);
  }

  function handleGoalSkip() {
    setFirstGoal(null);
    setGoalStepDone(true);
    setStep(5);
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

      if (firstGoal) {
        try {
          if (storageScope) {
            saveGoals(storageScope, [...loadGoals(storageScope), firstGoal]);
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
            <h2 className="mb-1 text-2xl font-bold text-text">Meet B&apos;Seder</h2>
            <p className="mb-5 text-sm leading-relaxed text-text-subtle">
              A planner built around the Jewish calendar — not the other way around.
            </p>

            <ValuePropositionCard />

            <ul className="mt-5 space-y-2.5">
              <li className="flex items-start gap-2.5 text-sm text-text">
                <span className="mt-0.5 text-base">🕯️</span>
                <span>Goals that automatically skip Shabbos and Yom Tov — configure exactly which ones.</span>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-text">
                <span className="mt-0.5 text-base">⏱️</span>
                <span>See candle-lighting times, Havdalah, and zmanim alongside your schedule.</span>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-text">
                <span className="mt-0.5 text-base">📖</span>
                <span>Track daily learning, davening, exercise — any rhythm you want to build.</span>
              </li>
            </ul>

            <Button className="mt-6 w-full" onClick={() => setStep(2)}>
              Get Started →
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
            <h2 className="mb-1 text-2xl font-bold text-text">Plant your first flag</h2>
            <p className="mb-4 text-sm text-text-subtle">
              Add one goal to get started — you can always add more later.
            </p>
            <FirstGoalStep onSave={handleGoalSave} onSkip={handleGoalSkip} />
            <button
              type="button"
              onClick={() => setStep(3)}
              className="mt-3 block text-sm text-text-subtle underline-offset-2 hover:text-text hover:underline"
            >
              ← Back
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
              {firstGoal ? (
                <p>🎯 First goal: &quot;{firstGoal.title}&quot;</p>
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
