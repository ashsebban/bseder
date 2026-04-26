import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { PageShell, PageContainer } from "@/components/ui/page-shell";
import { AppNav } from "@/components/layout/app-nav";
import { CalendarWorkspace } from "@/features/calendar/components/calendar-workspace";
import { calendarPreferencesFromUserPreferences } from "@/features/settings/lib/calendar-preference-utils";
import { getCurrentActiveUser } from "@/lib/current-active-user";

export default async function PlannerPage() {
  const currentUser = await getCurrentActiveUser();
  if (!currentUser) redirect("/auth/sign-in");

  const preferences = await db.userPreferences.findUnique({ where: { userId: currentUser.user.id } });

  return (
    <PageShell>
      <AppNav maxWidthClassName="max-w-[1560px]" />
      <PageContainer className="max-w-[1560px] space-y-8 px-4 py-6 md:px-6 md:py-8 xl:px-8">
        <Suspense fallback={null}>
          <CalendarWorkspace
            initialPreferences={calendarPreferencesFromUserPreferences(preferences)}
            storageScope={currentUser.user.id}
          />
        </Suspense>
      </PageContainer>
    </PageShell>
  );
}
