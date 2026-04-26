// Hardcoded TypeScript mirror of prisma/schema.prisma.
// Update this file whenever the Prisma schema changes.
// Last synced: 2026-04-20

export type ModelGroup = "auth" | "goals" | "assignments" | "admin";

export interface FieldDef {
  name: string;         // Prisma/TS field name
  dbColumn: string;     // actual DB column (@map value, or same as name)
  type: string;         // Prisma scalar type (String, Int, Boolean, DateTime, ...)
  optional: boolean;    // true = nullable / optional
  isId?: boolean;
  isUnique?: boolean;
  defaultValue?: string; // e.g. "uuid()", "now()", "false", "0"
  dbType?: string;       // @db.VarChar(N), @db.Text, @db.Date, etc.
  fk?: {
    toModel: string;
    toField: string;
    onDelete: "Cascade" | "SetNull" | "Restrict" | "NoAction";
  };
  /** If this field is not stored in DB but computed in-app, explain it here. */
  computed?: string;
  note?: string;
}

export interface RelationField {
  name: string;        // Prisma relation name (the array/object field)
  toModel: string;
  isList: boolean;
}

export interface ModelDef {
  name: string;
  table: string;        // @@map value
  group: ModelGroup;
  softDelete: boolean;  // has deletedAt field
  fields: FieldDef[];
  relations: RelationField[];
  notes?: string;
  /** Fields present in the TS type but not in this DB model — computed in-app */
  computedOnlyFields?: { name: string; tsType: string; explanation: string }[];
}

// ─── Auth group ───────────────────────────────────────────────────────────────

const UserModel: ModelDef = {
  name: "User",
  table: "users",
  group: "auth",
  softDelete: true,
  notes: "One row per account. isAdmin is set manually in the DB for the owner. subscriptionStatus is a cached field updated by Stripe webhook. deletedAt = soft delete.",
  fields: [
    { name: "id",                 dbColumn: "id",                  type: "String",   optional: false, isId: true, defaultValue: "uuid()" },
    { name: "email",              dbColumn: "email",               type: "String",   optional: false, isUnique: true },
    { name: "displayName",        dbColumn: "displayName",         type: "String",   optional: true,  dbType: "VarChar(100)" },
    { name: "passwordHash",       dbColumn: "passwordHash",        type: "String",   optional: true,  dbType: "VarChar(255)", note: "null = OAuth-only account" },
    { name: "avatarUrl",          dbColumn: "avatarUrl",           type: "String",   optional: true,  dbType: "VarChar(500)" },
    { name: "subscriptionStatus", dbColumn: "subscriptionStatus",  type: "String",   optional: false, defaultValue: '"free"', note: '"free" | "pro"' },
    { name: "isAdmin",            dbColumn: "isAdmin",             type: "Boolean",  optional: false, defaultValue: "false" },
    { name: "onboardingComplete", dbColumn: "onboardingComplete",  type: "Boolean",  optional: false, defaultValue: "false" },
    { name: "referralSource",     dbColumn: "referralSource",      type: "String",   optional: true,  dbType: "VarChar(100)" },
    { name: "createdAt",          dbColumn: "createdAt",           type: "DateTime", optional: false, defaultValue: "now()" },
    { name: "updatedAt",          dbColumn: "updatedAt",           type: "DateTime", optional: false, defaultValue: "@updatedAt" },
    { name: "deletedAt",          dbColumn: "deletedAt",           type: "DateTime", optional: true },
  ],
  relations: [
    { name: "accounts",    toModel: "Account",         isList: true },
    { name: "sessions",    toModel: "Session",         isList: true },
    { name: "preferences", toModel: "UserPreferences", isList: false },
    { name: "adminEvents", toModel: "AdminEvent",      isList: true },
    { name: "goals",       toModel: "GoalRecord",      isList: true },
    { name: "assignments", toModel: "AssignmentRecord",isList: true },
  ],
};

