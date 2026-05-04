"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SegmentedTabs } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { updateProfile, changePassword, deleteAccount } from "@/features/settings/actions/settings-actions";
import { CalendarPreferencesEditor } from "@/features/settings/components/calendar-preferences-editor";
import { MyJudaismEditor } from "@/features/settings/components/my-judaism-editor";
import { GoalsPreferencesEditor } from "@/features/settings/components/goals-preferences-editor";
import { useSyncedCalendarPreferences } from "@/features/settings/hooks/use-synced-calendar-preferences";
import { cn } from "@/lib/cn";
import type { CalendarPreferences } from "@/features/settings/types/calendar-preferences";
import { clearScopedPlannerStorage } from "@/lib/user-scoped-browser-storage";

const TABS = ["Account", "My Judaism", "Calendar", "Goals", "Security", "Other"] as const;
type Tab = (typeof TABS)[number];

interface Props {
  user: {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    subscriptionStatus: string;
  };
  initialCalendarPreferences: Partial<CalendarPreferences>;
  hasGoogleAccount: boolean;
  hasPassword: boolean;
  storageScope: string;
  initialTab?: string;
}

export function SettingsClient({
  user,
  initialCalendarPreferences,
  hasGoogleAccount,
  hasPassword,
  storageScope,
  initialTab,
}: Props) {
  const [tab, setTab] = useState<Tab>(
    TABS.find((t) => t === initialTab) ?? "Account",
  );

  const { preferences, updatePreference, resetPreferences, saveState } = useSyncedCalendarPreferences(
    initialCalendarPreferences,
    storageScope,
  );

  return (
    <div className="space-y-6">
      <SegmentedTabs
        value={tab}
        onValueChange={(t) => setTab(t as Tab)}
        options={TABS.map((t) => ({ label: t, value: t }))}
      />

      {tab === "Account" && <AccountTab user={user} storageScope={storageScope} />}
      {tab === "My Judaism" && (
        <Card className="max-w-2xl border-line/70 p-5 shadow-soft">
          <div className="flex items-center justify-between border-b border-line/60 pb-2">
            <div>
              <h3 className="text-sm font-bold text-text">My Judaism</h3>
              <p className="mt-0.5 text-[11px] text-text-subtle">
                Your tradition and observance level. Used for halachic defaults.
              </p>
            </div>
            <SaveStateLabel saveState={saveState} />
          </div>
          <MyJudaismEditor preferences={preferences} onPreferenceChange={updatePreference} />
        </Card>
      )}
      {tab === "Calendar" && (
        <Card className="max-w-2xl border-line/70 p-5 shadow-soft">
          <CalendarPreferencesEditor
            preferences={preferences}
            onPreferenceChange={updatePreference}
            onReset={resetPreferences}
            saveState={saveState}
            variant="page"
            subtitle="Display preferences for your calendar."
          />
        </Card>
      )}
      {tab === "Goals" && (
        <Card className="max-w-2xl border-line/70 p-5 shadow-soft">
          <div className="flex items-center justify-between border-b border-line/60 pb-2">
            <div>
              <h3 className="text-sm font-bold text-text">Goals Settings</h3>
              <p className="mt-0.5 text-[11px] text-text-subtle">
                How goals and date ranges are displayed.
              </p>
            </div>
            <SaveStateLabel saveState={saveState} />
          </div>
          <GoalsPreferencesEditor preferences={preferences} onPreferenceChange={updatePreference} />
        </Card>
      )}
      {tab === "Security" && (
        <SecurityTab userEmail={user.email} hasGoogleAccount={hasGoogleAccount} hasPassword={hasPassword} />
      )}
      {tab === "Other" && (
        <Card className="max-w-2xl border-line/70 p-5 shadow-soft">
          <p className="py-6 text-center text-sm text-text-subtle">More settings coming soon.</p>
        </Card>
      )}
    </div>
  );
}

