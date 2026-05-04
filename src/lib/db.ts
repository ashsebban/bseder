// Prisma client singleton.
// In development, Next.js hot-reload would create a new PrismaClient on every
// file save — this pattern reuses the existing instance instead.
import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

function isClosedConnectionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1017") return true;
  if (!(error instanceof Error)) return false;
  return error.message.includes("Server has closed the connection");
}

export async function withPrismaReconnectRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isClosedConnectionError(error)) throw error;

    console.warn("[prisma] closed connection detected; reconnecting and retrying query once");
    await db.$disconnect().catch(() => undefined);
    await db.$connect();
    return operation();
  }
}
