import { Suspense } from "react";
import { PageShell, PageContainer } from "@/components/ui/page-shell";
import { AppNav } from "@/components/layout/app-nav";
import { CalendarWorkspace } from "@/features/calendar/components/calendar-workspace";

export default function PlannerPage() {
  return (
    <PageShell>
      <AppNav />
      <PageContainer className="space-y-8">
        <Suspense fallback={null}>
          <CalendarWorkspace />
        </Suspense>
      </PageContainer>
    </PageShell>
  );
}
