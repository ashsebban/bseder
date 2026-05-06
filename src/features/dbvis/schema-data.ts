// Hardcoded TypeScript mirror of prisma/schema.prisma.
// Update this file whenever the Prisma schema changes.
// Last synced: 2026-05-06

export type ModelGroup = "auth" | "calendar" | "goals" | "assignments" | "admin";

export interface FieldDef {
  name: string;
  dbColumn: string;
  type: string;
  optional: boolean;
  isId?: boolean;
  isUnique?: boolean;
  defaultValue?: string;
  dbType?: string;
  fk?: {
    toModel: string;
    toField: string;
    onDelete: "Cascade" | "SetNull" | "Restrict" | "NoAction";
  };
  computed?: string;
  note?: string;
}

export interface RelationField {
  name: string;
  toModel: string;
  isList: boolean;
}

export interface ModelDef {
  name: string;
  table: string;
  group: ModelGroup;
  softDelete: boolean;
  fields: FieldDef[];
  relations: RelationField[];
  notes?: string;
  computedOnlyFields?: { name: string; tsType: string; explanation: string }[];
}

function idField(): FieldDef {
  return { name: "id", dbColumn: "id", type: "String", optional: false, isId: true, defaultValue: "uuid()", dbType: "Char(36)" };
}

function timestamps({ softDelete = false }: { softDelete?: boolean } = {}): FieldDef[] {
  return [
    { name: "createdAt", dbColumn: "createdAt", type: "DateTime", optional: false, defaultValue: "now()" },
    { name: "updatedAt", dbColumn: "updatedAt", type: "DateTime", optional: false, defaultValue: "@updatedAt" },
    ...(softDelete ? [{ name: "deletedAt", dbColumn: "deletedAt", type: "DateTime", optional: true } satisfies FieldDef] : []),
  ];
}

const UserModel: ModelDef = {
  name: "User",
  table: "users",
  group: "auth",
  softDelete: true,
  notes: "One row per account. Goals are rules; assignments are occurrences.",
  fields: [
    idField(),
    { name: "email", dbColumn: "email", type: "String", optional: false, isUnique: true, dbType: "VarChar(320)" },
    { name: "displayName", dbColumn: "displayName", type: "String", optional: true, dbType: "VarChar(100)" },
    { name: "passwordHash", dbColumn: "passwordHash", type: "String", optional: true, dbType: "VarChar(255)" },
    { name: "avatarUrl", dbColumn: "avatarUrl", type: "String", optional: true, dbType: "VarChar(500)" },
    { name: "subscriptionStatus", dbColumn: "subscriptionStatus", type: "String", optional: false, defaultValue: '"free"', dbType: "VarChar(20)" },
    { name: "isAdmin", dbColumn: "isAdmin", type: "Boolean", optional: false, defaultValue: "false" },
    { name: "onboardingComplete", dbColumn: "onboardingComplete", type: "Boolean", optional: false, defaultValue: "false" },
    { name: "referralSource", dbColumn: "referralSource", type: "String", optional: true, dbType: "VarChar(100)" },
    ...timestamps({ softDelete: true }),
  ],
  relations: [
    { name: "accounts", toModel: "Account", isList: true },
    { name: "sessions", toModel: "Session", isList: true },
    { name: "preferences", toModel: "UserPreferences", isList: false },
    { name: "adminEvents", toModel: "AdminEvent", isList: true },
    { name: "goals", toModel: "Goal", isList: true },
    { name: "assignments", toModel: "Assignment", isList: true },
  ],
};

const AccountModel: ModelDef = {
  name: "Account",
  table: "accounts",
  group: "auth",
  softDelete: false,
  notes: "NextAuth OAuth accounts.",
  fields: [
    idField(),
    { name: "userId", dbColumn: "userId", type: "String", optional: false, fk: { toModel: "User", toField: "id", onDelete: "Cascade" } },
    { name: "type", dbColumn: "type", type: "String", optional: false },
    { name: "provider", dbColumn: "provider", type: "String", optional: false },
    { name: "providerAccountId", dbColumn: "providerAccountId", type: "String", optional: false },
    { name: "refresh_token", dbColumn: "refresh_token", type: "String", optional: true, dbType: "Text" },
    { name: "access_token", dbColumn: "access_token", type: "String", optional: true, dbType: "Text" },
    { name: "expires_at", dbColumn: "expires_at", type: "Int", optional: true },
    { name: "token_type", dbColumn: "token_type", type: "String", optional: true },
    { name: "scope", dbColumn: "scope", type: "String", optional: true },
    { name: "id_token", dbColumn: "id_token", type: "String", optional: true, dbType: "Text" },
    { name: "session_state", dbColumn: "session_state", type: "String", optional: true },
  ],
  relations: [{ name: "user", toModel: "User", isList: false }],
};

