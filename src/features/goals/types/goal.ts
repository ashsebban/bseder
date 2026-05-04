// src/features/goals/types/goal.ts
//
// Types are derived directly from the Prisma schema.
// Rules:
//   1. No completion state on Goal (completedDates is GONE)
//   2. No backlog on Goal (lives in GoalPeriod)
//   3. No deprecated fields (ifUnfinished is GONE)
//   4. source field drives color coding in the UI

// ─── Enums ────────────────────────────────────────────────────────────────────

export type GoalCadence =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "seasonal"
  | "project"
  | "one-time";

export type GoalMeasure = "binary" | "numeric";

// Compatibility with the existing UI while the data layer moves to `measure`.
// Do not persist these strings directly in the v2 schema.
export type GoalType = "binary" | "quantified";

export type GoalStatus = "ongoing" | "paused" | "done" | "archived" | "killed";

export type IfUnfinished = "forgive" | "backlog" | "track-failure" | "kill-streak";
export type GoalOnMiss = "ignore" | "track";

// What happens when a period closes unfulfilled
export type GoalCarryover =
  | "drop"      // missed units disappear, no penalty
  | "rollover"  // missed units inflate next period's target
  | "backlog";  // missed units accumulate in GoalPeriod.backlogOut

// What the bar shows for a missed period
export type GoalFailureMode =
  | "punishing"   // red bar, counts as failure
  | "forgiving"   // grey bar, no penalty
  | "kill_streak"; // single miss ends the goal entirely

// Controls the color chip shown in the UI
export type GoalSource =
  | "preset"           // unmodified preset   → BLUE chip
  | "preset_modified"  // preset, user edited → YELLOW chip
  | "custom"           // user-built          → no chip
  | "one_off";         // ad-hoc task         → light grey chip

// "civil"  = day boundary is midnight
// "jewish" = day boundary is nightfall (occurrenceDate may differ from plannerDate)
export type GoalDayModel = "civil" | "jewish";

export type GoalProgramKey = "daf-yomi" | "omer"; // add more as needed

export type DayKey = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

// ─── Supporting Types ─────────────────────────────────────────────────────────

export interface GoalMilestone {
  id: string;
  label: string;
  markerAmount?: number;
  // Legacy UI name. The DB transformer maps this to completedAt.
  completedDate?: string;
  completedAt?: string; // ISO datetime
}

export type Milestone = GoalMilestone;

// Per-period aggregate. Queried separately; not embedded on Goal.
export interface GoalPeriodSummary {
  periodKey: string;
  targetAmount: number;
  plannedAmount: number;
  completedAmount: number;
  backlogIn: number;
  backlogOut: number;
  periodEndedAt?: string;
}

// ─── Core Goal Type ───────────────────────────────────────────────────────────
// Represents a row from the `goals` table.
// This is a RULE — it has no completion state.

export interface Goal {
  id: string;
  userId?: string;
  parentGoalId?: string;

  title: string;
  description?: string;
  emoji?: string;

  cadence: GoalCadence;
  measure?: GoalMeasure;
  // Compatibility name used by existing screens/forms.
  type: GoalType;
  status: GoalStatus;

  // Color chip source
  source?: GoalSource;
  presetId?: string;

  // "civil" (default) or "jewish"
  dayModel?: GoalDayModel;

  // Numeric goals only
  target?: number;        // obligation per period
  targetUnit?: string;    // "pages", "daf", "minutes"
  totalTarget?: number;   // PROJECT goals: total units to complete
  current?: number;       // Legacy project/numeric UI progress. Prefer Assignment/ProjectProgress.

  failureMode?: GoalFailureMode;
  carryover?: GoalCarryover;
  noGettingAhead?: boolean;
  // Legacy failure fields. Prefer failureMode/carryover in the v2 DB schema.
  ifUnfinished?: IfUnfinished;
  onMiss?: GoalOnMiss;
  killOnMiss?: boolean;
  backlog?: number;

  // Zmanim keys from @hebcal/core (daily goals only)
  // Resolved timestamps are snapshotted onto each Assignment row,
  // not read back from here at render time.
  startsAt?: string;  // e.g. "misheyakir"
  expiresAt?: string; // e.g. "chatzot"

  preferredMonthDay?: "first" | "last" | number;
  lockInDays?: boolean;
  adhoc?: boolean;

