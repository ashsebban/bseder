import { db, withPrismaReconnectRetry } from "@/lib/db";

function nowStamp() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findActiveUserById(id: string) {
  return withPrismaReconnectRetry(() =>
    db.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    }),
  );
}

export async function findActiveUserByEmail(email: string) {
  return withPrismaReconnectRetry(() =>
    db.user.findFirst({
      where: {
        email: normalizeEmail(email),
        deletedAt: null,
      },
    }),
  );
}

function buildDeletedPlaceholderEmail(userId: string) {
  return `deleted+${userId}+${nowStamp()}@deleted.local`;
}

export async function tombstoneDeletedUser(userId: string) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    const tombstoneEmail = buildDeletedPlaceholderEmail(user.id);

    await tx.verificationToken.deleteMany({
      where: { identifier: user.email },
    });
    await tx.account.deleteMany({ where: { userId: user.id } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.userPreferences.deleteMany({ where: { userId: user.id } });
    await tx.adminEvent.updateMany({
      where: { userId: user.id },
      data: { userId: null, userEmail: null },
    });

    return tx.user.update({
      where: { id: user.id },
      data: {
        deletedAt: user.deletedAt ?? new Date(),
        email: tombstoneEmail,
        displayName: null,
        passwordHash: null,
        avatarUrl: null,
        subscriptionStatus: "free",
        isAdmin: false,
        onboardingComplete: false,
      },
    });
  });
}

export async function releaseDeletedEmailIfNeeded(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const existing = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing?.deletedAt) {
    await tombstoneDeletedUser(existing.id);
  }
}
