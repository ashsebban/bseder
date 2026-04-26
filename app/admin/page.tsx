import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageShell } from "@/components/ui/page-shell";
import { AppNav } from "@/components/layout/app-nav";
import { PageContainer } from "@/components/ui/page-shell";
import { AdminDashboard } from "@/features/admin/components/admin-dashboard";
import { getCurrentActiveUser } from "@/lib/current-active-user";

export default async function AdminPage() {
  const currentUser = await getCurrentActiveUser();
  if (!currentUser?.user.isAdmin) notFound();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalUsers, activeThisWeek, newThisMonth, proUsers, recentLogs, recentUsers] =
    await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.session.count({ where: { expires: { gte: sevenDaysAgo } } }),
      db.user.count({ where: { createdAt: { gte: monthStart }, deletedAt: null } }),
      db.user.count({ where: { subscriptionStatus: "pro", deletedAt: null } }),
      db.adminEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          subscriptionStatus: true,
          isAdmin: true,
          onboardingComplete: true,
          createdAt: true,
          deletedAt: true,
          sessions: {
            orderBy: { expires: "desc" },
            take: 1,
            select: { expires: true },
          },
        },
      }),
    ]);

  return (
    <PageShell>
      <AppNav />
      <PageContainer>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-text">Admin</h1>
          <p className="mt-1 text-text-muted">B&apos;Seder system overview — visible to admins only.</p>
        </div>
        <AdminDashboard
          stats={{ totalUsers, activeThisWeek, newThisMonth, proUsers }}
          logs={recentLogs.map((l) => ({
            id: l.id,
            type: l.type,
            userEmail: l.userEmail,
            details: l.details,
            createdAt: l.createdAt.toISOString(),
          }))}
          users={recentUsers.map((u) => ({
            id: u.id,
            email: u.email,
            displayName: u.displayName,
            avatarUrl: u.avatarUrl,
            subscriptionStatus: u.subscriptionStatus,
            isAdmin: u.isAdmin,
            onboardingComplete: u.onboardingComplete,
            createdAt: u.createdAt.toISOString(),
            lastActive: u.sessions[0]?.expires.toISOString() ?? null,
          }))}
        />
      </PageContainer>
    </PageShell>
  );
}