const SessionModel: ModelDef = {
  name: "Session",
  table: "sessions",
  group: "auth",
  softDelete: false,
  notes: "NextAuth database sessions.",
  fields: [
    idField(),
    { name: "sessionToken", dbColumn: "sessionToken", type: "String", optional: false, isUnique: true },
    { name: "userId", dbColumn: "userId", type: "String", optional: false, fk: { toModel: "User", toField: "id", onDelete: "Cascade" } },
    { name: "expires", dbColumn: "expires", type: "DateTime", optional: false },
  ],
  relations: [{ name: "user", toModel: "User", isList: false }],
};

const VerificationTokenModel: ModelDef = {
  name: "VerificationToken",
  table: "verification_tokens",
  group: "auth",
  softDelete: false,
  notes: "Email magic-link and password reset tokens.",
  fields: [
    { name: "identifier", dbColumn: "identifier", type: "String", optional: false },
    { name: "token", dbColumn: "token", type: "String", optional: false, isUnique: true },
    { name: "expires", dbColumn: "expires", type: "DateTime", optional: false },
  ],
  relations: [],
};

const UserPreferencesModel: ModelDef = {
  name: "UserPreferences",
  table: "user_preferences",
  group: "auth",
  softDelete: false,
  notes: "Calendar, zmanim, and display preferences. 1:1 with User.",
  fields: [
    { name: "userId", dbColumn: "userId", type: "String", optional: false, isId: true, fk: { toModel: "User", toField: "id", onDelete: "Cascade" } },
    { name: "locationKey", dbColumn: "locationKey", type: "String", optional: false, defaultValue: '"los-angeles-ca"', dbType: "VarChar(64)" },
    { name: "timeFormat", dbColumn: "timeFormat", type: "String", optional: false, defaultValue: '"12h"', dbType: "VarChar(3)" },
    { name: "showHebrewDates", dbColumn: "showHebrewDates", type: "Boolean", optional: false, defaultValue: "true" },
    { name: "weekStartsOn", dbColumn: "weekStartsOn", type: "Int", optional: false, defaultValue: "0" },
    { name: "defaultView", dbColumn: "defaultView", type: "String", optional: false, defaultValue: '"week"', dbType: "VarChar(10)" },
    { name: "showParsha", dbColumn: "showParsha", type: "Boolean", optional: false, defaultValue: "true" },
    { name: "showRoshChodesh", dbColumn: "showRoshChodesh", type: "Boolean", optional: false, defaultValue: "true" },
    { name: "showOmer", dbColumn: "showOmer", type: "Boolean", optional: false, defaultValue: "true" },
    { name: "showModernHolidays", dbColumn: "showModernHolidays", type: "Boolean", optional: false, defaultValue: "false" },
    { name: "showOutsideMonthDays", dbColumn: "showOutsideMonthDays", type: "Boolean", optional: false, defaultValue: "true" },
    { name: "havdalahOpinion", dbColumn: "havdalahOpinion", type: "String", optional: false, defaultValue: '"tzeit-8_5"', dbType: "VarChar(20)" },
    { name: "havdalahMode", dbColumn: "havdalahMode", type: "String", optional: false, defaultValue: '"nusach"', dbType: "VarChar(20)" },
    { name: "nusach", dbColumn: "nusach", type: "String", optional: false, defaultValue: '"ashkenaz"', dbType: "VarChar(20)" },
    { name: "observanceLevel", dbColumn: "observanceLevel", type: "String", optional: false, defaultValue: '"unknown"', dbType: "VarChar(20)" },
    { name: "timelineSnapMins", dbColumn: "timelineSnapMins", type: "Int", optional: false, defaultValue: "15" },
    { name: "timelineDefaultDurationMins", dbColumn: "timelineDefaultDurationMins", type: "Int", optional: false, defaultValue: "30" },
    { name: "showHebrewDatesOnGoals", dbColumn: "showHebrewDatesOnGoals", type: "Boolean", optional: false, defaultValue: "false" },
    { name: "hebrewDateFormat", dbColumn: "hebrewDateFormat", type: "String", optional: false, defaultValue: '"english"', dbType: "VarChar(10)" },
    { name: "hebrewDateIncludeYear", dbColumn: "hebrewDateIncludeYear", type: "Boolean", optional: false, defaultValue: "false" },
    { name: "hebrewMode", dbColumn: "hebrewMode", type: "Boolean", optional: false, defaultValue: "false" },
    { name: "updatedAt", dbColumn: "updatedAt", type: "DateTime", optional: false, defaultValue: "@updatedAt" },
  ],
  relations: [{ name: "user", toModel: "User", isList: false }],
};

