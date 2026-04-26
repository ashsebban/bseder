import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";
import { ApiRouteError, readJsonBody, withApiHandler } from "@/lib/api-route";
import { isoToUtcDate } from "@/lib/date";
import { syncSetWithSoftDelete } from "@/lib/sync-set";
import type { Goal } from "@/features/goals/types/goal";
import {
  goalToDbCreate,
  dbRecordToGoal,
  activeDayIndices,
  individualExclusionKeys,
} from "@/features/goals/lib/goal-db-transform";

const GOAL_INCLUDE = {
  activeDays: true,
  exclusions: true,
  milestones: { where: { deletedAt: null as null } },
  assignments: { where: { completed: true, deletedAt: null as null } },
} as const;

export const GET = withApiHandler(async () => {
  const { user: currentUser } = await requireAuth();
  const userId = currentUser.id;

  const records = await db.goalRecord.findMany({
    where: { userId, deletedAt: null },
    include: GOAL_INCLUDE,
    orderBy: { createdAt: "asc" },
  });

  const goals = records.map(dbRecordToGoal);
  return NextResponse.json({ goals });
}, { label: "api/goals GET" });

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
    // Soft-delete goals no longer in the list
    await tx.goalRecord.updateMany({
      where: { userId, deletedAt: null, id: { notIn: [...incomingIds] } },
      data: { deletedAt: new Date() },
    });

    for (const goal of goals) {
      const existing = await tx.goalRecord.findUnique({ where: { id: goal.id } });

      if (!existing) {
        // Create new goal row
        const data = goalToDbCreate(goal, userId);
        await tx.goalRecord.create({ data });
      } else {
        // Update scalar fields
        const data = goalToDbCreate(goal, userId);
        // Strip the nested relation connect — update only scalars
        await tx.goalRecord.update({
          where: { id: goal.id },
          data: {
            title: data.title,
            cadence: data.cadence,
            status: data.status,
            type: data.type,
            target: data.target,
            targetUnit: data.targetUnit,
            backlog: data.backlog,
            noGettingAhead: data.noGettingAhead,
            ifUnfinished: data.ifUnfinished,
            preferredMonthDay: data.preferredMonthDay,
            lockInDays: data.lockInDays,
            adhoc: data.adhoc,
            startsAt: data.startsAt,
            expiresAt: data.expiresAt,
            startDate: data.startDate,
            endDate: data.endDate,
            dueDate: data.dueDate,
            endAfterPeriods: data.endAfterPeriods,
            programKey: data.programKey,
            excludesCategories: data.excludesCategories,
            deletedAt: null, // restore if previously soft-deleted
          },
        });
      }

      // Replace active days
      await tx.goalActiveDayRecord.deleteMany({ where: { goalId: goal.id } });
      const dayIndices = activeDayIndices(goal);
      if (dayIndices.length > 0) {
        await tx.goalActiveDayRecord.createMany({
          data: dayIndices.map((dayOfWeek) => ({ goalId: goal.id, dayOfWeek })),
        });
      }

      // Replace individual exclusions
      await tx.goalExclusionRecord.deleteMany({ where: { goalId: goal.id } });
      const exclusionKeys = individualExclusionKeys(goal);
      if (exclusionKeys.length > 0) {
        await tx.goalExclusionRecord.createMany({
          data: exclusionKeys.map((holidayKey) => ({ goalId: goal.id, holidayKey })),
        });
      }

      // Sync milestones
      if (goal.milestones && goal.milestones.length > 0) {
        for (const [sortOrder, milestone] of goal.milestones.entries()) {
          const milestoneExists = await tx.goalMilestoneRecord.findUnique({
            where: { id: milestone.id },
          });
          const completedAt = milestone.completedDate
            ? new Date(`${milestone.completedDate}T00:00:00.000Z`)
            : null;

          if (!milestoneExists) {
            await tx.goalMilestoneRecord.create({
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
            await tx.goalMilestoneRecord.update({
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

      // Sync completedDates (binary daily goals only)
      if (goal.cadence === "daily" && goal.type === "binary" && Array.isArray(goal.completedDates)) {
        const existingCompleted = await tx.assignmentRecord.findMany({
          where: { goalId: goal.id, userId, completed: true, deletedAt: null },
          select: { id: true, date: true },
        });

        await syncSetWithSoftDelete({
          existing: existingCompleted,
          incoming: goal.completedDates,
          match: (e, i) => {
            const d = e.date;
            const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
            return iso === i;
          },
          softDelete: async (e) => {
            await tx.assignmentRecord.update({ where: { id: e.id }, data: { deletedAt: new Date() } });
          },
          create: async (iso) => {
            const utcDate = isoToUtcDate(iso);
            await tx.assignmentRecord.create({
              data: { goalId: goal.id, userId, date: utcDate, completed: true, completedAt: utcDate },
            });
          },
        });
      }
    }
  }, { maxWait: 10_000, timeout: 20_000 });

  return NextResponse.json({ ok: true });
}, { label: "api/goals PUT" });

export const POST = PUT;
