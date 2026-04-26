"use client";

import React, { useState } from "react";
import { Users, Activity, UserPlus, Star, Mail, Database, FileText } from "lucide-react";
import { SegmentedTabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

interface AdminStats {
  totalUsers: number;
  activeThisWeek: number;
  newThisMonth: number;
  proUsers: number;
}

interface LogEntry {
  id: string;
  type: string;
  userEmail: string | null;
  details: string | null;
  createdAt: string;
}

interface UserRow {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  subscriptionStatus: string;
  isAdmin: boolean;
  onboardingComplete: boolean;
  createdAt: string;
  lastActive: string | null;
}

interface Props {
  stats: AdminStats;
  logs: LogEntry[];
  users: UserRow[];
}

const TABS = ["Users", "Infrastructure", "Logs"] as const;
type Tab = (typeof TABS)[number];

export function AdminDashboard({ stats, logs, users }: Props) {
  const [tab, setTab] = useState<Tab>("Users");

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Users} label="Total users" value={stats.totalUsers} />
        <StatCard icon={Activity} label="Active this week" value={stats.activeThisWeek} />
        <StatCard icon={UserPlus} label="New this month" value={stats.newThisMonth} />
        <StatCard icon={Star} label="Pro subscribers" value={stats.proUsers} />
      </div>

      <SegmentedTabs
        value={tab}
        onValueChange={(t) => setTab(t as Tab)}
        options={TABS.map((t) => ({ label: t, value: t }))}
      />

      {tab === "Users" && <UsersTab users={users} />}
      {tab === "Infrastructure" && <InfraTab stats={stats} />}
      {tab === "Logs" && <LogsTab logs={logs} />}
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab({ users }: { users: UserRow[] }) {
  const [search, setSearch] = useState("");
  const filtered = users.filter(
    (u) =>
      u.email.includes(search) ||
      (u.displayName ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Search by email or name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-10 w-full max-w-sm rounded-xl border border-line/80 px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />

      <div className="overflow-hidden rounded-2xl border border-line/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line/60 bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-text-subtle">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3 hidden sm:table-cell">Joined</th>
              <th className="px-4 py-3 hidden md:table-cell">Last active</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/40">
            {filtered.map((u) => (
              <tr key={u.id} className="bg-surface hover:bg-surface-muted/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.displayName ?? u.email} imageUrl={u.avatarUrl} size="sm" />
                    <div>
                      <p className="font-medium text-text">{u.displayName ?? "—"}</p>
                      <p className="text-xs text-text-subtle">{u.email}</p>
                    </div>
                    {u.isAdmin && (
                      <Badge tone="brand">Admin</Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={u.subscriptionStatus === "pro" ? "brand" : "neutral"}>
                    {u.subscriptionStatus}
                  </Badge>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-text-muted">
                  {formatDate(u.createdAt)}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-text-muted">
                  {u.lastActive ? formatDate(u.lastActive) : "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={u.onboardingComplete ? "success" : "neutral"}>
                    {u.onboardingComplete ? "Active" : "Onboarding"}
                  </Badge>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-subtle">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Infrastructure Tab ───────────────────────────────────────────────────────
function InfraTab({ stats }: { stats: AdminStats }) {
  type InfraService = {
    icon: React.ElementType;
    name: string;
    description: string;
    current: number | null;
    limit: number | null;
    unit: string;
    note: string;
    link: string | null;
    status: "ok" | "warn" | "critical";
  };

  const services: InfraService[] = [
    {
      icon: Database,
      name: "Railway (MySQL)",
      description: "Hosted database — $5 free credit/month",
      current: null,
      limit: null,
      unit: "",
      note: "Check Railway dashboard for storage usage",
      link: "https://railway.app",
      status: "ok",
    },
    {
      icon: Mail,
      name: "Resend (Email)",
      description: "Password reset & notification emails",
      current: null,
      limit: 3000,
      unit: "emails/mo",
      note: "Check Resend dashboard for current month count",
      link: "https://resend.com",
      status: "ok",
    },
    {
      icon: Users,
      name: "NextAuth Sessions",
      description: "Active login sessions",
      current: stats.activeThisWeek,
      limit: null,
      unit: "active sessions",
      note: "No hard limit — sessions expire after 30 days",
      link: null,
      status: "ok",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((s) => (
        <div key={s.name} className="rounded-2xl border border-line/60 bg-surface p-5">
          <div className="mb-3 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <s.icon className="h-4 w-4 text-text-muted" />
              <span className="text-sm font-semibold text-text">{s.name}</span>
            </div>
            <StatusDot status={s.status} />
          </div>
          <p className="mb-2 text-xs text-text-subtle">{s.description}</p>

          {s.current !== null && (
            <p className="mb-1 text-lg font-bold text-text">
              {s.current}
              {s.limit && <span className="text-sm font-normal text-text-muted"> / {s.limit} {s.unit}</span>}
              {!s.limit && <span className="text-sm font-normal text-text-muted"> {s.unit}</span>}
            </p>
          )}
          {s.current === null && (
            <p className="mb-1 text-xs text-text-subtle italic">{s.note}</p>
          )}

          {s.link && (
            <a
              href={s.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand hover:underline"
            >
              Open dashboard →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────
function LogsTab({ logs }: { logs: LogEntry[] }) {
  const [filter, setFilter] = useState("all");
  const types = ["all", "signup", "signin", "password-reset", "error", "admin-action"];
  const filtered = filter === "all" ? logs : logs.filter((l) => l.type === filter);

  return (
    <div className="space-y-3">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === t
                ? "bg-brand text-white"
                : "border border-line/60 text-text-muted hover:bg-surface-muted",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line/60 bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-text-subtle">
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3 hidden md:table-cell">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/40">
            {filtered.map((l) => (
              <tr key={l.id} className="bg-surface hover:bg-surface-muted/50">
                <td className="px-4 py-2.5 text-xs text-text-subtle whitespace-nowrap">
                  {formatDateTime(l.createdAt)}
                </td>
                <td className="px-4 py-2.5">
                  <EventTypeBadge type={l.type} />
                </td>
                <td className="px-4 py-2.5 text-text-muted text-xs">{l.userEmail ?? "—"}</td>
                <td className="px-4 py-2.5 text-xs text-text-subtle hidden md:table-cell">
                  {l.details ?? "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-text-subtle">
                  No events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line/60 bg-surface p-5">
      <Icon className="mb-2 h-4 w-4 text-text-muted" />
      <p className="text-2xl font-bold text-text">{value.toLocaleString()}</p>
      <p className="text-xs text-text-subtle">{label}</p>
    </div>
  );
}

function StatusDot({ status }: { status: "ok" | "warn" | "critical" }) {
  return (
    <div
      className={cn(
        "h-2.5 w-2.5 rounded-full",
        status === "ok" && "bg-success",
        status === "warn" && "bg-amber-400",
        status === "critical" && "bg-red-500",
      )}
    />
  );
}

function EventTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    signup: "bg-success-soft text-success",
    signin: "bg-brand-soft text-brand",
    "password-reset": "bg-amber-50 text-amber-700",
    error: "bg-red-50 text-red-600",
    "admin-action": "bg-purple-50 text-purple-700",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", colors[type] ?? "bg-surface-muted text-text-muted")}>
      {type}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}
