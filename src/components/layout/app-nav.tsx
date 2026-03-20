"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarOfDavid } from "@/components/ui/star-of-david";
import { cn } from "@/lib/cn";

function getCalendarHref() {
  try {
    const raw = localStorage.getItem("planner.calendar-preferences.v1");
    if (raw) {
      const prefs = JSON.parse(raw) as { defaultView?: string };
      if (prefs.defaultView) return `/planner?view=${prefs.defaultView}`;
    }
  } catch {}
  return "/planner";
}

export function AppNav() {
  const pathname = usePathname();

  const navLinks = [
    { href: getCalendarHref(), base: "/planner", label: "Calendar" },
    { href: "/goals", base: "/goals", label: "Goals" },
  ];

  return (
    <nav className="sticky top-0 z-40 border-b border-line/60 bg-surface/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1360px] items-center gap-6 px-6 py-3 md:px-8">
        <div className="flex items-center gap-2.5">
          <StarOfDavid className="h-6 w-6 text-brand" />
          <span className="text-base font-bold tracking-tight text-text">B&rsquo;Seder</span>
        </div>

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
                    : "text-text-muted hover:bg-slate-100 hover:text-text",
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex-1" />
        <Button variant="secondary" size="sm" className="gap-2">
          <User className="h-4 w-4" />
          Account
        </Button>
      </div>
    </nav>
  );
}
