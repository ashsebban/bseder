import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { ApiRouteError, readJsonBody, withApiHandler } from "@/lib/api-route";
import { isoToUtcDate } from "@/lib/date";
import type { Goal } from "@/features/goals/types/goal";
import {
  goalToDbCreate,
  dbRecordToGoal,
  activeDayIndices,
  individualExclusionKeys,
} from "@/features/goals/lib/goal-db-transform";

// ─── What we join when loading goals ─────────────────────────────────────────
// Goals are now pure rules — no completion state here.
// Completion state lives in Assignment rows, fetched separately by the planner.
const GOAL_INCLUDE = {
  activeDays: true,
  exclusions: true,
  milestones: { where: { deletedAt: null as null } },
  assignments: { where: { completed: true, deletedAt: null as null } },
} as const;

// ─── GET /api/goals ───────────────────────────────────────────────────────────
export const GET = withApiHandler(async () => {
  const { user: currentUser } = await requireAuth();
  const userId = currentUser.id;

  const records = await db.goal.findMany({
    where: { userId, deletedAt: null },
    include: GOAL_INCLUDE,
    orderBy: { createdAt: "asc" },
  });

  const goals = records.map(dbRecordToGoal);
  return NextResponse.json({ goals });
}, { label: "api/goals GET" });

// ─── PUT /api/goals ───────────────────────────────────────────────────────────
// Full replace: syncs all of the user's goals from the client snapshot.
export const PUT = withApiHandler(async (request: Request) => {
  const { user: currentUser } = await requireAuth();
  const raw = await readJsonBody(request);

  const userId = currentUser.id;
  const goals: Goal[] | null = Array.isArray(raw)
    ? (raw as Goal[])
    : raw && typeof raw === "object" && Array.isArray((raw as { goals?: unknown }).goals)
    ? ((raw as { goals: Goal[] }).goals)
    : null;

  if (!Array.isArray(goals)) {
    throw new ApiRouteError("Invalid payload", 400);
  }

  const incomingIds = new Set(goals.map((g) => g.id));

  await db.$transaction(async (tx) => {
    // Soft-delete goals no longer in the incoming list
    await tx.goal.updateMany({
      where: { userId, deletedAt: null, id: { notIn: [...incomingIds] } },
      data: { deletedAt: new Date() },
    });

    for (const goal of goals) {
      const existing = await tx.goal.findUnique({ where: { id: goal.id } });
      const data = goalToDbCreate(goal, userId);

      if (!existing) {
        await tx.goal.create({ data });
      } else {
        // Update scalar fields only (relations handled below)
        await tx.goal.update({
          where: { id: goal.id },
          data: {
            title: data.title,
            cadence: data.cadence,
            status: data.status,
            measure: data.measure,
            source: data.source,
            presetId: data.presetId,
            dayModel: data.dayModel,
            target: data.target,
            targetUnit: data.targetUnit,
            totalTarget: data.totalTarget,
            failureMode: data.failureMode,
            carryover: data.carryover,
            noGettingAhead: data.noGettingAhead,
            startsAt: data.startsAt,
            expiresAt: data.expiresAt,
            preferredMonthDay: data.preferredMonthDay,
            lockInDays: data.lockInDays,
            startDate: data.startDate,
            endDate: data.endDate,
            dueDate: data.dueDate,
            endAfterPeriods: data.endAfterPeriods,
            programKey: data.programKey,
            deletedAt: null, // restore if previously soft-deleted
          },
        });
      }

      // ── Active days ────────────────────────────────────────────────────────
      await tx.goalActiveDay.deleteMany({ where: { goalId: goal.id } });
      const dayIndices = activeDayIndices(goal);
      if (dayIndices.length > 0) {
        await tx.goalActiveDay.createMany({
          data: dayIndices.map((dayOfWeek) => ({ goalId: goal.id, dayOfWeek })),
        });
      }

      // ── Exclusions ─────────────────────────────────────────────────────────
      await tx.goalExclusion.deleteMany({ where: { goalId: goal.id } });
      const exclusionKeys = individualExclusionKeys(goal);
      if (exclusionKeys.length > 0) {
        await tx.goalExclusion.createMany({
          data: exclusionKeys.map((holidayKey) => ({ goalId: goal.id, holidayKey })),
        });
      }

      // ── Milestones ─────────────────────────────────────────────────────────
      if (goal.milestones && goal.milestones.length > 0) {
        for (const [sortOrder, milestone] of goal.milestones.entries()) {
          const milestoneExists = await tx.goalMilestone.findUnique({
            where: { id: milestone.id },
          });
          // completedAt is an ISO datetime string on the new Milestone type
          const completedAt = milestone.completedAt
            ? new Date(milestone.completedAt)
            : null;

          if (!milestoneExists) {
            await tx.goalMilestone.create({
              data: {
                id: milestone.id,
                goalId: goal.id,
                label: milestone.label,
                markerAmount: milestone.markerAmount ?? null,
                sortOrder,
                completedAt,
              },
            });
          } else {
            await tx.goalMilestone.update({
              where: { id: milestone.id },
              data: {
                label: milestone.label,
                markerAmount: milestone.markerAmount ?? null,
                sortOrder,
                completedAt,
                deletedAt: null,
              },
            });
          }
        }
      }

      // NOTE: Completion state is no longer synced here.
      // In v1, completedDates lived on the goal and were synced to assignment rows.
      // In v2, completions are written directly by the planner via /api/assignments.
      // The assignment is the source of truth — the goal knows nothing about it.
    }
  }, { maxWait: 10_000, timeout: 20_000 });

  return NextResponse.json({ ok: true });
}, { label: "api/goals PUT" });

export const POST = PUT;
