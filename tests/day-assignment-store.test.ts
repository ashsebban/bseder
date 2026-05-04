import test from "node:test";
import assert from "node:assert/strict";

import {
  DAY_ASSIGNMENTS_STORAGE_UPDATED_EVENT,
  saveDayAssignments,
  type DayAssignment,
} from "../src/features/planner/lib/day-assignment-store";

function makeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => { values.clear(); },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  } as Storage;
}

test("saveDayAssignments stores persistable rows but broadcasts full in-memory state", async () => {
  const previousWindow = (globalThis as any).window;
  const previousLocalStorage = (globalThis as any).localStorage;
  const previousCustomEvent = (globalThis as any).CustomEvent;

  const storage = makeStorage();
  const dispatched: Array<{ type: string; detail: unknown }> = [];

  (globalThis as any).localStorage = storage;
  (globalThis as any).CustomEvent = class<T> {
    type: string;
    detail: T;

    constructor(type: string, init: { detail: T }) {
      this.type = type;
      this.detail = init.detail;
    }
  };
  (globalThis as any).window = {
    localStorage: storage,
    setTimeout: (callback: () => void) => {
      callback();
      return 0;
    },
    dispatchEvent: (event: { type: string; detail: unknown }) => {
      dispatched.push(event);
      return true;
    },
  };

  try {
    const generated: DayAssignment = {
      id: "generated",
      date: "2026-04-27",
      goalId: "goal-1",
      completed: false,
      generated: true,
    };
    const scheduled: DayAssignment = {
      id: "scheduled",
      date: "2026-04-27",
      goalId: "goal-2",
      completed: false,
      scheduledTime: "09:00",
    };
    const completedGeneratedRow: DayAssignment = {
      id: "generated:goal-3:2026-04-28",
      date: "2026-04-28",
      goalId: "goal-3",
      completed: true,
      generated: true,
      scheduledTime: "15:00",
      completedAt: "15:00",
      durationMins: 30,
    };

    saveDayAssignments("scope-1", [generated, scheduled, completedGeneratedRow]);

    const stored = storage.getItem("steinberg_day_assignments.v1::scope-1");
    assert.ok(stored);
    assert.deepEqual(JSON.parse(stored), [scheduled, completedGeneratedRow]);

    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0].type, DAY_ASSIGNMENTS_STORAGE_UPDATED_EVENT);
    assert.deepEqual(dispatched[0].detail, {
      storageScope: "scope-1",
      assignments: [generated, scheduled, completedGeneratedRow],
    });

    saveDayAssignments("scope-1", [generated, scheduled, completedGeneratedRow]);
    assert.equal(dispatched.length, 1);
  } finally {
    (globalThis as any).window = previousWindow;
    (globalThis as any).localStorage = previousLocalStorage;
    (globalThis as any).CustomEvent = previousCustomEvent;
  }
});
