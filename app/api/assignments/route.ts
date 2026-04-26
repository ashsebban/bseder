import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { ApiRouteError, readJsonBody, withApiHandler } from "@/lib/api-route";
import { isoAndHHMMToUtcDateTime, isoToUtcDate } from "@/lib/date";
import { isEphemeralGeneratedAssignment, type DayAssignment } from "@/features/planner/lib/day-assignment-store";
import { dbRecordToDayAssignment } from "@/features/goals/lib/goal-db-transform";

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

function isCompletionOnlyAssignment(assignment: Partial<DayAssignment>): boolean {
  return (
    assignment.completed === true &&
    assignment.targetAmount === undefined &&
    assignment.periodKey === undefined &&
    assignment.scheduledTime === undefined &&
    assignment.durationMins === undefined &&
    assignment.replacedAutoDate === undefined &&
    assignment.skipped !== true
  );
}

const PLANNER_ASSIGNMENT_WHERE: Prisma.AssignmentRecordWhereInput = {
  OR: [
    { completed: false },
    { targetAmount: { not: null } },
    { scheduledTime: { not: null } },
    { durationMins: { not: null } },
    { periodKey: { not: null } },
    { replacedAutoDate: { not: null } },
    { skipped: true },
  ],
};

const MAX_TRANSACTION_ATTEMPTS = 4;

function isRetryableTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
    return true;
  }
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("write conflict") || message.includes("deadlock");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type NormalizedPendingAssignment = {
  id: string;
  goalId: string;
  date: string;
  periodKey: string | null;
  targetAmount: number | null;
  scheduledTime: string | null;
  durationMins: number | null;
  completed: boolean;
  completedAt: string | null;
  replacedAutoDate: string | null;
  skipped: boolean;
};

function normalizePendingAssignments(assignments: unknown[]): NormalizedPendingAssignment[] {
  const byId = new Map<string, NormalizedPendingAssignment>();
  for (const item of assignments) {
    if (!item || typeof item !== "object") continue;
    const assignment = item as Partial<DayAssignment>;
    if (isEphemeralGeneratedAssignment(assignment) || isCompletionOnlyAssignment(assignment)) continue;
    if (typeof assignment.id !== "string" || assignment.id.length === 0) continue;
    if (typeof assignment.goalId !== "string" || assignment.goalId.length === 0) continue;
    if (!isIsoDate(assignment.date)) continue;

    const periodKey = typeof assignment.periodKey === "string"
      ? assignment.periodKey.slice(0, 20)
      : null;
    const targetAmount = toSafeInt(assignment.targetAmount);
    const scheduledTime = toSafeHHMM(assignment.scheduledTime);
    const durationMins = toSafeInt(assignment.durationMins);
    const completed = assignment.completed === true;
    const completedAt = completed ? toSafeHHMM(assignment.completedAt) ?? scheduledTime : null;
    const replacedAutoDate = isIsoDate(assignment.replacedAutoDate)
      ? assignment.replacedAutoDate
      : null;

    byId.set(assignment.id, {
      id: assignment.id,
      goalId: assignment.goalId,
      date: assignment.date,
      periodKey,
      targetAmount,
      scheduledTime,
      durationMins,
      completed,
      completedAt,
      replacedAutoDate,
      skipped: assignment.skipped === true,
    });
  }
  return [...byId.values()];
}

export const GET = withApiHandler(async () => {
  const { user: currentUser } = await requireAuth();
  const userId = currentUser.id;

  // Planner assignments include completed and incomplete rows, but exclude
  // pure completion-only rows that are managed via /api/goals.
  const records = await db.assignmentRecord.findMany({
    where: { userId, deletedAt: null, ...PLANNER_ASSIGNMENT_WHERE },
    orderBy: { date: "asc" },
  });

  const assignments = records.map(dbRecordToDayAssignment);
  return NextResponse.json({ assignments });
}, { label: "api/assignments GET" });

