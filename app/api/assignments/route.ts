import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { ApiRouteError, readJsonBody, withApiHandler } from "@/lib/api-route";
import { isoAndHHMMToUtcDateTime, isoToUtcDate } from "@/lib/date";
import type { Assignment } from "@/features/goals/types/goal";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE_RE.test(value);
}

function toSafeHHMM(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return HHMM_RE.test(value) ? value : null;
}

function toSafeInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

// Fetch only assignments that represent real user actions (planned, completed,
// rescheduled, etc.). Virtual "pending" assignments are computed client-side
// by getDayInstances() and never persisted.
const PERSISTED_ASSIGNMENT_WHERE: Prisma.AssignmentWhereInput = {
  OR: [
    { completed: true },
    { status: { not: "planned" } },
    { targetAmount: { not: null } },
    { scheduledTime: { not: null } },
    { durationMins: { not: null } },
    { periodKey: { not: null } },
    { occurrenceDate: { not: null } },
  ],
};

const MAX_TRANSACTION_ATTEMPTS = 4;

function isRetryableTransactionError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2028")
  ) {
    return true;
  }
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("write conflict") ||
    message.includes("deadlock") ||
    message.includes("transaction already closed") ||
    message.includes("transaction not found") ||
    message.includes("expired transaction")
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Normalise and sanitise client-side assignment payloads ───────────────────
// Strips ephemeral/invalid entries before they touch the database.
type NormalizedAssignment = {
  id: string;
  goalId: string;
  date: string;
  occurrenceDate: string | null;
  periodKey: string | null;
  targetAmount: number | null;
  scheduledTime: string | null;
  durationMins: number | null;
  completed: boolean;
  completedAt: string | null;
  status: string;
  materializedReason: string | null;
  originalDate: string | null;
  note: string | null;
};

function normalizeAssignments(assignments: unknown[]): NormalizedAssignment[] {
  const byId = new Map<string, NormalizedAssignment>();

  for (const item of assignments) {
    if (!item || typeof item !== "object") continue;
    const a = item as Partial<Assignment>;

    // Skip generated virtual assignments — they have no id or have "virtual:" prefix
    if (typeof a.id !== "string" || a.id.length === 0) continue;
    if (a.id.startsWith("virtual:") || a.id.startsWith("generated:")) continue;
    if (typeof a.goalId !== "string" || a.goalId.length === 0) continue;
    if (!isIsoDate(a.date)) continue;

    const completed = a.completed === true;

    byId.set(a.id, {
      id: a.id,
      goalId: a.goalId,
      date: a.date,
      occurrenceDate: isIsoDate(a.occurrenceDate) ? a.occurrenceDate : null,
      periodKey: typeof a.periodKey === "string" ? a.periodKey.slice(0, 20) : null,
      targetAmount: toSafeInt(a.targetAmount),
      scheduledTime: toSafeHHMM(a.scheduledTime),
      durationMins: toSafeInt(a.durationMins),
      completed,
      completedAt: completed ? toSafeHHMM(a.completedAt) : null,
      status: typeof a.status === "string" ? a.status : completed ? "completed" : "planned",
      materializedReason: typeof a.materializedReason === "string" ? a.materializedReason : null,
      originalDate: isIsoDate(a.originalDate) ? a.originalDate : null,
      note: typeof a.note === "string" ? a.note.slice(0, 1000) : null,
    });
  }

  return [...byId.values()];
}

// ─── GET /api/assignments ─────────────────────────────────────────────────────
export const GET = withApiHandler(async () => {
  const { user: currentUser } = await requireAuth();
  const userId = currentUser.id;

  const records = await db.assignment.findMany({
    where: { userId, deletedAt: null, ...PERSISTED_ASSIGNMENT_WHERE },
    orderBy: { date: "asc" },
  });

  // Map DB rows to the Assignment type. Date fields come back as Date objects.
  const assignments: Assignment[] = records.map((r) => ({
    id: r.id,
    goalId: r.goalId,
    userId: r.userId,
    date: r.date.toISOString().slice(0, 10),
    occurrenceDate: r.occurrenceDate?.toISOString().slice(0, 10),
    hebrewYear: r.hebrewYear ?? undefined,
    hebrewMonth: r.hebrewMonth ?? undefined,
    hebrewDay: r.hebrewDay ?? undefined,
    seasonalIndex: r.seasonalIndex ?? undefined,
    periodKey: r.periodKey ?? undefined,
    windowStart: r.windowStart?.toISOString(),
    windowEnd: r.windowEnd?.toISOString(),
    targetAmount: r.targetAmount ?? undefined,
    scheduledTime: r.scheduledTime ?? undefined,
    durationMins: r.durationMins ?? undefined,
    completed: r.completed,
    completedAt: r.completedAt?.toISOString(),
    actualAmount: r.actualAmount ?? undefined,
    status: r.status as Assignment["status"],
    materializedReason: r.materializedReason as Assignment["materializedReason"],
    originalDate: r.originalDate?.toISOString().slice(0, 10),
    note: r.note ?? undefined,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    deletedAt: r.deletedAt?.toISOString(),
  }));

  return NextResponse.json({ assignments });
}, { label: "api/assignments GET" });