const AccountModel: ModelDef = {
  name: "Account",
  table: "accounts",
  group: "auth",
  softDelete: false,
  notes: "NextAuth OAuth accounts. Stores Google OAuth tokens. One user can have multiple OAuth accounts.",
  fields: [
    { name: "id",                dbColumn: "id",                type: "String",  optional: false, isId: true, defaultValue: "uuid()" },
    { name: "userId",            dbColumn: "userId",            type: "String",  optional: false, fk: { toModel: "User", toField: "id", onDelete: "Cascade" } },
    { name: "type",              dbColumn: "type",              type: "String",  optional: false, note: '"oauth" | "email" | "credentials"' },
    { name: "provider",          dbColumn: "provider",          type: "String",  optional: false, note: '"google" | "credentials"' },
    { name: "providerAccountId", dbColumn: "providerAccountId", type: "String",  optional: false },
    { name: "refresh_token",     dbColumn: "refresh_token",     type: "String",  optional: true,  dbType: "Text" },
    { name: "access_token",      dbColumn: "access_token",      type: "String",  optional: true,  dbType: "Text" },
    { name: "expires_at",        dbColumn: "expires_at",        type: "Int",     optional: true },
    { name: "token_type",        dbColumn: "token_type",        type: "String",  optional: true },
    { name: "scope",             dbColumn: "scope",             type: "String",  optional: true },
    { name: "id_token",          dbColumn: "id_token",          type: "String",  optional: true,  dbType: "Text" },
    { name: "session_state",     dbColumn: "session_state",     type: "String",  optional: true },
  ],
  relations: [
    { name: "user", toModel: "User", isList: false },
  ],
};

const SessionModel: ModelDef = {
  name: "Session",
  table: "sessions",
  group: "auth",
  softDelete: false,
  notes: "NextAuth database sessions. One row per active browser session. Pruned by NextAuth on access.",
  fields: [
    { name: "id",           dbColumn: "id",           type: "String",   optional: false, isId: true, defaultValue: "uuid()" },
    { name: "sessionToken", dbColumn: "sessionToken", type: "String",   optional: false, isUnique: true },
    { name: "userId",       dbColumn: "userId",       type: "String",   optional: false, fk: { toModel: "User", toField: "id", onDelete: "Cascade" } },
    { name: "expires",      dbColumn: "expires",      type: "DateTime", optional: false },
  ],
  relations: [
    { name: "user", toModel: "User", isList: false },
  ],
};

const VerificationTokenModel: ModelDef = {
  name: "VerificationToken",
  table: "verification_tokens",
  group: "auth",
  softDelete: false,
  notes: "Used for email magic-link and password reset tokens. No userId FK — identified by email address (identifier).",
  fields: [
    { name: "identifier", dbColumn: "identifier", type: "String",   optional: false, note: "Email address" },
    { name: "token",      dbColumn: "token",      type: "String",   optional: false, isUnique: true },
    { name: "expires",    dbColumn: "expires",    type: "DateTime", optional: false },
  ],
  relations: [],
};