export const PUT = withApiHandler(async (request: Request) => {
  const { user: currentUser } = await requireAuth();
  const raw = await readJsonBody(request);

  const userId = currentUser.id;
  const assignments: unknown[] | null = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { assignments?: unknown }).assignments)
    ? ((raw as { assignments: unknown[] }).assignments)
    : null;

  if (!Array.isArray(assignments)) {
    throw new ApiRouteError("Invalid payload", 400);
  }

  // Sync only planner-owned assignments and sanitize stale/malformed local rows
  // before they touch the database.
  const plannerAssignments = normalizePendingAssignments(assignments)
    .sort((a, b) => a.id.localeCompare(b.id));
  const incomingIds = new Set(plannerAssignments.map((a) => a.id));

  const syncPlannerAssignments = () => db.$transaction(async (tx) => {
    // Soft-delete planner assignments no longer present in the client snapshot.
    await tx.assignmentRecord.updateMany({
      where: {
        userId,
        deletedAt: null,
        ...PLANNER_ASSIGNMENT_WHERE,
        id: { notIn: [...incomingIds] },
      },
      data: { deletedAt: new Date() },
    });

    for (const da of plannerAssignments) {
      try {
        const existing = await tx.assignmentRecord.findUnique({
          where: { id: da.id },
          select: { id: true, userId: true },
        });

        if (!existing) {
          // Verify the goal exists before creating the assignment
          const goalExists = await tx.goalRecord.findFirst({
            where: { id: da.goalId, userId, deletedAt: null },
            select: { id: true },
          });
          if (!goalExists) {
            console.warn(`[api/assignments PUT] skipping assignment ${da.id}: goal ${da.goalId} not found for user ${userId}`);
            continue;
          }

          await tx.assignmentRecord.create({
            data: {
              id: da.id,
              goalId: da.goalId,
              userId,
              date: isoToUtcDate(da.date),
              periodKey: da.periodKey,
              targetAmount: da.targetAmount,
              scheduledTime: da.scheduledTime,
              durationMins: da.durationMins,
              completed: da.completed,
              completedAt: da.completed && da.completedAt
                ? isoAndHHMMToUtcDateTime(da.date, da.completedAt)
                : null,
              replacedAutoDate: da.replacedAutoDate ? isoToUtcDate(da.replacedAutoDate) : null,
              skipped: da.skipped,
            },
          });
        } else {
          if (existing.userId !== userId) {
            console.warn(`[api/assignments PUT] skipping assignment ${da.id}: ownership mismatch for user ${userId}`);
            continue;
          }
          await tx.assignmentRecord.update({
            where: { id: da.id },
            data: {
              date: isoToUtcDate(da.date),
              periodKey: da.periodKey,
              targetAmount: da.targetAmount,
              scheduledTime: da.scheduledTime,
              durationMins: da.durationMins,
              completed: da.completed,
              completedAt: da.completed && da.completedAt
                ? isoAndHHMMToUtcDateTime(da.date, da.completedAt)
                : null,
              replacedAutoDate: da.replacedAutoDate ? isoToUtcDate(da.replacedAutoDate) : null,
              skipped: da.skipped,
              deletedAt: null,
            },
          });
        }
      } catch (rowErr) {
        console.warn(`[api/assignments PUT] skipping assignment ${da.id} after DB error`, rowErr);
      }
    }
  }, { maxWait: 10_000, timeout: 20_000 });

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      await syncPlannerAssignments();
      break;
    } catch (error) {
      if (attempt === MAX_TRANSACTION_ATTEMPTS || !isRetryableTransactionError(error)) {
        throw error;
      }
      const backoffMs = 75 * attempt + Math.floor(Math.random() * 125);
      console.warn(
        `[api/assignments PUT] retrying transient transaction conflict (attempt ${attempt}/${MAX_TRANSACTION_ATTEMPTS})`,
        error,
      );
      await delay(backoffMs);
    }
  }

  return NextResponse.json({ ok: true });
}, { label: "api/assignments PUT" });

export const POST = PUT;
