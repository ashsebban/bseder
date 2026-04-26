// Admin stats API — aggregates user counts, goal counts, and infrastructure usage.
// Cached for 5 minutes to avoid hammering external APIs.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentActiveUser } from "@/lib/current-active-user";
import { withApiHandler } from "@/lib/api-route";

export const GET = withApiHandler(async () => {
  const currentUser = await getCurrentActiveUser();
  if (!currentUser?.user.isAdmin) {
    return new NextResponse(null, { status: 404 });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalUsers, activeThisWeek, newThisMonth, proUsers] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.session.count({ where: { expires: { gte: sevenDaysAgo } } }),
    db.user.count({ where: { createdAt: { gte: monthStart }, deletedAt: null } }),
    db.user.count({ where: { subscriptionStatus: "pro", deletedAt: null } }),
  ]);

  // Resend usage — fetch from Resend API if key is available
  let resendEmailsThisMonth = 0;
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails?limit=100", {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        next: { revalidate: 300 }, // cache 5 minutes
      });
      if (res.ok) {
        const data = await res.json();
        // Count emails from this month
        resendEmailsThisMonth = (data.data ?? []).filter(
          (e: { created_at: string }) => new Date(e.created_at) >= monthStart,
        ).length;
      }
    } catch {
      // Silently fail — infra stats are best-effort
    }
  }

  return NextResponse.json({
    users: { total: totalUsers, activeThisWeek, newThisMonth, pro: proUsers },
    resend: { emailsThisMonth: resendEmailsThisMonth, limit: 3000 },
  });
}, { label: "api/admin/stats GET" });