const UserPreferencesModel: ModelDef = {
  name: "UserPreferences",
  table: "user_preferences",
  group: "auth",
  softDelete: false,
  notes: "Calendar display settings. 1:1 with User. Created during onboarding; updated in Settings → Calendar.",
  fields: [
    { name: "userId",                      dbColumn: "userId",                      type: "String",  optional: false, isId: true, fk: { toModel: "User", toField: "id", onDelete: "Cascade" } },
    { name: "locationKey",                 dbColumn: "locationKey",                 type: "String",  optional: false, defaultValue: '"new-york"', note: "Matches preset location key in locations.ts" },
    { name: "timeFormat",                  dbColumn: "timeFormat",                  type: "String",  optional: false, defaultValue: '"12h"',      note: '"12h" | "24h"' },
    { name: "showHebrewDates",             dbColumn: "showHebrewDates",             type: "Boolean", optional: false, defaultValue: "true" },
    { name: "weekStartsOn",                dbColumn: "weekStartsOn",                type: "Int",     optional: false, defaultValue: "0",          note: "0 = Sun, 1 = Mon" },
    { name: "defaultView",                 dbColumn: "defaultView",                 type: "String",  optional: false, defaultValue: '"week"',     note: '"month" | "week" | "day"' },
    { name: "showParsha",                  dbColumn: "showParsha",                  type: "Boolean", optional: false, defaultValue: "true" },
    { name: "showRoshChodesh",             dbColumn: "showRoshChodesh",             type: "Boolean", optional: false, defaultValue: "true" },
    { name: "showOmer",                    dbColumn: "showOmer",                    type: "Boolean", optional: false, defaultValue: "true" },
    { name: "showModernHolidays",          dbColumn: "showModernHolidays",          type: "Boolean", optional: false, defaultValue: "false" },
    { name: "showOutsideMonthDays",        dbColumn: "showOutsideMonthDays",        type: "Boolean", optional: false, defaultValue: "true" },
    { name: "havdalahOpinion",             dbColumn: "havdalahOpinion",             type: "String",  optional: false, defaultValue: '"tzeit-8_5"', note: "Zmanim opinion key" },
    { name: "observanceLevel",             dbColumn: "observanceLevel",             type: "String",  optional: false, defaultValue: '"unknown"',  note: '"shabbos" | "not-shabbos" | "mixed" | "unknown"' },
    { name: "timelineSnapMins",            dbColumn: "timelineSnapMins",            type: "Int",     optional: false, defaultValue: "15" },
    { name: "timelineDefaultDurationMins", dbColumn: "timelineDefaultDurationMins", type: "Int",     optional: false, defaultValue: "30" },
    { name: "updatedAt",                   dbColumn: "updatedAt",                   type: "DateTime",optional: false, defaultValue: "@updatedAt" },
  ],
  relations: [
    { name: "user", toModel: "User", isList: false },
  ],
};

// ─── Goals group ──────────────────────────────────────────────────────────────

