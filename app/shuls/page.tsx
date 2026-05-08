import { redirect } from "next/navigation";
import { PageShell, PageContainer } from "@/components/ui/page-shell";
import { AppNav } from "@/components/layout/app-nav";
import { ShulsWorkspace } from "@/features/shuls/components/shuls-workspace";
import { ToastProvider } from "@/features/shuls/components/toast-stack";
import { getCurrentActiveUser } from "@/lib/current-active-user";

export default async function ShulsPage() {
  const currentUser = await getCurrentActiveUser();
  if (!currentUser) redirect("/auth/sign-in");

  return (
    <PageShell>
      <AppNav />
      <PageContainer className="space-y-6 pb-16">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Shuls</h1>
          <p className="mt-1 text-sm text-slate-500">
            Find your next minyan, nearby or wherever the day takes you.
          </p>
        </div>
        <ToastProvider>
          <ShulsWorkspace storageScope={currentUser.user.id} />
        </ToastProvider>
      </PageContainer>
    </PageShell>
  );
}
