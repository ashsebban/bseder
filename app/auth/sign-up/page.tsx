import { redirect } from "next/navigation";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { getCurrentActiveUser } from "@/lib/current-active-user";

export default async function SignUpPage() {
  const currentUser = await getCurrentActiveUser();
  if (currentUser) {
    redirect(currentUser.user.onboardingComplete ? "/planner" : "/onboarding");
  }

  return <SignUpForm />;
}