const GoalRecordModel: ModelDef = {
  name: "GoalRecord",
  table: "goals",
  group: "goals",
  softDelete: true,
  notes: "One row per user goal. Binary goals use AssignmentRecord rows (completed=true) for completedDates. Quantified goals store current value via assignments. excludesCategories is a JSON string expanded to individual holiday keys at runtime.",
  fields: [
    { name: "id",                 dbColumn: "id",                  type: "String",   optional: false, isId: true, defaultValue: "uuid()" },
    { name: "userId",             dbColumn: "user_id",             type: "String",   optional: false, fk: { toModel: "User",       toField: "id", onDelete: "Cascade" } },
    { name: "parentGoalId",       dbColumn: "parent_goal_id",      type: "String",   optional: true,  note: "Sub-goal parent link (future use)" },
    { name: "title",              dbColumn: "title",               type: "String",   optional: false, dbType: "VarChar(500)" },
    { name: "cadence",            dbColumn: "cadence",             type: "String",   optional: false, note: '"one-time" | "yearly" | "monthly" | "weekly" | "daily"' },
    { name: "status",             dbColumn: "status",              type: "String",   optional: false, defaultValue: '"ongoing"', note: '"ongoing" | "done" | "paused"' },
    { name: "type",               dbColumn: "type",                type: "String",   optional: false, note: '"binary" | "quantified"' },
    { name: "target",             dbColumn: "target",              type: "Int",      optional: true },
    { name: "targetUnit",         dbColumn: "target_unit",         type: "String",   optional: true,  dbType: "VarChar(100)" },
    { name: "backlog",            dbColumn: "backlog",             type: "Int",      optional: false, defaultValue: "0", note: "Cached rollover amount; recomputed by goal-progress.ts" },
    { name: "noGettingAhead",     dbColumn: "no_getting_ahead",    type: "Boolean",  optional: false, defaultValue: "false" },
    { name: "ifUnfinished",       dbColumn: "if_unfinished",       type: "String",   optional: true,  note: '"forgive" | "backlog" | "track-failure" | "kill-streak"' },
    { name: "preferredMonthDay",  dbColumn: "preferred_month_day", type: "String",   optional: true,  dbType: "VarChar(10)", note: '"first" | "last" | number as string' },
    { name: "lockInDays",         dbColumn: "lock_in_days",        type: "Boolean",  optional: false, defaultValue: "false", note: "Prevents day reassignment for prebuilt goals" },
    { name: "adhoc",              dbColumn: "adhoc",               type: "Boolean",  optional: false, defaultValue: "false" },
    { name: "startsAt",           dbColumn: "starts_at",           type: "String",   optional: true,  dbType: "VarChar(100)", note: "Zmanim time key (e.g. tzeis)" },
    { name: "expiresAt",          dbColumn: "expires_at",          type: "String",   optional: true,  dbType: "VarChar(100)", note: "Zmanim time key" },
    { name: "startDate",          dbColumn: "start_date",          type: "DateTime", optional: true,  dbType: "Date" },
    { name: "endDate",            dbColumn: "end_date",            type: "DateTime", optional: true,  dbType: "Date" },
    { name: "dueDate",            dbColumn: "due_date",            type: "DateTime", optional: true,  dbType: "Date" },
    { name: "endAfterPeriods",    dbColumn: "end_after_periods",   type: "Int",      optional: true },
    { name: "programKey",         dbColumn: "program_key",         type: "String",   optional: true,  dbType: "VarChar(50)", note: '"daf-yomi" | "omer"' },
    { name: "excludesCategories", dbColumn: "excludes_categories", type: "String",   optional: true,  dbType: "Text", note: "JSON array of holiday category strings; expanded to individual keys at runtime" },
    { name: "createdAt",          dbColumn: "created_at",          type: "DateTime", optional: false, defaultValue: "now()" },
    { name: "updatedAt",          dbColumn: "updated_at",          type: "DateTime", optional: false, defaultValue: "@updatedAt" },
    { name: "deletedAt",          dbColumn: "deleted_at",          type: "DateTime", optional: true },
  ],
  relations: [
    { name: "user",        toModel: "User",                isList: false },
    { name: "activeDays",  toModel: "GoalActiveDayRecord", isList: true },
    { name: "exclusions",  toModel: "GoalExclusionRecord", isList: true },
    { name: "milestones",  toModel: "GoalMilestoneRecord", isList: true },
    { name: "assignments", toModel: "AssignmentRecord",    isList: true },
  ],
  computedOnlyFields: [
    {
      name: "completedDates",
      tsType: "string[]",
      explanation: "Not stored as a column. Derived at load time from AssignmentRecord rows for this goal where completed=true and targetAmount is null. Each row's date becomes an ISO date string.",
    },
    {
      name: "excludes.individual",
      tsType: "string[]",
      explanation: "Stored in GoalExclusionRecord rows (goal_exclusions table) as individual holiday key strings. Assembled into the excludes.individual array when the goal is loaded.",
    },
    {
      name: "excludes.categories",
      tsType: "string[]",
      explanation: "Stored in the excludes_categories TEXT column as a JSON array of category name strings. At runtime, each category is expanded to its individual holiday keys and merged with excludes.individual.",
    },
    {
      name: "current",
      tsType: "number | undefined",
      explanation: "For quantified goals: the sum of actualAmount on non-completed AssignmentRecord rows for the current period, or the goal's own backlog-adjusted progress. Not a dedicated column — computed by goal-progress.ts.",
    },
  ],
};

const GoalActiveDayRecordModel: ModelDef = {
  name: "GoalActiveDayRecord",
  table: "goal_active_days",
  group: "goals",
  softDelete: false,
  notes: "Junction table: which days of the week a goal is active. Composite PK (goalId, dayOfWeek). Day 0 = Sunday … 6 = Saturday.",
  fields: [
    { name: "goalId",    dbColumn: "goal_id",    type: "String", optional: false, isId: true, fk: { toModel: "GoalRecord", toField: "id", onDelete: "Cascade" } },
    { name: "dayOfWeek", dbColumn: "day_of_week", type: "Int",   optional: false, isId: true, note: "0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat" },
  ],
  relations: [
    { name: "goal", toModel: "GoalRecord", isList: false },
  ],
  computedOnlyFields: [
    {
      name: "activeDays (in Goal TS type)",
      tsType: "string[]",
      explanation: 'In the TS Goal type, activeDays is an array of day-name strings (e.g. ["Sun","Mon"]). At load time, GoalActiveDayRecord rows are converted from int (0–6) to day names. On save, day names are converted back to ints.',
    },
  ],
};

