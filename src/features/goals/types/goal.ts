export type GoalCadence = "one-time" | "yearly" | "monthly" | "weekly" | "daily";
export type GoalStatus = "ongoing" | "done" | "paused";
export type GoalType = "binary" | "quantified";
export type IfUnfinished = "forgive" | "backlog" | "track-failure" | "kill-streak";
export type GoalProgramKey = "daf-yomi" | "omer";

/** A named checkpoint on a one-time (project) goal. Cosmetic only — does not affect progress. */
export interface Milestone {
  id: string;
  label: string;
  /** Units at which this milestone sits on the progress bar (e.g. 9 of 64 daf) */
  markerAmount?: number;
  /** ISO date when checked off — cosmetic only, no effect on parent.current */
  completedDate?: string;
}

export interface Goal {
  id: string;
  title: string;
  cadence: GoalCadence;
  status: GoalStatus;

  /** binary = done/not-done each period | quantified = X out of Y units */
  type: GoalType;

  /** For quantified goals */
  target?: number;      // e.g. 180, 4, 2
  targetUnit?: string;  // e.g. "pages", "daf", "nights", "sessions"
  current?: number;     // progress so far this period (quantified) or total completions (binary)

  /**
   * ISO date strings for each day this binary daily goal was completed.
   * Source of truth for per-day tracking; replaces `current` for roll-up math.
   */
  completedDates?: string[];

  /**
   * Active days — affects roll-up denominator.
   * e.g. ["Sun","Mon","Tue","Wed","Thu","Fri"] excludes Shabbos from the count.
   */
  activeDays?: string[];

  /**
   * Jewish calendar exclusions — further shrink the denominator.
   * categories: broad flag-based groups (e.g. "Yom Tov", "Chol HaMoed")
   * individual: specific hebcal event keys (e.g. "Erev_Pesach", "Yom_Kippur")
   */
  excludes?: {
    categories?: string[];
    individual?: string[];
  };

  /**
   * Optional halachic time window (daily goals only).
   * Values are DayZmanim period names, e.g. "Netz HaChama", "Chatzot", "Night".
   * When zmanim are available the goal dims outside this window.
   */
  startsAt?: string;
  expiresAt?: string;

  /**
   * Optional external learning/program schedule used to derive date-specific labels.
   * Example: a Daf Yomi goal keeps a stable title while each date can show its own daf.
   */
  programKey?: GoalProgramKey;

  /** What happens when a recurring goal period ends with progress remaining */
  ifUnfinished?: IfUnfinished;

  /** ISO date string — when tracking starts */
  startDate?: string;

  /** ISO date string — when recurring goal ends (undefined = no end) */
  endDate?: string;

  /** Number of periods after which the goal ends (e.g. "after 90 times") */
  endAfterPeriods?: number;

  /** ISO date string — for one-time goals: target completion date */
  dueDate?: string;

  /** Accumulated missed units for goals with ifUnfinished === "backlog" */
  backlog?: number;

  /**
   * When true, the user cannot plan more than their current period obligation
   * (target + any accumulated backlog). Prevents getting ahead.
   */
  noGettingAhead?: boolean;

  /**
   * For monthly goals: preferred position within the month for auto-assignment.
   * "first" = 1st of month, "last" = last day of month, number = specific day (1–31)
   */
  preferredMonthDay?: "first" | "last" | number;

  /**
   * When true, this goal's occurrences are fixed to their assigned day.
   * They cannot be dragged to a different day or removed from that day.
   * The user sets this explicitly in the goal form.
   * false/undefined (default) = flexible; true = fixed to its scheduled day(s).
   */
  lockInDays?: boolean;

  /**
   * True for ad-hoc tasks created via the "+ Add task" inline input in the week grid.
   * These are simple one-off todos (e.g. "buy toothpaste") and should not appear
   * in the goal tray — only in the day column they were assigned to.
   */
  adhoc?: boolean;

  /**
   * Set when this goal was broken down FROM a higher-level goal.
   * e.g. a weekly "run 2x" created as a child of a yearly "marathon" goal.
   */
  parentGoalId?: string;

  /**
   * Named milestones for one-time (project) goals.
   * Cosmetic checkpoints only — checking them off does not change progress.
   */
  milestones?: Milestone[];
}