  startDate?: string;  // ISO date
  endDate?: string;    // ISO date (undefined = open-ended)
  dueDate?: string;    // ISO date (one-time goals)
  endAfterPeriods?: number;

  // Links goal to external schedule for per-date labels
  programKey?: GoalProgramKey;

  // Loaded via joins when needed — not always present
  activeDays?: string[];    // UI shape; DB stores day-of-week integers: 0=Sun..6=Sat
  exclusions?: string[];    // v2 flattened holiday keys, e.g. "Yom_Kippur"
  excludes?: {
    categories?: string[];
    individual?: string[];
  };
  milestones?: GoalMilestone[];
  completedDates?: string[]; // Transitional read model only; do not store on Goal.

  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  completedAt?: string;
  pausedAt?: string;
}

// ─── Assignment Types ─────────────────────────────────────────────────────────
// An Assignment is an OCCURRENCE — one instance of a goal on one specific day.
// Rows only exist when the user has acted on the occurrence.
// Virtual "pending" occurrences are computed by getDayInstances() and never stored.

export type AssignmentStatus =
  | "planned"           // scheduled, not yet done
  | "completed"         // done ✓
  | "in_progress"       // numeric, partial progress logged
  | "missed"            // window closed, failureMode=punishing → red
  | "expired_forgiven"  // window closed, failureMode=forgiving → grey
  | "skipped";          // user explicitly skipped, no penalty

export type MaterializationReason =
  | "user_completed"
  | "user_partial"
  | "user_scheduled"
  | "user_rescheduled"
  | "system_expired"
  | "system_rollover";

export interface Assignment {
  id: string;
  goalId: string;
  userId: string;

  // Gregorian planner column
  date: string;           // ISO date: "2026-04-29"
  // Halachic obligation date. Undefined means same as date.
  occurrenceDate?: string;

  // Hebrew date — snapshotted at write time for Hebrew/Gregorian toggle
  hebrewYear?: number;
  hebrewMonth?: number;   // 1..13
  hebrewDay?: number;     // 1..30

  // For seasonal goals: ordinal within the season (e.g. 27 for Omer day 27)
  seasonalIndex?: number;

  periodKey?: string;

  // Time window — resolved from goal zmanim rule + that day's hebcal data,
  // snapshotted here so historical tasks don't shift as zmanim change
  windowStart?: string;   // ISO datetime
  windowEnd?: string;     // ISO datetime

  targetAmount?: number;  // planned units (null for binary)
  scheduledTime?: string; // "HH:MM"
  durationMins?: number;

  completed: boolean;
  completedAt?: string;   // ISO datetime
  actualAmount?: number;

  status: AssignmentStatus;
  materializedReason?: MaterializationReason;

  originalDate?: string;  // set if rescheduled from another day
  note?: string;

  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// ─── Virtual Day Instance ─────────────────────────────────────────────────────
// What getDayInstances() returns for the calendar to render.
// "persisted" = real DB row. "virtual" = computed from rule, no row yet.
// The UI renders both identically; only the source differs.

export interface VirtualDayInstance {
  // Stable key used by React for list rendering and optimistic updates.
  // Format: "goalId:isoDate" for virtual; assignment.id for persisted.
  instanceKey: string;

  goal: Goal;
  date: string;           // planner date (Gregorian)
  occurrenceDate: string; // obligation date (may differ for jewish dayModel)

  hebrewYear?: number;
  hebrewMonth?: number;
  hebrewDay?: number;
  seasonalIndex?: number;

  windowStart?: string;
  windowEnd?: string;

  status: AssignmentStatus;
  completed: boolean;
  completedAt?: string;
  targetAmount?: number;
  actualAmount?: number;
  scheduledTime?: string;
  durationMins?: number;

  // Set when a real DB row backs this instance
  assignment?: Assignment;

  // Label from programKey (e.g. "Menachot 108" for daf-yomi)
  programLabel?: string;
}

// ─── Progress Bar Segment ─────────────────────────────────────────────────────
// What the segmented progress bar on the month/week views renders per day.

export type BarSegmentColor = "green" | "red" | "grey" | "white";

export interface ProgressBarSegment {
  color: BarSegmentColor;
  // Fraction of the bar (0..1). All segments sum to 1.
  weight: number;
}
