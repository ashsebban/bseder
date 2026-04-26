import { getCurrentActiveUser } from "@/lib/current-active-user";
import { NextResponse } from "next/server";

export async function requireAuth() {
  const currentUser = await getCurrentActiveUser();
  if (!currentUser) throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return currentUser;
}