const HebcalDayCacheModel: ModelDef = {
  name: "HebcalDayCache",
  table: "hebcal_day_cache",
  group: "calendar",
  softDelete: false,
  notes: "Per-location, per-Gregorian-date cache of Hebrew date, events, zmanim, candle times, and flags.",
  fields: [
    idField(),
    { name: "locationKey", dbColumn: "locationKey", type: "String", optional: false, dbType: "VarChar(64)" },
    { name: "gregorianDate", dbColumn: "gregorianDate", type: "DateTime", optional: false, dbType: "Date", note: "Unique with locationKey" },
    { name: "hebrewYear", dbColumn: "hebrewYear", type: "Int", optional: false },
    { name: "hebrewMonth", dbColumn: "hebrewMonth", type: "Int", optional: false },
    { name: "hebrewDay", dbColumn: "hebrewDay", type: "Int", optional: false },
    { name: "hebrewDateStr", dbColumn: "hebrewDateStr", type: "String", optional: false, dbType: "VarChar(40)" },
    { name: "isShabbat", dbColumn: "isShabbat", type: "Boolean", optional: false, defaultValue: "false" },
    { name: "isYomTov", dbColumn: "isYomTov", type: "Boolean", optional: false, defaultValue: "false" },
    { name: "isCholHamoed", dbColumn: "isCholHamoed", type: "Boolean", optional: false, defaultValue: "false" },
    { name: "isRoshChodesh", dbColumn: "isRoshChodesh", type: "Boolean", optional: false, defaultValue: "false" },
    { name: "isFastDay", dbColumn: "isFastDay", type: "Boolean", optional: false, defaultValue: "false" },
    { name: "parsha", dbColumn: "parsha", type: "String", optional: true, dbType: "VarChar(80)" },
    { name: "omerDay", dbColumn: "omerDay", type: "Int", optional: true },
    { name: "payload", dbColumn: "payload", type: "Json", optional: false },
    { name: "fetchedAt", dbColumn: "fetchedAt", type: "DateTime", optional: false, defaultValue: "now()" },
    { name: "expiresAt", dbColumn: "expiresAt", type: "DateTime", optional: false },
  ],
  relations: [],
};

