import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { getCurrentActiveUser } from "@/lib/current-active-user";

export default async function ResetPasswordPage() {
  const currentUser = await getCurrentActiveUser();
  if (currentUser) {
    redirect(currentUser.user.onboardingComplete ? "/planner" : "/onboarding");
  }

  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