// ─── PUT /api/assignments ─────────────────────────────────────────────────────
// Full replace: syncs all of the user's persisted assignments from client.
export const PUT = withApiHandler(async (request: Request) => {
  const { user: currentUser } = await requireAuth();
  const raw = await readJsonBody(request);

  const userId = currentUser.id;
  const rawAssignments: unknown[] | null = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { assignments?: unknown }).assignments)
    ? ((raw as { assignments: unknown[] }).assignments)
    : null;

  if (!Array.isArray(rawAssignments)) {
    throw new ApiRouteError("Invalid payload", 400);
  }

  const assignments = normalizeAssignments(rawAssignments)
    .sort((a, b) => a.id.localeCompare(b.id));
  const incomingIds = new Set(assignments.map((a) => a.id));

  const syncAssignments = () => db.$transaction(async (tx) => {
    // Soft-delete assignments no longer in the client snapshot
    await tx.assignment.updateMany({
      where: {
        userId,
        deletedAt: null,
        ...PERSISTED_ASSIGNMENT_WHERE,
        id: { notIn: [...incomingIds] },
      },
      data: { deletedAt: new Date() },
    });

    for (const a of assignments) {
      try {
        const existing = await tx.assignment.findUnique({
          where: { id: a.id },
          select: { id: true, userId: true },
        });

        if (!existing) {
          // Verify the goal exists before creating the assignment
          const goalExists = await tx.goal.findFirst({
            where: { id: a.goalId, userId, deletedAt: null },
            select: { id: true },
          });
          if (!goalExists) {
            console.warn(
              `[api/assignments PUT] skipping ${a.id}: goal ${a.goalId} not found for user ${userId}`,
            );
            continue;
          }

          await tx.assignment.create({
            data: {
              id: a.id,
              goalId: a.goalId,
              userId,
              date: isoToUtcDate(a.date),
              occurrenceDate: a.occurrenceDate ? isoToUtcDate(a.occurrenceDate) : null,
              periodKey: a.periodKey,
              targetAmount: a.targetAmount,
              scheduledTime: a.scheduledTime,
              durationMins: a.durationMins,
              completed: a.completed,
              completedAt: a.completed && a.completedAt
                ? isoAndHHMMToUtcDateTime(a.date, a.completedAt)
                : null,
              status: a.status,
              materializedReason: a.materializedReason,
              originalDate: a.originalDate ? isoToUtcDate(a.originalDate) : null,
              note: a.note,
            },
          });
        } else {
          if (existing.userId !== userId) {
            console.warn(
              `[api/assignments PUT] skipping ${a.id}: ownership mismatch for user ${userId}`,
            );
            continue;
          }

          await tx.assignment.update({
            where: { id: a.id },
            data: {
              date: isoToUtcDate(a.date),
              occurrenceDate: a.occurrenceDate ? isoToUtcDate(a.occurrenceDate) : null,
              periodKey: a.periodKey,
              targetAmount: a.targetAmount,
              scheduledTime: a.scheduledTime,
              durationMins: a.durationMins,
              completed: a.completed,
              completedAt: a.completed && a.completedAt
                ? isoAndHHMMToUtcDateTime(a.date, a.completedAt)
                : null,
              status: a.status,
              materializedReason: a.materializedReason,
              originalDate: a.originalDate ? isoToUtcDate(a.originalDate) : null,
              note: a.note,
              deletedAt: null,
            },
          });
        }
      } catch (rowErr) {
        if (isRetryableTransactionError(rowErr)) throw rowErr;
        console.warn(`[api/assignments PUT] skipping ${a.id} after DB error`, rowErr);
      }
    }
  }, { maxWait: 10_000, timeout: 20_000 });

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      await syncAssignments();
      break;
    } catch (error) {
      if (attempt === MAX_TRANSACTION_ATTEMPTS || !isRetryableTransactionError(error)) {
        throw error;
      }
      const backoffMs = 75 * attempt + Math.floor(Math.random() * 125);
      console.warn(
        `[api/assignments PUT] retrying (attempt ${attempt}/${MAX_TRANSACTION_ATTEMPTS})`,
        error,
      );
      await delay(backoffMs);
    }
  }

  return NextResponse.json({ ok: true });
}, { label: "api/assignments PUT" });

export const POST = PUT;