const GoalPresetModel: ModelDef = {
  name: "GoalPreset",
  table: "goal_presets",
  group: "goals",
  softDelete: false,
  notes: "Curated preset catalog. User-added presets create Goal rows with source preset or preset_modified.",
  fields: [
    idField(),
    { name: "slug", dbColumn: "slug", type: "String", optional: false, isUnique: true, dbType: "VarChar(80)" },
    { name: "title", dbColumn: "title", type: "String", optional: false, dbType: "VarChar(200)" },
    { name: "description", dbColumn: "description", type: "String", optional: true, dbType: "Text" },
    { name: "emoji", dbColumn: "emoji", type: "String", optional: true, dbType: "VarChar(8)" },
    { name: "cadence", dbColumn: "cadence", type: "String", optional: false, dbType: "VarChar(20)" },
    { name: "measure", dbColumn: "measure", type: "String", optional: false, dbType: "VarChar(10)" },
    { name: "failureMode", dbColumn: "failureMode", type: "String", optional: false, dbType: "VarChar(20)" },
    { name: "dayModel", dbColumn: "dayModel", type: "String", optional: true, dbType: "VarChar(10)" },
    { name: "startsAtDefault", dbColumn: "startsAtDefault", type: "String", optional: true, dbType: "VarChar(100)" },
    { name: "expiresAtDefault", dbColumn: "expiresAtDefault", type: "String", optional: true, dbType: "VarChar(100)" },
    { name: "targetDefault", dbColumn: "targetDefault", type: "Int", optional: true },
    { name: "targetUnitDefault", dbColumn: "targetUnitDefault", type: "String", optional: true, dbType: "VarChar(100)" },
    { name: "exclusionsDefault", dbColumn: "exclusionsDefault", type: "Json", optional: true },
    { name: "activeDaysDefault", dbColumn: "activeDaysDefault", type: "Json", optional: true },
    { name: "seasonalRule", dbColumn: "seasonalRule", type: "Json", optional: true },
    { name: "isPublished", dbColumn: "isPublished", type: "Boolean", optional: false, defaultValue: "true" },
    { name: "sortOrder", dbColumn: "sortOrder", type: "Int", optional: false, defaultValue: "0" },
    ...timestamps(),
  ],
  relations: [{ name: "goals", toModel: "Goal", isList: true }],
};

const GoalModel: ModelDef = {
  name: "Goal",
  table: "goals",
  group: "goals",
  softDelete: true,
  notes: "A goal is a rule. It stores cadence, measurement, source, failure semantics, and time-window defaults. Completion state lives on Assignment rows.",
  fields: [
    idField(),
    { name: "userId", dbColumn: "userId", type: "String", optional: false, fk: { toModel: "User", toField: "id", onDelete: "Cascade" } },
    { name: "parentGoalId", dbColumn: "parentGoalId", type: "String", optional: true, fk: { toModel: "Goal", toField: "id", onDelete: "SetNull" } },
    { name: "title", dbColumn: "title", type: "String", optional: false, dbType: "VarChar(500)" },
    { name: "description", dbColumn: "description", type: "String", optional: true, dbType: "Text" },
    { name: "emoji", dbColumn: "emoji", type: "String", optional: true, dbType: "VarChar(8)" },
    { name: "cadence", dbColumn: "cadence", type: "String", optional: false, dbType: "VarChar(20)", note: "daily | weekly | monthly | yearly | seasonal | project | one-time" },
    { name: "measure", dbColumn: "measure", type: "String", optional: false, dbType: "VarChar(10)", note: "binary | numeric" },
    { name: "status", dbColumn: "status", type: "String", optional: false, defaultValue: '"ongoing"', dbType: "VarChar(20)" },
    { name: "source", dbColumn: "source", type: "String", optional: false, defaultValue: '"custom"', dbType: "VarChar(20)", note: "preset | preset_modified | custom | one_off" },
    { name: "presetId", dbColumn: "presetId", type: "String", optional: true, fk: { toModel: "GoalPreset", toField: "id", onDelete: "SetNull" } },
    { name: "dayModel", dbColumn: "dayModel", type: "String", optional: true, dbType: "VarChar(10)", note: "civil | jewish" },
    { name: "target", dbColumn: "target", type: "Int", optional: true },
    { name: "targetUnit", dbColumn: "targetUnit", type: "String", optional: true, dbType: "VarChar(100)" },
    { name: "totalTarget", dbColumn: "totalTarget", type: "Int", optional: true, note: "Project goals only" },
    { name: "failureMode", dbColumn: "failureMode", type: "String", optional: false, defaultValue: '"forgiving"', dbType: "VarChar(20)" },
    { name: "carryover", dbColumn: "carryover", type: "String", optional: false, defaultValue: '"drop"', dbType: "VarChar(20)" },
    { name: "noGettingAhead", dbColumn: "noGettingAhead", type: "Boolean", optional: false, defaultValue: "false" },
    { name: "startsAt", dbColumn: "startsAt", type: "String", optional: true, dbType: "VarChar(100)", note: "Zman key, e.g. Tzais HaKochavim" },
    { name: "expiresAt", dbColumn: "expiresAt", type: "String", optional: true, dbType: "VarChar(100)" },
    { name: "preferredMonthDay", dbColumn: "preferredMonthDay", type: "String", optional: true, dbType: "VarChar(10)" },
    { name: "lockInDays", dbColumn: "lockInDays", type: "Boolean", optional: false, defaultValue: "false" },
    { name: "startDate", dbColumn: "startDate", type: "DateTime", optional: true, dbType: "Date" },
    { name: "endDate", dbColumn: "endDate", type: "DateTime", optional: true, dbType: "Date" },
    { name: "dueDate", dbColumn: "dueDate", type: "DateTime", optional: true, dbType: "Date" },
    { name: "endAfterPeriods", dbColumn: "endAfterPeriods", type: "Int", optional: true },
    { name: "programKey", dbColumn: "programKey", type: "String", optional: true, dbType: "VarChar(50)" },
    ...timestamps({ softDelete: true }),
  ],
  relations: [
    { name: "user", toModel: "User", isList: false },
    { name: "parent", toModel: "Goal", isList: false },
    { name: "children", toModel: "Goal", isList: true },
    { name: "preset", toModel: "GoalPreset", isList: false },
    { name: "activeDays", toModel: "GoalActiveDay", isList: true },
    { name: "exclusions", toModel: "GoalExclusion", isList: true },
    { name: "milestones", toModel: "GoalMilestone", isList: true },
    { name: "periods", toModel: "GoalPeriod", isList: true },
    { name: "statusHistory", toModel: "GoalStatusHistory", isList: true },
    { name: "assignments", toModel: "Assignment", isList: true },
    { name: "asProject", toModel: "ProjectFeeder", isList: true },
    { name: "asFeeder", toModel: "ProjectFeeder", isList: true },
  ],
  computedOnlyFields: [
    { name: "type", tsType: '"binary" | "quantified"', explanation: "Compatibility alias for measure while the UI migrates." },
    { name: "completedDates", tsType: "string[]", explanation: "Transitional read model derived from completed Assignment rows. Not stored on goals." },
    { name: "backlog", tsType: "number", explanation: "Compatibility read field. Durable backlog belongs in GoalPeriod backlogIn/backlogOut." },
    { name: "ifUnfinished", tsType: "string", explanation: "Compatibility alias derived from failureMode and carryover." },
  ],
};

