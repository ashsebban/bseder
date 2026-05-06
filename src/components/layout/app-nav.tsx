"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { BesederLogo } from "@/components/ui/beseder-logo";
import { UserMenu } from "@/components/layout/user-menu";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";
import {
  loadCalendarPreferencesFromStorage,
} from "@/features/settings/lib/calendar-preferences";

export function AppNav({ maxWidthClassName = "max-w-[1360px]" }: { maxWidthClassName?: string } = {}) {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Start with SSR-safe href, hydrate from localStorage after mount
  const [calendarHref, setCalendarHref] = useState("/planner");
  useEffect(() => {
    if (!session?.user?.id) {
      setCalendarHref("/planner");
      return;
    }
    try {
      const prefs = loadCalendarPreferencesFromStorage(session.user.id);
      if (prefs?.defaultView) {
        setCalendarHref(`/planner?view=${prefs.defaultView}`);
        return;
      }
    } catch {
      // Ignore local preference parsing failures.
    }
    setCalendarHref("/planner");
  }, [session?.user?.id]);

  const navLinks = [
    { href: calendarHref, base: "/planner", label: "Calendar" },
    { href: "/goals", base: "/goals", label: "Goals" },
    // Admin link — only rendered for admin users
    ...(session?.user?.isAdmin ? [{ href: "/admin", base: "/admin", label: "Admin" }] : []),
  ];

  return (
    <nav className="sticky top-0 z-40 border-b border-line/60 bg-surface/90 backdrop-blur-sm">
      <div className={cn("mx-auto flex items-center gap-6 px-6 py-3 md:px-8", maxWidthClassName)}>
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <BesederLogo className="h-7 w-7" />
          <span className="text-base font-bold tracking-tight text-text">{siteConfig.name}</span>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navLinks.map(({ href, base, label }) => {
            const active = pathname === base || pathname.startsWith(base + "/");
            return (
              <Link
                key={base}
                href={href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand/10 text-brand"
                    : "text-text-muted hover:bg-surface-muted hover:text-text",
                  // Admin link gets a subtle amber tint when active
                  base === "/admin" && active && "bg-amber-50 text-amber-700",
                  base === "/admin" && !active && "hover:bg-amber-50 hover:text-amber-700",
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* User avatar + dropdown */}
        <UserMenu />
      </div>
    </nav>
  );
}
