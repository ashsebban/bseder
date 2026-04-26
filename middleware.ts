// Route protection middleware.
// Runs on every request before the page renders.
//
// Rules:
//   /auth/*           → public (sign-in, sign-up, forgot-password, reset-password)
//   /onboarding       → requires auth; if onboarding already done → /planner
//   /admin/*          → requires auth + isAdmin
//   /planner, /goals, /settings → requires auth; if onboarding not done → /onboarding
//   /                 → always redirects to /planner
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export default async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const session = token
    ? {
        user: {
          id: token.id as string | undefined,
          isAdmin: Boolean(token.isAdmin),
          onboardingComplete: Boolean(token.onboardingComplete),
        },
      }
    : null;

  // Never intercept NextAuth's own API routes — they must be handled by the route handler
  if (path.startsWith("/api/auth/")) return NextResponse.next();

  // Public auth pages — redirect signed-in users away
  if (path.startsWith("/auth/")) {
    return NextResponse.next();
  }

  // All other non-auth routes require a session
  if (!session) {
    return NextResponse.redirect(
      new URL(`/auth/sign-in?callbackUrl=${encodeURIComponent(path)}`, nextUrl),
    );
  }

  // DB Visualizer — admin auto-allow; non-admin requires cookie passcode
  if (path.startsWith("/dbvis") && path !== "/dbvis/login") {
    if (session.user.isAdmin) return NextResponse.next();
    const cookie = req.cookies.get("dbvis_auth")?.value;
    if (!cookie || cookie !== process.env.DBVIS_PASSCODE) {
      return NextResponse.redirect(new URL("/dbvis/login", nextUrl));
    }
    return NextResponse.next();
  }

  // Admin routes — 404 for non-admins (don't reveal the route exists)
  if (path.startsWith("/admin")) {
    if (!session.user.isAdmin) {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  // Onboarding route — if already complete, go to planner
  if (path === "/onboarding") {
    if (session.user.onboardingComplete) {
      return NextResponse.redirect(new URL("/planner", nextUrl));
    }
    return NextResponse.next();
  }

  // Protected app routes — incomplete onboarding → go finish it
  if (!session.user.onboardingComplete && path !== "/onboarding") {
    return NextResponse.redirect(new URL("/onboarding", nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Run on page routes only — skip static files, Next.js internals, and all API routes
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/|.*\\.png$).*)"],
};