// ─── Account Tab (merged Profile + Account) ───────────────────────────────────
function AccountTab({ user, storageScope }: { user: Props["user"]; storageScope: string }) {
  const { update } = useSession();
  const [name, setName] = useState(user.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveProfile() {
    setSaving(true);
    setProfileError(null);
    setSuccess(false);
    const result = await updateProfile(name);
    if (result.error) {
      setProfileError(result.error);
    } else {
      setSuccess(true);
      await update({ displayName: name });
    }
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteAccount();
    if (result.error) {
      setDeleting(false);
      return;
    }
    clearScopedPlannerStorage(storageScope);
    await signOut({ callbackUrl: "/auth/sign-in" });
  }

  return (
    <div className="max-w-md space-y-6">
      {/* Profile */}
      <Card className="border-line/60 p-5">
        <h3 className="mb-4 text-sm font-semibold text-text">Profile</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar name={name || user.email} imageUrl={user.avatarUrl} size="lg" />
            <div>
              <p className="text-sm font-medium text-text">{name || user.email}</p>
              <p className="text-xs text-text-subtle">
                {user.avatarUrl ? "Profile photo from Google" : "Avatar uses your initials"}
              </p>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">Display name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">Email</label>
            <input value={user.email} readOnly className={cn(inputClass, "cursor-default opacity-60")} />
            <p className="mt-1 text-xs text-text-subtle">Email cannot be changed here.</p>
          </div>
          {profileError && <p className="text-sm text-red-600">{profileError}</p>}
          {success && <p className="text-sm text-success">Profile updated.</p>}
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Card>

      {/* Subscription */}
      <Card className="border-line/60 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-text">Current plan</p>
            <p className="text-xs text-text-subtle">Your subscription status</p>
          </div>
          <Badge tone={user.subscriptionStatus === "pro" ? "brand" : "neutral"}>
            {user.subscriptionStatus === "pro" ? "Pro" : "Free"}
          </Badge>
        </div>
        {user.subscriptionStatus === "free" && (
          <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => {}}>
            Upgrade to Pro (coming soon)
          </Button>
        )}
      </Card>

      {/* Danger zone */}
      <div className="rounded-2xl border border-red-200 p-5">
        <h3 className="mb-1 text-sm font-semibold text-red-700">Danger zone</h3>
        <p className="mb-4 text-xs text-text-subtle">
          Deleting your account is permanent. Your email becomes reusable, and this account&apos;s local planner data will be cleared from this browser.
        </p>
        {!confirming ? (
          <Button
            variant="secondary"
            size="sm"
            className="border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => setConfirming(true)}
          >
            Delete my account
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-red-700">Are you absolutely sure?</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Yes, delete everything"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────
function SecurityTab({
  userEmail,
  hasGoogleAccount,
  hasPassword,
}: {
  userEmail: string;
  hasGoogleAccount: boolean;
  hasPassword: boolean;
}) {
  const [passwordEnabled, setPasswordEnabled] = useState(hasPassword);
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (newPw !== confirm) { setError("Passwords don't match."); return; }
    setSaving(true);
    setError(null);
    setSuccess(null);
    const result = await changePassword(passwordEnabled ? current : "", newPw);
    if (result.error) {
      setError(result.error);
    } else {
      setPasswordEnabled(true);
      setSuccess(passwordEnabled ? "Password updated." : "Password created. You can now sign in with your email and password too.");
      setCurrent(""); setNewPw(""); setConfirm("");
    }
    setSaving(false);
  }

  const passwordStatusLabel = passwordEnabled ? "Added" : "Not added";
  const passwordIntro = hasGoogleAccount
    ? passwordEnabled
      ? "You can sign in with either Google or email/password."
      : "You currently sign in with Google. Add a password if you want email/password as a backup."
    : passwordEnabled
      ? "You currently sign in with email/password."
      : "Set a password to enable email/password sign-in.";

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-text">Sign-in methods</h3>
        <p className="mb-3 text-xs text-text-subtle">These are the ways you can access this account.</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-2xl border border-line/60 px-4 py-3">
            <div className="flex items-center gap-3">
              <GoogleIcon />
              <div>
                <p className="text-sm font-medium text-text">Google</p>
                <p className="text-xs text-text-subtle">One-click sign-in with your Google account</p>
              </div>
            </div>
            {hasGoogleAccount
              ? <Badge tone="success">Connected</Badge>
              : <Badge tone="neutral">Not connected</Badge>}
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-line/60 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-text">Email + password</p>
              <p className="text-xs text-text-subtle">{userEmail}</p>
            </div>
            <Badge tone={passwordEnabled ? "success" : "neutral"}>{passwordStatusLabel}</Badge>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-text">Password</h3>
        <p className="mb-3 rounded-xl bg-brand-soft px-4 py-2.5 text-sm text-brand">
          {passwordIntro}
        </p>
        <p className="mb-3 text-xs text-text-subtle">
          This password is for <span className="font-medium text-text">{userEmail}</span>.
          {hasGoogleAccount ? " It adds email/password as another sign-in option." : ""}
        </p>
        <div className="space-y-3">
          {passwordEnabled && (
            <input
              type={show ? "text" : "password"}
              placeholder="Current password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={inputClass}
            />
          )}
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              placeholder={passwordEnabled ? "New password" : "Create a password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className={cn(inputClass, "pr-11")}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <input
            type={show ? "text" : "password"}
            placeholder={passwordEnabled ? "Confirm new password" : "Confirm password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-2 text-sm text-success">{success}</p>}
        <Button className="mt-3" onClick={save} disabled={saving || !newPw}>
          {saving ? "Saving…" : passwordEnabled ? "Change password" : "Create password"}
        </Button>
      </div>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────
function SaveStateLabel({ saveState }: { saveState?: "idle" | "saving" | "saved" | "error" }) {
  if (saveState === "saving") return <span className="text-[11px] text-text-subtle">Saving…</span>;
  if (saveState === "saved") return <span className="text-[11px] text-success">Saved</span>;
  if (saveState === "error") return <span className="text-[11px] text-red-500">Couldn&apos;t save</span>;
  return null;
}

const inputClass = cn(
  "h-12 w-full rounded-2xl border px-4 text-sm text-text placeholder:text-text-subtle",
  "bg-surface outline-none transition-colors",
  "focus:border-brand focus:ring-2 focus:ring-brand/20 border-line/80",
);

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
