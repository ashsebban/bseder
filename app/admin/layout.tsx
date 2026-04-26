import { notFound } from "next/navigation";
import { getCurrentActiveUser } from "@/lib/current-active-user";

// Admin-only layout guard.
// Middleware already blocks non-admins with a 404, but this adds a server-side
// double-check in case the middleware is bypassed.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentActiveUser();
  if (!currentUser?.user.isAdmin) notFound();
  return <>{children}</>;
}
