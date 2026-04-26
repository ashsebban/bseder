"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/planner";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show error from URL param (e.g. ?error=CredentialsSignin after failed attempt)
  const urlError = searchParams.get("error");
  const displayError = error ?? (urlError === "CredentialsSignin" ? "Incorrect email or password." : null);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false,
    });

    if (res?.error) {
      setError("Incorrect email or password.");
      setLoading(false);
      return;
    }

    window.location.href = res?.url ?? callbackUrl;
  }

  return (
    <div className="rounded-3xl border border-line/60 bg-surface p-8 shadow-panel">
      <h1 className="mb-1 text-2xl font-bold text-text">Sign in</h1>
      <p className="mb-6 text-sm text-text-muted">Welcome back to B&apos;Seder.</p>

      {/* Google */}
      <Button
        variant="secondary"
        className="mb-4 w-full gap-3"
        onClick={handleGoogleSignIn}
        disabled={googleLoading}
      >
        <GoogleIcon />
        {googleLoading ? "Redirecting…" : "Continue with Google"}
      </Button>

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-line/60" />
        <span className="text-xs text-text-subtle">or</span>
        <div className="h-px flex-1 bg-line/60" />
      </div>

      {/* Email + Password */}
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
            "focus:border-brand focus:ring-2 focus:ring-brand/20",
            "border-line/80",
          )}
        />

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={cn(
              "h-12 w-full rounded-2xl border px-4 pr-11 text-sm text-text placeholder:text-text-subtle",
              "bg-surface outline-none transition-colors",
              "focus:border-brand focus:ring-2 focus:ring-brand/20",
              "border-line/80",
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex justify-end">
          <Link href="/auth/forgot-password" className="text-xs text-brand hover:underline">
            Forgot password?
          </Link>
        </div>

        {displayError && (
          <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{displayError}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/auth/sign-up" className="font-medium text-brand hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