const GoalActiveDayModel: ModelDef = {
  name: "GoalActiveDay",
  table: "goal_active_days",
  group: "goals",
  softDelete: false,
  notes: "Junction table for goal active weekdays. Composite primary key is goalId + dayOfWeek.",
  fields: [
    { name: "goalId", dbColumn: "goalId", type: "String", optional: false, isId: true, fk: { toModel: "Goal", toField: "id", onDelete: "Cascade" } },
    { name: "dayOfWeek", dbColumn: "dayOfWeek", type: "Int", optional: false, isId: true, note: "0=Sun ... 6=Sat" },
  ],
  relations: [{ name: "goal", toModel: "Goal", isList: false }],
};

const GoalExclusionModel: ModelDef = {
  name: "GoalExclusion",
  table: "goal_exclusions",
  group: "goals",
  softDelete: false,
  notes: "Individual Jewish-date/holiday exclusions for a goal.",
  fields: [
    { name: "goalId", dbColumn: "goalId", type: "String", optional: false, isId: true, fk: { toModel: "Goal", toField: "id", onDelete: "Cascade" } },
    { name: "holidayKey", dbColumn: "holidayKey", type: "String", optional: false, isId: true, dbType: "VarChar(100)" },
  ],
  relations: [{ name: "goal", toModel: "Goal", isList: false }],
};

const GoalMilestoneModel: ModelDef = {
  name: "GoalMilestone",
  table: "goal_milestones",
  group: "goals",
  softDelete: true,
  notes: "Optional checkpoints for numeric/project goals.",
  fields: [
    idField(),
    { name: "goalId", dbColumn: "goalId", type: "String", optional: false, fk: { toModel: "Goal", toField: "id", onDelete: "Cascade" } },
    { name: "label", dbColumn: "label", type: "String", optional: false, dbType: "VarChar(500)" },
    { name: "markerAmount", dbColumn: "markerAmount", type: "Int", optional: true },
    { name: "sortOrder", dbColumn: "sortOrder", type: "Int", optional: false, defaultValue: "0" },
    { name: "completedAt", dbColumn: "completedAt", type: "DateTime", optional: true },
    ...timestamps({ softDelete: true }),
  ],
  relations: [{ name: "goal", toModel: "Goal", isList: false }],
};

