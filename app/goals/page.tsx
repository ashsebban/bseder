import { redirect } from "next/navigation";
import { PageShell, PageContainer } from "@/components/ui/page-shell";
import { AppNav } from "@/components/layout/app-nav";
import { ActiveGoalsWidget } from "@/features/goals/components/active-goals-widget";
import { AtRiskWidget, CatchUpWidget } from "@/features/goals/components/catch-up-widget";
import { GoalsWorkspace } from "@/features/goals/components/goals-workspace";
import { OnTrackWidget } from "@/features/goals/components/on-track-widget";
import { ActiveStreaksWidget, BestStreakWidget } from "@/features/goals/components/streak-widgets";
import { ThisWeekWidget } from "@/features/goals/components/this-week-widget";
import { TodaysFocusWidget } from "@/features/goals/components/todays-focus-widget";
import { getCurrentActiveUser } from "@/lib/current-active-user";

function WidgetShell({ title, description, height = "h-36" }: { title: string; description: string; height?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-[13px] font-semibold text-slate-700">{title}</p>
      </div>
      <div className={`flex items-center justify-center ${height} px-5`}>
        <p className="text-center text-[11px] font-medium text-slate-300">{description}</p>
      </div>
    </div>
  );
}

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const currentUser = await getCurrentActiveUser();
  if (!currentUser) redirect("/auth/sign-in");
  const { new: initialOpenCadence } = await searchParams;

  return (
    <PageShell>
      <AppNav />
      <PageContainer className="space-y-6 pb-16">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Goals</h1>
          <p className="mt-1 text-sm text-slate-500">Track your progress, build your streaks, stay on course.</p>
        </div>

        {/* Stat bar — 4 quick-glance metrics */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ActiveGoalsWidget storageScope={currentUser.user.id} />
          <BestStreakWidget storageScope={currentUser.user.id} />
          <ThisWeekWidget storageScope={currentUser.user.id} />
          <OnTrackWidget storageScope={currentUser.user.id} />
        </div>

        {/* Main goals list — full width, stays the hero */}
        <GoalsWorkspace storageScope={currentUser.user.id} initialOpenCadence={initialOpenCadence} />

        {/* Second tier — focused operational widgets */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ActiveStreaksWidget storageScope={currentUser.user.id} />
          <TodaysFocusWidget storageScope={currentUser.user.id} />
          <CatchUpWidget storageScope={currentUser.user.id} />
          <AtRiskWidget storageScope={currentUser.user.id} />
        </div>

        {/* Third tier — 2 columns */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <WidgetShell
            title="Activity Heatmap"
            description="Calendar heatmap showing goal completion density over the past 90 days"
            height="h-44"
          />
          <WidgetShell
            title="Upcoming Milestones"
            description="Goals nearing completion targets, period resets, and notable streaks"
            height="h-44"
          />
        </div>

        {/* Full-width encouragement / insights */}
        <WidgetShell
          title="Insights & Encouragement"
          description="Weekly summary, personal bests, AI-generated chizuk based on your progress"
          height="h-32"
        />

      </PageContainer>
    </PageShell>
  );
}
