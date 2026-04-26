import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentActiveUser } from "@/lib/current-active-user";
import { SchemaVisualizer } from "@/features/dbvis/components/schema-visualizer";

// Server-side double-check in case middleware is bypassed.
// Primary protection lives in middleware.ts.
export default async function DbVisPage() {
  const [cu, cookieStore] = await Promise.all([
    getCurrentActiveUser(),
    cookies(),
  ]);

  const isAdmin = cu?.user.isAdmin ?? false;
  const hasCookie = cookieStore.get("dbvis_auth")?.value === process.env.DBVIS_PASSCODE;

  if (!isAdmin && !hasCookie) {
    redirect("/dbvis/login");
  }

  return <SchemaVisualizer />;
}