const GoalPeriodModel: ModelDef = {
  name: "GoalPeriod",
  table: "goal_periods",
  group: "goals",
  softDelete: false,
  notes: "Materialized per-period aggregate and backlog ledger. Unique per goalId + periodKey.",
  fields: [
    idField(),
    { name: "goalId", dbColumn: "goalId", type: "String", optional: false, fk: { toModel: "Goal", toField: "id", onDelete: "Cascade" } },
    { name: "periodKey", dbColumn: "periodKey", type: "String", optional: false, dbType: "VarChar(20)" },
    { name: "targetAmount", dbColumn: "targetAmount", type: "Int", optional: false },
    { name: "plannedAmount", dbColumn: "plannedAmount", type: "Int", optional: false, defaultValue: "0" },
    { name: "completedAmount", dbColumn: "completedAmount", type: "Int", optional: false, defaultValue: "0" },
    { name: "backlogIn", dbColumn: "backlogIn", type: "Int", optional: false, defaultValue: "0" },
    { name: "backlogOut", dbColumn: "backlogOut", type: "Int", optional: false, defaultValue: "0" },
    { name: "periodEndedAt", dbColumn: "periodEndedAt", type: "DateTime", optional: true },
    ...timestamps(),
  ],
  relations: [{ name: "goal", toModel: "Goal", isList: false }],
};

const GoalStatusHistoryModel: ModelDef = {
  name: "GoalStatusHistory",
  table: "goal_status_history",
  group: "goals",
  softDelete: false,
  notes: "Append-only goal lifecycle history.",
  fields: [
    idField(),
    { name: "goalId", dbColumn: "goalId", type: "String", optional: false, fk: { toModel: "Goal", toField: "id", onDelete: "Cascade" } },
    { name: "fromStatus", dbColumn: "fromStatus", type: "String", optional: true, dbType: "VarChar(20)" },
    { name: "toStatus", dbColumn: "toStatus", type: "String", optional: false, dbType: "VarChar(20)" },
    { name: "changedAt", dbColumn: "changedAt", type: "DateTime", optional: false, defaultValue: "now()" },
    { name: "note", dbColumn: "note", type: "String", optional: true, dbType: "Text" },
  ],
  relations: [{ name: "goal", toModel: "Goal", isList: false }],
};

