"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/features/auth/actions/auth-actions";
import { cn } from "@/lib/cn";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await requestPasswordReset(email);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-3xl border border-line/60 bg-surface p-8 shadow-panel text-center">
        <div className="mb-3 text-4xl">📬</div>
        <h1 className="mb-2 text-xl font-bold text-text">Check your email</h1>
        <p className="mb-6 text-sm text-text-muted">
          We sent a password reset link to <strong>{email}</strong>.
          The link expires in 1 hour.
        </p>
        <Link href="/auth/sign-in" className="text-sm font-medium text-brand hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-line/60 bg-surface p-8 shadow-panel">
      <h1 className="mb-1 text-2xl font-bold text-text">Forgot password?</h1>
      <p className="mb-6 text-sm text-text-muted">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={cn(
            "h-12 w-full rounded-2xl border px-4 text-sm text-text placeholder:text-text-subtle",
            "bg-surface outline-none transition-colors",
            "focus:border-brand focus:ring-2 focus:ring-brand/20 border-line/80",
          )}
        />

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-text-muted">
        <Link href="/auth/sign-in" className="font-medium text-brand hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
