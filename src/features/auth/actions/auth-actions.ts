"use server";
// Server actions for auth operations that require direct DB access.
// Sign-in and Google OAuth are handled by NextAuth's built-in routes.

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/mail";
import {
  findActiveUserByEmail,
  normalizeEmail,
  releaseDeletedEmailIfNeeded,
} from "@/lib/active-user";

// ─── Sign Up ─────────────────────────────────────────────────────────────────
export async function signUpWithEmail(
  displayName: string,
  email: string,
  password: string,
): Promise<{ error?: string }> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password || !displayName) {
    return { error: "All fields are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  await releaseDeletedEmailIfNeeded(normalizedEmail);
  const existing = await findActiveUserByEmail(normalizedEmail);
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.user.create({
    data: {
      email: normalizedEmail,
      displayName,
      passwordHash,
      onboardingComplete: false,
    },
  });

  await db.adminEvent.create({
    data: {
      type: "signup",
      userEmail: normalizedEmail,
      details: "Email/password signup",
    },
  });

  return {};
}

// ─── Forgot Password ──────────────────────────────────────────────────────────
export async function requestPasswordReset(
  email: string,
): Promise<{ error?: string }> {
  // Always return success even if email not found — prevents email enumeration
  const normalizedEmail = normalizeEmail(email);
  const user = await findActiveUserByEmail(normalizedEmail);
  if (!user) return {};

  // Delete any existing token for this email first
  await db.verificationToken.deleteMany({ where: { identifier: normalizedEmail } });

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.verificationToken.create({
    data: { identifier: normalizedEmail, token, expires },
  });

  const resetUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/auth/reset-password?token=${token}&email=${encodeURIComponent(normalizedEmail)}`;
  await sendPasswordResetEmail(normalizedEmail, resetUrl);

  await db.adminEvent.create({
    data: { type: "password-reset", userEmail: normalizedEmail, details: "Reset email sent" },
  });

  return {};
}

// ─── Reset Password ───────────────────────────────────────────────────────────
export async function resetPassword(
  email: string,
  token: string,
  newPassword: string,
): Promise<{ error?: string }> {
  const normalizedEmail = normalizeEmail(email);
  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const record = await db.verificationToken.findFirst({
    where: { identifier: normalizedEmail, token },
  });

  if (!record) return { error: "Invalid or expired reset link." };
  if (record.expires < new Date()) {
    await db.verificationToken.delete({ where: { token } });
    return { error: "This reset link has expired. Please request a new one." };
  }

  const user = await findActiveUserByEmail(normalizedEmail);
  if (!user) {
    await db.verificationToken.delete({ where: { token } });
    return { error: "Invalid or expired reset link." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });
  await db.verificationToken.delete({ where: { token } });

  return {};
}
