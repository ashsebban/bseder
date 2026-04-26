import { auth } from "@/lib/auth";
import { findActiveUserById } from "@/lib/active-user";

export async function getCurrentActiveUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await findActiveUserById(session.user.id);
  if (!user) return null;
  return { session, user };
}
