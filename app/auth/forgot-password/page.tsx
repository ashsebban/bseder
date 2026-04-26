import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { getCurrentActiveUser } from "@/lib/current-active-user";

export default async function ForgotPasswordPage() {
  const currentUser = await getCurrentActiveUser();
  if (currentUser) {
    redirect(currentUser.user.onboardingComplete ? "/planner" : "/onboarding");
  }

  return <ForgotPasswordForm />;
}
