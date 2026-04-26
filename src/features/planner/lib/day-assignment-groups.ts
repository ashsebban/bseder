import type { DayAssignment } from "./day-assignment-store";

export const SESSION_GROUP_ACTION_PREFIX = "session-group:";

export interface AssignmentDisplayGroup {
  id: string;
  representative: DayAssignment;
  assignments: DayAssignment[];
  collapsed: boolean;
  totalAmount: number;
}

export function buildSessionGroupActionId(sessionGroupId: string): string {
  return `${SESSION_GROUP_ACTION_PREFIX}${sessionGroupId}`;
}

export function parseSessionGroupActionId(actionId: string): string | null {
  return actionId.startsWith(SESSION_GROUP_ACTION_PREFIX)
    ? actionId.slice(SESSION_GROUP_ACTION_PREFIX.length)
    : null;
}

export function getSessionGroupAssignments(
  assignments: DayAssignment[],
  sessionGroupId: string,
): DayAssignment[] {
  return assignments.filter((assignment) => assignment.sessionGroupId === sessionGroupId);
}

export function shouldCollapseSessionGroup(assignments: DayAssignment[]): boolean {
  return assignments.length > 1 && assignments.every((assignment) => assignment.completed);
}

export function buildAssignmentDisplayGroups(
  assignments: DayAssignment[],
): AssignmentDisplayGroup[] {
  const assignmentsBySessionGroup = new Map<string, DayAssignment[]>();
  for (const assignment of assignments) {
    if (!assignment.sessionGroupId) continue;
    const existing = assignmentsBySessionGroup.get(assignment.sessionGroupId) ?? [];
    existing.push(assignment);
    assignmentsBySessionGroup.set(assignment.sessionGroupId, existing);
  }

  const seenCollapsedGroups = new Set<string>();
  const displayGroups: AssignmentDisplayGroup[] = [];

  for (const assignment of assignments) {
    if (!assignment.sessionGroupId) {
      displayGroups.push({
        id: assignment.id,
        representative: assignment,
        assignments: [assignment],
        collapsed: false,
        totalAmount: assignment.targetAmount ?? 1,
      });
      continue;
    }

    const groupAssignments = assignmentsBySessionGroup.get(assignment.sessionGroupId) ?? [assignment];
    if (!shouldCollapseSessionGroup(groupAssignments)) {
      displayGroups.push({
        id: assignment.id,
        representative: assignment,
        assignments: [assignment],
        collapsed: false,
        totalAmount: assignment.targetAmount ?? 1,
      });
      continue;
    }

    if (seenCollapsedGroups.has(assignment.sessionGroupId)) continue;
    seenCollapsedGroups.add(assignment.sessionGroupId);

    const representative = groupAssignments.find((item) => item.replacedAutoDate) ?? groupAssignments[0];
    displayGroups.push({
      id: buildSessionGroupActionId(assignment.sessionGroupId),
      representative,
      assignments: groupAssignments,
      collapsed: true,
      totalAmount: groupAssignments.reduce((sum, item) => sum + (item.targetAmount ?? 1), 0),
    });
  }

  return displayGroups;
}
