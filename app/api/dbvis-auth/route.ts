import { NextResponse } from "next/server";
import { readJsonBody, withApiHandler } from "@/lib/api-route";

export const POST = withApiHandler(async (request: Request) => {
  const { passcode } = await readJsonBody<{ passcode?: string }>(request);

  const expected = process.env.DBVIS_PASSCODE;
  if (!expected) {
    return NextResponse.json({ error: "DBVIS_PASSCODE not configured" }, { status: 500 });
  }
  if (!passcode || passcode !== expected) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("dbvis_auth", expected, {
    httpOnly: true,
    path: "/dbvis",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}, { label: "api/dbvis-auth POST" });
