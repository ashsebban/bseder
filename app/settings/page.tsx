import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PageShell } from "@/components/ui/page-shell";
import { AppNav } from "@/components/layout/app-nav";
import { PageContainer } from "@/components/ui/page-shell";
import { SettingsClient } from "@/features/settings/components/settings-client";
import { calendarPreferencesFromUserPreferences } from "@/features/settings/lib/calendar-preference-utils";
import { getCurrentActiveUser } from "@/lib/current-active-user";

export default async function SettingsPage() {
  const currentUser = await getCurrentActiveUser();
  if (!currentUser) redirect("/auth/sign-in");

  const user = await db.user.findFirst({
    where: { id: currentUser.user.id, deletedAt: null },
    include: { preferences: true, accounts: { select: { provider: true } } },
  });

  if (!user) redirect("/auth/sign-in");

  const hasGoogleAccount = user.accounts.some((a) => a.provider === "google");
  const hasPassword = !!user.passwordHash;

  return (
    <PageShell>
      <AppNav />
      <PageContainer>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-text">Settings</h1>
          <p className="mt-1 text-text-muted">Manage your account and preferences.</p>
        </div>
        <SettingsClient
          user={{
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            subscriptionStatus: user.subscriptionStatus,
          }}
          initialCalendarPreferences={calendarPreferencesFromUserPreferences(user.preferences)}
          hasGoogleAccount={hasGoogleAccount}
          hasPassword={hasPassword}
          storageScope={user.id}
        />
      </PageContainer>
    </PageShell>
  );
}
