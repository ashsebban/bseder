import test from "node:test";
import assert from "node:assert/strict";

import {
  formatClockTime,
  formatMinutesAsTime,
  formatTimeInZone,
  parseHHMM,
} from "../src/features/calendar/lib/time-format";

test("parseHHMM parses valid inputs and rejects invalid ones", () => {
  assert.equal(parseHHMM("14:05"), 845);
  assert.equal(parseHHMM("00:00"), 0);
  assert.ok(Number.isNaN(parseHHMM("bad")));
});

test("formatMinutesAsTime respects 12h and 24h settings", () => {
  assert.equal(formatMinutesAsTime(14 * 60, "24h"), "14:00");
  assert.equal(formatMinutesAsTime(14 * 60, "12h"), "2pm");
  assert.equal(formatMinutesAsTime(14 * 60 + 15, "12h"), "2:15pm");
});

test("formatClockTime converts HH:MM values without mangling invalid strings", () => {
  assert.equal(formatClockTime("06:30", "12h"), "6:30am");
  assert.equal(formatClockTime("06:30", "24h"), "06:30");
  assert.equal(formatClockTime("soon", "12h"), "soon");
  assert.equal(formatClockTime(undefined, "12h"), undefined);
});

test("formatTimeInZone keeps 24h output deterministic", () => {
  const date = new Date("2026-03-01T14:05:00Z");
  assert.equal(formatTimeInZone(date, "UTC", "24h"), "14:05");
  assert.equal(formatTimeInZone(date, "UTC", "12h"), "2:05 PM");
});