const AssignmentModel: ModelDef = {
  name: "Assignment",
  table: "assignments",
  group: "assignments",
  softDelete: true,
  notes: "An occurrence of a goal. Rows exist only once the user/system materializes an occurrence by planning, completing, skipping, expiring, or rescheduling it.",
  fields: [
    idField(),
    { name: "goalId", dbColumn: "goalId", type: "String", optional: false, fk: { toModel: "Goal", toField: "id", onDelete: "Cascade" } },
    { name: "userId", dbColumn: "userId", type: "String", optional: false, fk: { toModel: "User", toField: "id", onDelete: "Cascade" } },
    { name: "date", dbColumn: "date", type: "DateTime", optional: false, dbType: "Date", note: "Gregorian planner column" },
    { name: "occurrenceDate", dbColumn: "occurrenceDate", type: "DateTime", optional: true, dbType: "Date", note: "Halachic obligation date when different from planner date" },
    { name: "hebrewYear", dbColumn: "hebrewYear", type: "Int", optional: true },
    { name: "hebrewMonth", dbColumn: "hebrewMonth", type: "Int", optional: true },
    { name: "hebrewDay", dbColumn: "hebrewDay", type: "Int", optional: true },
    { name: "seasonalIndex", dbColumn: "seasonalIndex", type: "Int", optional: true },
    { name: "periodKey", dbColumn: "periodKey", type: "String", optional: true, dbType: "VarChar(20)" },
    { name: "windowStart", dbColumn: "windowStart", type: "DateTime", optional: true },
    { name: "windowEnd", dbColumn: "windowEnd", type: "DateTime", optional: true },
    { name: "targetAmount", dbColumn: "targetAmount", type: "Int", optional: true },
    { name: "scheduledTime", dbColumn: "scheduledTime", type: "String", optional: true, dbType: "VarChar(5)" },
    { name: "durationMins", dbColumn: "durationMins", type: "Int", optional: true },
    { name: "completed", dbColumn: "completed", type: "Boolean", optional: false, defaultValue: "false" },
    { name: "completedAt", dbColumn: "completedAt", type: "DateTime", optional: true },
    { name: "actualAmount", dbColumn: "actualAmount", type: "Int", optional: true },
    { name: "status", dbColumn: "status", type: "String", optional: false, defaultValue: '"planned"', dbType: "VarChar(20)" },
    { name: "materializedReason", dbColumn: "materializedReason", type: "String", optional: true, dbType: "VarChar(30)" },
    { name: "originalDate", dbColumn: "originalDate", type: "DateTime", optional: true, dbType: "Date" },
    { name: "note", dbColumn: "note", type: "String", optional: true, dbType: "Text" },
    ...timestamps({ softDelete: true }),
  ],
  relations: [
    { name: "goal", toModel: "Goal", isList: false },
    { name: "user", toModel: "User", isList: false },
  ],
  computedOnlyFields: [
    { name: "generated", tsType: "boolean", explanation: "In-memory virtual occurrence flag. Never persisted." },
    { name: "sessionGroupId", tsType: "string", explanation: "In-memory grouping id for split numeric sessions. Never persisted." },
    { name: "replacedAutoDate", tsType: "string", explanation: "Compatibility alias for originalDate until GoalSuppression is wired through the UI." },
    { name: "skipped", tsType: "boolean", explanation: "Compatibility alias for status === skipped until GoalSuppression is wired through the UI." },
  ],
};

const GoalSuppressionModel: ModelDef = {
  name: "GoalSuppression",
  table: "goal_suppression",
  group: "assignments",
  softDelete: true,
  notes: "Suppresses virtual auto-show for one goal/date after moving, deleting, or skipping a generated occurrence.",
  fields: [
    idField(),
    { name: "goalId", dbColumn: "goalId", type: "String", optional: false },
    { name: "userId", dbColumn: "userId", type: "String", optional: false },
    { name: "date", dbColumn: "date", type: "DateTime", optional: false, dbType: "Date" },
    { name: "reason", dbColumn: "reason", type: "String", optional: false, dbType: "VarChar(30)" },
    { name: "relatedAssignmentId", dbColumn: "relatedAssignmentId", type: "String", optional: true },
    { name: "createdAt", dbColumn: "createdAt", type: "DateTime", optional: false, defaultValue: "now()" },
    { name: "deletedAt", dbColumn: "deletedAt", type: "DateTime", optional: true },
  ],
  relations: [],
};

const ProjectFeederModel: ModelDef = {
  name: "ProjectFeeder",
  table: "project_feeders",
  group: "goals",
  softDelete: true,
  notes: "Links cadence goals to project goals for automatic rollup.",
  fields: [
    idField(),
    { name: "projectGoalId", dbColumn: "projectGoalId", type: "String", optional: false, fk: { toModel: "Goal", toField: "id", onDelete: "Cascade" } },
    { name: "feederGoalId", dbColumn: "feederGoalId", type: "String", optional: false, fk: { toModel: "Goal", toField: "id", onDelete: "Cascade" } },
    { name: "weight", dbColumn: "weight", type: "Decimal", optional: false, defaultValue: "1.0000" },
    { name: "autoRollup", dbColumn: "autoRollup", type: "Boolean", optional: false, defaultValue: "true" },
    { name: "createdAt", dbColumn: "createdAt", type: "DateTime", optional: false, defaultValue: "now()" },
    { name: "deletedAt", dbColumn: "deletedAt", type: "DateTime", optional: true },
  ],
  relations: [
    { name: "projectGoal", toModel: "Goal", isList: false },
    { name: "feederGoal", toModel: "Goal", isList: false },
  ],
};