const GoalExclusionRecordModel: ModelDef = {
  name: "GoalExclusionRecord",
  table: "goal_exclusions",
  group: "goals",
  softDelete: false,
  notes: "Junction table: which holiday keys a goal excludes. Composite PK (goalId, holidayKey). The app expands category-level exclusions to individual keys before inserting.",
  fields: [
    { name: "goalId",     dbColumn: "goal_id",     type: "String", optional: false, isId: true, fk: { toModel: "GoalRecord", toField: "id", onDelete: "Cascade" } },
    { name: "holidayKey", dbColumn: "holiday_key", type: "String", optional: false, isId: true, dbType: "VarChar(100)", note: "Individual holiday key string (e.g. 'chanukah', 'rosh-hashana')" },
  ],
  relations: [
    { name: "goal", toModel: "GoalRecord", isList: false },
  ],
};

const GoalMilestoneRecordModel: ModelDef = {
  name: "GoalMilestoneRecord",
  table: "goal_milestones",
  group: "goals",
  softDelete: true,
  notes: "Milestone checkpoints within a goal. sortOrder controls display order. completedAt stored as midnight UTC; loaded as ISO date string.",
  fields: [
    { name: "id",           dbColumn: "id",            type: "String",   optional: false, isId: true, defaultValue: "uuid()" },
    { name: "goalId",       dbColumn: "goal_id",       type: "String",   optional: false, fk: { toModel: "GoalRecord", toField: "id", onDelete: "Cascade" } },
    { name: "label",        dbColumn: "label",         type: "String",   optional: false, dbType: "VarChar(500)" },
    { name: "markerAmount", dbColumn: "marker_amount", type: "Int",      optional: true,  note: "Quantified progress value at which this milestone triggers" },
    { name: "sortOrder",    dbColumn: "sort_order",    type: "Int",      optional: false, defaultValue: "0" },
    { name: "completedAt",  dbColumn: "completed_at",  type: "DateTime", optional: true,  note: "Stored as midnight UTC; loaded as ISO date string (completedDate in TS)" },
    { name: "createdAt",    dbColumn: "created_at",    type: "DateTime", optional: false, defaultValue: "now()" },
    { name: "updatedAt",    dbColumn: "updated_at",    type: "DateTime", optional: false, defaultValue: "@updatedAt" },
    { name: "deletedAt",    dbColumn: "deleted_at",    type: "DateTime", optional: true },
  ],
  relations: [
    { name: "goal", toModel: "GoalRecord", isList: false },
  ],
};

// ─── Assignments group ────────────────────────────────────────────────────────

const AssignmentRecordModel: ModelDef = {
  name: "AssignmentRecord",
  table: "assignments",
  group: "assignments",
  softDelete: true,
  notes: "Dual-purpose table. (1) Binary goal completions: completed=true, no targetAmount. (2) Planner day assignments: completed=false, has targetAmount/scheduledTime/etc. sessionGroupId and generated fields exist only in the TS DayAssignment type and are never persisted.",
  fields: [
    { name: "id",               dbColumn: "id",                 type: "String",   optional: false, isId: true, defaultValue: "uuid()" },
    { name: "goalId",           dbColumn: "goal_id",            type: "String",   optional: false, fk: { toModel: "GoalRecord", toField: "id", onDelete: "Cascade" } },
    { name: "userId",           dbColumn: "user_id",            type: "String",   optional: false, fk: { toModel: "User",       toField: "id", onDelete: "Cascade" } },
    { name: "date",             dbColumn: "date",               type: "DateTime", optional: false, dbType: "Date" },
    { name: "periodKey",        dbColumn: "period_key",         type: "String",   optional: true,  dbType: "VarChar(20)", note: "e.g. '2025-W03', '2025-04'" },
    { name: "targetAmount",     dbColumn: "target_amount",      type: "Int",      optional: true,  note: "null = binary completion row; set = planner assignment" },
    { name: "scheduledTime",    dbColumn: "scheduled_time",     type: "String",   optional: true,  dbType: "VarChar(5)", note: "HH:MM format; stored as string, not TIME column" },
    { name: "durationMins",     dbColumn: "duration_mins",      type: "Int",      optional: true },
    { name: "completed",        dbColumn: "completed",          type: "Boolean",  optional: false, defaultValue: "false" },
    { name: "completedAt",      dbColumn: "completed_at",       type: "DateTime", optional: true,  note: "For planner assignments: combined date+time of completion" },
    { name: "actualAmount",     dbColumn: "actual_amount",      type: "Int",      optional: true },
    { name: "replacedAutoDate", dbColumn: "replaced_auto_date", type: "DateTime", optional: true,  dbType: "Date" },
    { name: "skipped",          dbColumn: "skipped",            type: "Boolean",  optional: false, defaultValue: "false" },
    { name: "createdAt",        dbColumn: "created_at",         type: "DateTime", optional: false, defaultValue: "now()" },
    { name: "updatedAt",        dbColumn: "updated_at",         type: "DateTime", optional: false, defaultValue: "@updatedAt" },
    { name: "deletedAt",        dbColumn: "deleted_at",         type: "DateTime", optional: true },
  ],
  relations: [
    { name: "goal", toModel: "GoalRecord", isList: false },
    { name: "user", toModel: "User",       isList: false },
  ],
  computedOnlyFields: [
    {
      name: "sessionGroupId",
      tsType: "string",
      explanation: "In-app only. A UUID generated per calendar render session to group auto-generated assignments together. Never saved to the database.",
    },
    {
      name: "generated",
      tsType: "boolean",
      explanation: "In-app only. True when the assignment was auto-generated by the planner (not manually placed by the user). Never saved to the database — always recomputed.",
    },
  ],
};

