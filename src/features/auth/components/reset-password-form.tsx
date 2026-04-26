"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetPassword } from "@/features/auth/actions/auth-actions";
import { cn } from "@/lib/cn";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token || !email) {
    return (
      <div className="rounded-3xl border border-line/60 bg-surface p-8 shadow-panel text-center">
        <p className="text-sm text-red-600">Invalid reset link. Please request a new one.</p>
        <Link href="/auth/forgot-password" className="mt-4 inline-block text-sm text-brand hover:underline">
          Request new link
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await resetPassword(email, token, password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push("/auth/sign-in?reset=1");
  }

  return (
    <div className="rounded-3xl border border-line/60 bg-surface p-8 shadow-panel">
      <h1 className="mb-1 text-2xl font-bold text-text">New password</h1>
      <p className="mb-6 text-sm text-text-muted">Choose a new password for your account.</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="New password (min. 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className={cn(inputClass, "pr-11")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <input
          type={showPassword ? "text" : "password"}
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className={inputClass}
        />

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Saving…" : "Set new password"}
        </Button>
      </form>
    </div>
  );
}

const inputClass = cn(
  "h-12 w-full rounded-2xl border px-4 text-sm text-text placeholder:text-text-subtle",
  "bg-surface outline-none transition-colors",
  "focus:border-brand focus:ring-2 focus:ring-brand/20 border-line/80",
);