const ProjectProgressModel: ModelDef = {
  name: "ProjectProgress",
  table: "project_progress",
  group: "goals",
  softDelete: true,
  notes: "Append-only ledger. Project total progress is SUM(amount).",
  fields: [
    idField(),
    { name: "userId", dbColumn: "userId", type: "String", optional: false },
    { name: "projectGoalId", dbColumn: "projectGoalId", type: "String", optional: false },
    { name: "amount", dbColumn: "amount", type: "Decimal", optional: false },
    { name: "occurredOn", dbColumn: "occurredOn", type: "DateTime", optional: false, dbType: "Date" },
    { name: "source", dbColumn: "source", type: "String", optional: false, dbType: "VarChar(20)" },
    { name: "sourceAssignmentId", dbColumn: "sourceAssignmentId", type: "String", optional: true },
    { name: "note", dbColumn: "note", type: "String", optional: true, dbType: "Text" },
    { name: "createdAt", dbColumn: "createdAt", type: "DateTime", optional: false, defaultValue: "now()" },
    { name: "deletedAt", dbColumn: "deletedAt", type: "DateTime", optional: true },
  ],
  relations: [],
};

const UserGoalOrderModel: ModelDef = {
  name: "UserGoalOrder",
  table: "user_goal_order",
  group: "goals",
  softDelete: false,
  notes: "Per-user manual goal ordering.",
  fields: [
    { name: "userId", dbColumn: "userId", type: "String", optional: false, isId: true },
    { name: "goalId", dbColumn: "goalId", type: "String", optional: false, isId: true },
    { name: "sortOrder", dbColumn: "sortOrder", type: "Int", optional: false, defaultValue: "0" },
  ],
  relations: [],
};

const AdminEventModel: ModelDef = {
  name: "AdminEvent",
  table: "admin_events",
  group: "admin",
  softDelete: false,
  notes: "Append-only admin/auth event log.",
  fields: [
    idField(),
    { name: "type", dbColumn: "type", type: "String", optional: false, dbType: "VarChar(50)" },
    { name: "userEmail", dbColumn: "userEmail", type: "String", optional: true, dbType: "VarChar(320)" },
    { name: "details", dbColumn: "details", type: "String", optional: true, dbType: "Text" },
    { name: "createdAt", dbColumn: "createdAt", type: "DateTime", optional: false, defaultValue: "now()" },
    { name: "userId", dbColumn: "userId", type: "String", optional: true, fk: { toModel: "User", toField: "id", onDelete: "SetNull" } },
  ],
  relations: [{ name: "user", toModel: "User", isList: false }],
};

export const MODELS: ModelDef[] = [
  UserModel,
  AccountModel,
  SessionModel,
  VerificationTokenModel,
  UserPreferencesModel,
  HebcalDayCacheModel,
  GoalPresetModel,
  GoalModel,
  GoalActiveDayModel,
  GoalExclusionModel,
  GoalMilestoneModel,
  GoalPeriodModel,
  GoalStatusHistoryModel,
  AssignmentModel,
  GoalSuppressionModel,
  ProjectFeederModel,
  ProjectProgressModel,
  UserGoalOrderModel,
  AdminEventModel,
];

export const MODEL_BY_NAME = new Map<string, ModelDef>(
  MODELS.map((m) => [m.name, m]),
);

export const GROUP_LABELS: Record<ModelGroup, string> = {
  auth: "Auth & Identity",
  calendar: "Calendar Cache",
  goals: "Goals",
  assignments: "Assignments",
  admin: "Admin",
};

export const GROUP_COLORS: Record<ModelGroup, { bg: string; border: string; badge: string; header: string }> = {
  auth: { bg: "bg-blue-50", border: "border-blue-200", badge: "bg-blue-100 text-blue-700", header: "bg-blue-100 text-blue-800" },
  calendar: { bg: "bg-cyan-50", border: "border-cyan-200", badge: "bg-cyan-100 text-cyan-700", header: "bg-cyan-100 text-cyan-800" },
  goals: { bg: "bg-green-50", border: "border-green-200", badge: "bg-green-100 text-green-700", header: "bg-green-100 text-green-800" },
  assignments: { bg: "bg-purple-50", border: "border-purple-200", badge: "bg-purple-100 text-purple-700", header: "bg-purple-100 text-purple-800" },
  admin: { bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-100 text-orange-700", header: "bg-orange-100 text-orange-800" },
};
