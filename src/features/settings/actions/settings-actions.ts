"use server";

import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { findActiveUserById, tombstoneDeletedUser } from "@/lib/active-user";

// ─── Update Profile ────────────────────────────────────────────────────────
export async function updateProfile(
  displayName: string,
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (!displayName.trim()) return { error: "Name cannot be empty." };
  const user = await findActiveUserById(session.user.id);
  if (!user) return { error: "Account not found." };

  await db.user.update({
    where: { id: user.id },
    data: { displayName: displayName.trim() },
  });
  return {};
}

// ─── Change Password ────────────────────────────────────────────────────────
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  if (newPassword.length < 8) return { error: "Password must be at least 8 characters." };

  const user = await findActiveUserById(session.user.id);
  if (!user) return { error: "Account not found." };

  if (!user.passwordHash) {
    const newHash = await bcrypt.hash(newPassword, 12);
    await db.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
    return {};
  }

  if (!currentPassword) return { error: "Enter your current password." };

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return { error: "Current password is incorrect." };

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
  return {};
}

// ─── Update Calendar Preferences ───────────────────────────────────────────
export async function updateCalendarPreferences(
  prefs: Partial<{
    locationKey: string;
    nusach: string;
    havdalahMode: string;
    observanceLevel: string;
    timeFormat: string;
    showHebrewDates: boolean;
    weekStartsOn: number;
    defaultView: string;
    showParsha: boolean;
    showRoshChodesh: boolean;
    showModernHolidays: boolean;
    showOutsideMonthDays: boolean;
    havdalahOpinion: string;
    timelineSnapMins: number;
    timelineDefaultDurationMins: number;
    showHebrewDatesOnGoals: boolean;
    hebrewDateFormat: string;
    hebrewDateIncludeYear: boolean;
  }>,
): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  const user = await findActiveUserById(session.user.id);
  if (!user) return { error: "Account not found." };

  await db.userPreferences.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...prefs },
    update: prefs,
  });
  return {};
}

// ─── Delete Account ─────────────────────────────────────────────────────────
export async function deleteAccount(): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  const user = await findActiveUserById(session.user.id);
  if (!user) return { error: "Account not found." };

  await tombstoneDeletedUser(user.id);
  return {};
}
