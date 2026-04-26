import { redirect } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";
import { getCurrentActiveUser } from "@/lib/current-active-user";

export default async function OnboardingPage() {
  const currentUser = await getCurrentActiveUser();
  if (!currentUser) redirect("/auth/sign-in");
  if (currentUser.user.onboardingComplete) redirect("/planner");

  return (
    <PageShell>
      <OnboardingWizard initialStorageScope={currentUser.user.id} />
    </PageShell>
  );
}
