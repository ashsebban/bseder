"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Settings, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

export function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  if (!session) return null;

  const { user } = session;
  const displayName = user.displayName ?? user.name ?? user.email;

  return (
    <div className="relative" ref={ref}>
      {/* Avatar button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        aria-label="User menu"
      >
        <Avatar
          name={displayName}
          imageUrl={user.avatarUrl ?? user.image}
          size="sm"
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-line/60 bg-surface shadow-panel">
          {/* User info header */}
          <div className="border-b border-line/60 px-4 py-3">
            <p className="truncate text-sm font-semibold text-text">{displayName}</p>
            <p className="truncate text-xs text-text-subtle">{user.email}</p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-muted hover:bg-brand-soft hover:text-brand"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>

            <button
              onClick={() => signOut({ callbackUrl: "/auth/sign-in" })}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-text-muted hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
