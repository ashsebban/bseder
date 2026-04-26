// Prisma client singleton.
// In development, Next.js hot-reload would create a new PrismaClient on every
// file save — this pattern reuses the existing instance instead.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
