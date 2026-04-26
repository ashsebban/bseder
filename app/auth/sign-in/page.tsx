import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { getCurrentActiveUser } from "@/lib/current-active-user";

export default async function SignInPage() {
  const currentUser = await getCurrentActiveUser();
  if (currentUser) {
    redirect(currentUser.user.onboardingComplete ? "/planner" : "/onboarding");
  }

  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