// ─── Admin group ──────────────────────────────────────────────────────────────

const AdminEventModel: ModelDef = {
  name: "AdminEvent",
  table: "admin_events",
  group: "admin",
  softDelete: false,
  notes: "Append-only event log. Written by auth actions automatically. Displayed in Admin → Logs tab. userId is nullable so events survive user deletion.",
  fields: [
    { name: "id",        dbColumn: "id",        type: "String",   optional: false, isId: true, defaultValue: "uuid()" },
    { name: "type",      dbColumn: "type",      type: "String",   optional: false, note: '"signup" | "signin" | "password-reset" | "error" | "admin-action"' },
    { name: "userEmail", dbColumn: "userEmail", type: "String",   optional: true,  dbType: "VarChar(320)" },
    { name: "details",   dbColumn: "details",   type: "String",   optional: true,  dbType: "Text" },
    { name: "createdAt", dbColumn: "createdAt", type: "DateTime", optional: false, defaultValue: "now()" },
    { name: "userId",    dbColumn: "userId",    type: "String",   optional: true,  fk: { toModel: "User", toField: "id", onDelete: "SetNull" }, note: "Nullable — events survive user deletion" },
  ],
  relations: [
    { name: "user", toModel: "User", isList: false },
  ],
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const MODELS: ModelDef[] = [
  // Auth
  UserModel,
  AccountModel,
  SessionModel,
  VerificationTokenModel,
  UserPreferencesModel,
  // Goals
  GoalRecordModel,
  GoalActiveDayRecordModel,
  GoalExclusionRecordModel,
  GoalMilestoneRecordModel,
  // Assignments
  AssignmentRecordModel,
  // Admin
  AdminEventModel,
];

export const MODEL_BY_NAME = new Map<string, ModelDef>(
  MODELS.map((m) => [m.name, m]),
);

export const GROUP_LABELS: Record<ModelGroup, string> = {
  auth:        "Auth & Identity",
  goals:       "Goals",
  assignments: "Assignments",
  admin:       "Admin",
};

export const GROUP_COLORS: Record<ModelGroup, { bg: string; border: string; badge: string; header: string }> = {
  auth:        { bg: "bg-blue-50",   border: "border-blue-200",  badge: "bg-blue-100 text-blue-700",   header: "bg-blue-100 text-blue-800" },
  goals:       { bg: "bg-green-50",  border: "border-green-200", badge: "bg-green-100 text-green-700", header: "bg-green-100 text-green-800" },
  assignments: { bg: "bg-purple-50", border: "border-purple-200",badge: "bg-purple-100 text-purple-700",header: "bg-purple-100 text-purple-800" },
  admin:       { bg: "bg-orange-50", border: "border-orange-200",badge: "bg-orange-100 text-orange-700",header: "bg-orange-100 text-orange-800" },
};
