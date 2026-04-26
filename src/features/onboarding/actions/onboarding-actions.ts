"use server";

import { auth } from "@/lib/auth";
import { unstable_update } from "@/lib/auth";
import { db } from "@/lib/db";
import { findActiveUserById } from "@/lib/active-user";

export async function completeOnboarding(data: {
  displayName: string;
  locationKey: string;
  weekStartsOn: 0 | 1;
  timeFormat: "12h" | "24h";
  havdalahOpinion: "tzeit-8_5" | "42" | "50" | "72";
  referralSource?: string;
}): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not authenticated." };
  const user = await findActiveUserById(session.user.id);
  if (!user) return { error: "Account not found." };

  const userId = user.id;

  await db.user.update({
    where: { id: userId },
    data: {
      displayName: data.displayName,
      onboardingComplete: true,
      ...(data.referralSource ? { referralSource: data.referralSource } : {}),
    },
  });

  await db.userPreferences.upsert({
    where: { userId },
    create: {
      userId,
      locationKey: data.locationKey,
      weekStartsOn: data.weekStartsOn,
      timeFormat: data.timeFormat,
      havdalahOpinion: data.havdalahOpinion,
    },
    update: {
      locationKey: data.locationKey,
      weekStartsOn: data.weekStartsOn,
      timeFormat: data.timeFormat,
      havdalahOpinion: data.havdalahOpinion,
    },
  });

  await unstable_update({
    user: {
      onboardingComplete: true,
      displayName: data.displayName,
      name: data.displayName,
    },
  });

  return {};
}
