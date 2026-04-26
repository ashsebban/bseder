/**
 * Prebuilt goal definitions — the full library of ready-made Jewish goals.
 *
 * Each definition has:
 *  - a stable reserved `id` (matched in DEFAULT_FIXED_GOAL_IDS → lockInDays auto-applied)
 *  - a `category` for tab/filter UI
 *  - a `buildGoal` factory (or `addAction` for preference-based goals like Omer)
 *
 * Bundles group several prebuilt goals into curated multi-goal packs.
 */

import { HDate, months } from "@hebcal/core";
import { toIsoDate } from "@/lib/date";
import { OMER_GOAL_ID, buildPersistedOmerGoal } from "@/features/calendar/lib/omer-goal";
import type { Goal } from "@/features/goals/types/goal";
import type { PackAddContext } from "@/features/goals/lib/packs/types";

export type { PackAddContext };

// ─── Categories ──────────────────────────────────────────────────────────────

export type PrebuiltCategory =
  | "Tefila"
  | "Learning"
  | "Jewish Calendar"
  | "Shabbos"
  | "Tzedakah & Chesed"
  | "Mitzvot"
  | "Growth";

export const PREBUILT_CATEGORY_ORDER: PrebuiltCategory[] = [
  "Tefila",
  "Learning",
  "Jewish Calendar",
  "Shabbos",
  "Tzedakah & Chesed",
  "Mitzvot",
  "Growth",
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PrebuiltGoalDef {
  /** Stable reserved ID — also used for active-state detection */
  id: string;
  category: PrebuiltCategory;
  name: string;
  /** Short description shown on the goal card */
  tagline: string;
  emoji: string;
  /** Build a Goal object from today's date. undefined = use addAction instead */
  buildGoal?: (today: Date) => Goal;
  /** For preference-based activation (e.g. Omer) */
  addAction?: (ctx: PackAddContext) => void;
  /** For preference-based removal; if undefined, goal is deleted by id */
  removeAction?: (ctx: PackAddContext) => void;
}

export interface Bundle {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  goalIds: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

function getChanukahRange(today: Date): { startDate: string; endDate: string } {
  let year = new HDate(today).getFullYear();
  if (new HDate(3, months.TEVET, year).greg() < today) year++;
  return {
    startDate: toIsoDate(new HDate(25, months.KISLEV, year).greg()),
    endDate: toIsoDate(new HDate(3, months.TEVET, year).greg()),
  };
}

function getElulRange(today: Date, endDay: 28 | 29 = 29): { startDate: string; endDate: string } {
  let year = new HDate(today).getFullYear();
  if (new HDate(endDay, months.ELUL, year).greg() < today) year++;
  return {
    startDate: toIsoDate(new HDate(1, months.ELUL, year).greg()),
    endDate: toIsoDate(new HDate(endDay, months.ELUL, year).greg()),
  };
}

function getSukkotRange(today: Date): { startDate: string; endDate: string } {
  let year = new HDate(today).getFullYear();
  if (new HDate(21, months.TISHREI, year).greg() < today) year++;
  return {
    startDate: toIsoDate(new HDate(15, months.TISHREI, year).greg()),
    endDate: toIsoDate(new HDate(21, months.TISHREI, year).greg()),
  };
}

function getUpcomingDate(hDay: number, hMonth: number, today: Date): string {
  let year = new HDate(today).getFullYear();
  let d = new HDate(hDay, hMonth, year).greg();
  if (d < today) {
    year++;
    d = new HDate(hDay, hMonth, year).greg();
  }
  return toIsoDate(d);
}

function getPurimRange(today: Date): { startDate: string; endDate: string } {
  let year = new HDate(today).getFullYear();
  for (let attempt = 0; attempt < 3; attempt++) {
    let purimGreg: Date | null = null;
    for (const adarMonth of [months.ADAR_II, months.ADAR_I]) {
      try {
        const g = new HDate(14, adarMonth, year).greg();
        if (g >= today) { purimGreg = g; break; }
      } catch { /* month doesn't exist this year */ }
    }
    if (purimGreg) {
      const start = new Date(purimGreg);
      start.setDate(start.getDate() - 7);
      return { startDate: toIsoDate(start), endDate: toIsoDate(purimGreg) };
    }
    year++;
  }
  return { startDate: "2027-03-16", endDate: "2027-03-23" };
}

// ─── Runtime identity helpers ─────────────────────────────────────────────────

/** True if the goal was added from the prebuilt library (detected by reserved ID). */
export function isPrebuiltGoal(id: string): boolean {
  return PREBUILT_GOAL_BY_ID.has(id);
}

/**
 * True if the goal originated as a prebuilt but the user has renamed it.
 * Used to show a "Custom" badge instead of "Official".
 */
export function isCustomizedPrebuilt(goal: { id: string; title: string }): boolean {
  const def = PREBUILT_GOAL_BY_ID.get(goal.id);
  if (!def) return false;
  return goal.title !== def.name;
}

// ─── Goal definitions ─────────────────────────────────────────────────────────

export const PREBUILT_GOALS: PrebuiltGoalDef[] = [
  // ── Tefila ────────────────────────────────────────────────────────────────

  {
    id: "__pack_tefillin__",
    category: "Tefila",
    name: "Tefillin",
    tagline: "Daily · Sun–Fri · Misheyakir–Shkiyah",
    emoji: "🕍",
    buildGoal: (today) => ({
      id: "__pack_tefillin__",
      title: "Tefillin",
      cadence: "daily",
      status: "ongoing",
      type: "binary",
      activeDays: WEEKDAYS,
      excludes: { categories: ["Yom Tov", "Chol HaMoed"] },
      startsAt: "Misheyakir",
      expiresAt: "Shkiyah",
      lockInDays: true,
      ifUnfinished: "kill-streak",
      startDate: toIsoDate(today),
      completedDates: [],
    }),
  },

  {
    id: "__pack_shacharis__",
    category: "Tefila",
    name: "Shacharis",
    tagline: "Daily · all 7 days · Alot–Chatzot",
    emoji: "🌅",
    buildGoal: (today) => ({
      id: "__pack_shacharis__",
      title: "Shacharis",
      cadence: "daily",
      status: "ongoing",
      type: "binary",
      activeDays: ALL_DAYS,
      startsAt: "Alot HaShachar",
      expiresAt: "Chatzot",
      lockInDays: true,
      ifUnfinished: "forgive",
      startDate: toIsoDate(today),
      completedDates: [],
    }),
  },

  {
    id: "__pack_shema_morning__",
    category: "Tefila",
    name: "Shema (Morning)",
    tagline: "Daily · all 7 days · Alot–Sof Zman Shema",
    emoji: "🕯️",
    buildGoal: (today) => ({
      id: "__pack_shema_morning__",
      title: "Shema (Morning)",
      cadence: "daily",
      status: "ongoing",
      type: "binary",
      activeDays: ALL_DAYS,
      startsAt: "Alot HaShachar",
      expiresAt: "Sof Zman Shema",
      lockInDays: true,
      ifUnfinished: "forgive",
      startDate: toIsoDate(today),
      completedDates: [],
    }),
  },

  {
    id: "__pack_mincha__",
    category: "Tefila",
    name: "Mincha",
    tagline: "Daily · all 7 days · Mincha Gedola–Shkiyah",
    emoji: "☀️",
    buildGoal: (today) => ({
      id: "__pack_mincha__",
      title: "Mincha",
      cadence: "daily",
      status: "ongoing",
      type: "binary",
      activeDays: ALL_DAYS,
      startsAt: "Mincha Gedola",
      expiresAt: "Shkiyah",
      lockInDays: true,
      ifUnfinished: "forgive",
      startDate: toIsoDate(today),
      completedDates: [],
    }),
  },

  {
    id: "__pack_maariv__",
    category: "Tefila",
    name: "Maariv",
    tagline: "Daily · all 7 days · Tzais–Alot",
    emoji: "🌙",
    buildGoal: (today) => ({
      id: "__pack_maariv__",
      title: "Maariv",
      cadence: "daily",
      status: "ongoing",
      type: "binary",
      activeDays: ALL_DAYS,
      startsAt: "Tzais HaKochavim",
      expiresAt: "Alot HaShachar",
      lockInDays: true,
      ifUnfinished: "forgive",
      startDate: toIsoDate(today),
      completedDates: [],
    }),
  },

  {
    id: "__pack_shema_night__",
    category: "Tefila",
    name: "Shema (Night)",
    tagline: "Daily · all 7 days · Tzais–Chatzot",
    emoji: "✨",
    buildGoal: (today) => ({
      id: "__pack_shema_night__",
      title: "Shema (Night)",
      cadence: "daily",
      status: "ongoing",
      type: "binary",
      activeDays: ALL_DAYS,
      startsAt: "Tzais HaKochavim",
      expiresAt: "Alot HaShachar",
      lockInDays: true,
      ifUnfinished: "forgive",
      startDate: toIsoDate(today),
      completedDates: [],
    }),
  },

  // ── Learning ───────────────────────────────────────────────────────────────

  {
    id: "__pack_daf_yomi__",
    category: "Learning",
    name: "Daf Yomi",
    tagline: "Daily · all 7 days · current daf auto-detected",
    emoji: "📖",
    buildGoal: (today) => ({
      id: "__pack_daf_yomi__",
      title: "Daf Yomi",
      cadence: "daily",
      status: "ongoing",
      type: "binary",
      activeDays: ALL_DAYS,
      lockInDays: true,
      ifUnfinished: "backlog",
      programKey: "daf-yomi",
      startDate: toIsoDate(today),
      completedDates: [],
    }),
  },

  {
    id: "__pre_shnayim_mikrah__",
    category: "Learning",
    name: "Shnayim Mikrah",
    tagline: "Weekly · 7 aliyas · read each twice + Targum",
    emoji: "📜",
    buildGoal: (_today) => ({
      id: "__pre_shnayim_mikrah__",
      title: "Shnayim Mikrah",
      cadence: "weekly",
      status: "ongoing",
      type: "quantified",
      target: 7,
      targetUnit: "aliyas",
      ifUnfinished: "forgive",
    }),
  },

  {
    id: "__pre_tehillim__",
    category: "Learning",
    name: "Tehillim",
    tagline: "Weekly · recite Tehillim",
    emoji: "🙏",
    buildGoal: (_today) => ({
      id: "__pre_tehillim__",
      title: "Tehillim",
      cadence: "weekly",
      status: "ongoing",
      type: "binary",
      ifUnfinished: "forgive",
    }),
  },

  // ── Jewish Calendar ────────────────────────────────────────────────────────

  {
    id: OMER_GOAL_ID,
    category: "Jewish Calendar",
    name: "Sefirat HaOmer",
    tagline: "Nightly · 49 nights from 2nd night of Pesach · auto-dates",
    emoji: "🌾",
    buildGoal: (today) => buildPersistedOmerGoal(today),
  },

  {
    id: "__pack_chanukah__",
    category: "Jewish Calendar",
    name: "Chanukah Candles",
    tagline: "Nightly · 8 nights · Shkiyah · auto-dates",
    emoji: "🕎",
    buildGoal: (today) => {
      const { startDate, endDate } = getChanukahRange(today);
      return {
        id: "__pack_chanukah__",
        title: "Chanukah Candles",
        cadence: "daily",
        status: "ongoing",
        type: "binary",
        activeDays: ALL_DAYS,
        startsAt: "Shkiyah",
        expiresAt: "Alot HaShachar",
        lockInDays: true,
        ifUnfinished: "forgive",
        startDate,
        endDate,
        completedDates: [],
      };
    },
  },

  {
    id: "__pack_elul_selichot__",
    category: "Jewish Calendar",
    name: "Elul Selichot",
    tagline: "Daily · 1–29 Elul · Sephardi minhag · auto-dates",
    emoji: "🤲",
    buildGoal: (today) => {
      const { startDate, endDate } = getElulRange(today, 29);
      return {
        id: "__pack_elul_selichot__",
        title: "Elul Selichot",
        cadence: "daily",
        status: "ongoing",
        type: "binary",
        activeDays: ALL_DAYS,
        lockInDays: true,
        ifUnfinished: "forgive",
        startDate,
        endDate,
        completedDates: [],
      };
    },
  },

  {
    id: "__pre_arba_minim__",
    category: "Jewish Calendar",
    name: "Shake Arba Minim",
    tagline: "Daily · 7 days of Sukkot · auto-dates",
    emoji: "🌿",
    buildGoal: (today) => {
      const { startDate, endDate } = getSukkotRange(today);
      return {
        id: "__pre_arba_minim__",
        title: "Shake Arba Minim",
        cadence: "daily",
        status: "ongoing",
        type: "binary",
        activeDays: ALL_DAYS,
        lockInDays: true,
        ifUnfinished: "forgive",
        startDate,
        endDate,
        completedDates: [],
      };
    },
  },

  {
    id: "__pre_mishloach_manot__",
    category: "Jewish Calendar",
    name: "Mishloach Manot",
    tagline: "Seasonal · send food gifts on Purim",
    emoji: "🎁",
    buildGoal: (today) => {
      const { endDate } = getPurimRange(today);
      return {
        id: "__pre_mishloach_manot__",
        title: "Mishloach Manot",
        cadence: "daily",
        status: "ongoing",
        type: "binary",
        ifUnfinished: "forgive",
        startDate: endDate,  // only appears on Purim day itself
        endDate,
        completedDates: [],
      };
    },
  },

  // ── Shabbos ────────────────────────────────────────────────────────────────

  {
    id: "__pre_candles__",
    category: "Shabbos",
    name: "Hadlakat Neirot",
    tagline: "Weekly · Friday · before Shkiyah",
    emoji: "🕯️",
    buildGoal: (_today) => ({
      id: "__pre_candles__",
      title: "Hadlakat Neirot",
      cadence: "weekly",
      status: "ongoing",
      type: "binary",
      activeDays: ["Fri"],
      startsAt: "Plag HaMincha",
      expiresAt: "Shkiyah",
      lockInDays: true,
      ifUnfinished: "forgive",
    }),
  },

  {
    id: "__pre_havdalah__",
    category: "Shabbos",
    name: "Havdalah",
    tagline: "Weekly · Saturday night · after Tzais",
    emoji: "🌟",
    buildGoal: (_today) => ({
      id: "__pre_havdalah__",
      title: "Havdalah",
      cadence: "weekly",
      status: "ongoing",
      type: "binary",
      activeDays: ["Sat"],
      startsAt: "Tzais HaKochavim",
      lockInDays: true,
      ifUnfinished: "forgive",
    }),
  },

  // ── Tzedakah & Chesed ─────────────────────────────────────────────────────

  {
    id: "__pre_maaser__",
    category: "Tzedakah & Chesed",
    name: "Give Maaser",
    tagline: "Monthly · give 10% of income",
    emoji: "💰",
    buildGoal: (_today) => ({
      id: "__pre_maaser__",
      title: "Give Maaser",
      cadence: "monthly",
      status: "ongoing",
      type: "binary",
      ifUnfinished: "forgive",
    }),
  },

  {
    id: "__pre_tzedakah_daily__",
    category: "Tzedakah & Chesed",
    name: "Daily Tzedakah",
    tagline: "Daily · give tzedakah every day",
    emoji: "🪙",
    buildGoal: (today) => ({
      id: "__pre_tzedakah_daily__",
      title: "Daily Tzedakah",
      cadence: "daily",
      status: "ongoing",
      type: "binary",
      activeDays: WEEKDAYS,
      ifUnfinished: "forgive",
      startDate: toIsoDate(today),
      completedDates: [],
    }),
  },

  {
    id: "__pre_volunteer__",
    category: "Tzedakah & Chesed",
    name: "Volunteer / Chesed",
    tagline: "Monthly · perform an act of chesed",
    emoji: "🤝",
    buildGoal: (_today) => ({
      id: "__pre_volunteer__",
      title: "Volunteer / Chesed",
      cadence: "monthly",
      status: "ongoing",
      type: "binary",
      ifUnfinished: "forgive",
    }),
  },

  {
    id: "__pre_bikur_cholim__",
    category: "Tzedakah & Chesed",
    name: "Bikur Cholim",
    tagline: "Monthly · visit the sick",
    emoji: "🏥",
    buildGoal: (_today) => ({
      id: "__pre_bikur_cholim__",
      title: "Bikur Cholim",
      cadence: "monthly",
      status: "ongoing",
      type: "binary",
      ifUnfinished: "forgive",
    }),
  },

  {
    id: "__pre_hachnasas_orchim__",
    category: "Tzedakah & Chesed",
    name: "Hachnasas Orchim",
    tagline: "Monthly · invite guests to your table",
    emoji: "🏡",
    buildGoal: (_today) => ({
      id: "__pre_hachnasas_orchim__",
      title: "Hachnasas Orchim",
      cadence: "monthly",
      status: "ongoing",
      type: "binary",
      ifUnfinished: "forgive",
    }),
  },

  // ── Mitzvot ───────────────────────────────────────────────────────────────

  {
    id: "__pre_mezuzot__",
    category: "Mitzvot",
    name: "Check Mezuzot",
    tagline: "Yearly · have mezuzot checked by a sofer",
    emoji: "🚪",
    buildGoal: (_today) => ({
      id: "__pre_mezuzot__",
      title: "Check Mezuzot",
      cadence: "yearly",
      status: "ongoing",
      type: "binary",
      ifUnfinished: "forgive",
    }),
  },

  {
    id: "__pre_lulav_esrog__",
    category: "Mitzvot",
    name: "Buy Lulav & Esrog",
    tagline: "Yearly · before Sukkot",
    emoji: "🍋",
    buildGoal: (today) => ({
      id: "__pre_lulav_esrog__",
      title: "Buy Lulav & Esrog",
      cadence: "one-time",
      status: "ongoing",
      type: "binary",
      dueDate: getUpcomingDate(13, months.TISHREI, today),
    }),
  },

  {
    id: "__pre_high_holiday_seats__",
    category: "Mitzvot",
    name: "Book High Holiday Seats",
    tagline: "Yearly · book shul seats before Rosh Hashana",
    emoji: "🎟️",
    buildGoal: (today) => ({
      id: "__pre_high_holiday_seats__",
      title: "Book High Holiday Seats",
      cadence: "one-time",
      status: "ongoing",
      type: "binary",
      dueDate: getUpcomingDate(1, months.ELUL, today),
    }),
  },

  {
    id: "__pack_kotel__",
    category: "Mitzvot",
    name: "40-Day Kotel Challenge",
    tagline: "Daily · 40-day streak at the Kotel",
    emoji: "🪨",
    buildGoal: (today) => ({
      id: "__pack_kotel__",
      title: "40-Day Kotel Challenge",
      cadence: "daily",
      status: "ongoing",
      type: "binary",
      activeDays: ALL_DAYS,
      endAfterPeriods: 40,
      ifUnfinished: "kill-streak",
      startDate: toIsoDate(today),
      completedDates: [],
    }),
  },

  // ── Growth ────────────────────────────────────────────────────────────────

  {
    id: "__pre_mussar__",
    category: "Growth",
    name: "Daily Mussar",
    tagline: "Daily · character refinement study",
    emoji: "📓",
    buildGoal: (today) => ({
      id: "__pre_mussar__",
      title: "Daily Mussar",
      cadence: "daily",
      status: "ongoing",
      type: "binary",
      activeDays: ALL_DAYS,
      ifUnfinished: "forgive",
      startDate: toIsoDate(today),
      completedDates: [],
    }),
  },

  {
    id: "__pre_cheshbon_nefesh__",
    category: "Growth",
    name: "Cheshbon HaNefesh",
    tagline: "Weekly · personal spiritual accounting",
    emoji: "🧠",
    buildGoal: (_today) => ({
      id: "__pre_cheshbon_nefesh__",
      title: "Cheshbon HaNefesh",
      cadence: "weekly",
      status: "ongoing",
      type: "binary",
      ifUnfinished: "forgive",
    }),
  },

  {
    id: "__pre_gratitude__",
    category: "Growth",
    name: "Modeh Ani Focus",
    tagline: "Daily · mindful gratitude on waking",
    emoji: "🌄",
    buildGoal: (today) => ({
      id: "__pre_gratitude__",
      title: "Modeh Ani Focus",
      cadence: "daily",
      status: "ongoing",
      type: "binary",
      activeDays: ALL_DAYS,
      startsAt: "Alot HaShachar",
      expiresAt: "Chatzot",
      ifUnfinished: "forgive",
      startDate: toIsoDate(today),
      completedDates: [],
    }),
  },

  {
    id: "__pre_chafetz_chaim__",
    category: "Growth",
    name: "Chafetz Chaim Daily",
    tagline: "Daily · daily portion from Sefer Chafetz Chaim",
    emoji: "🤐",
    buildGoal: (today) => ({
      id: "__pre_chafetz_chaim__",
      title: "Chafetz Chaim Daily",
      cadence: "daily",
      status: "ongoing",
      type: "binary",
      activeDays: ALL_DAYS,
      ifUnfinished: "backlog",
      startDate: toIsoDate(today),
      completedDates: [],
    }),
  },
];

// ─── Lookup map ────────────────────────────────────────────────────────────────

export const PREBUILT_GOAL_BY_ID: Map<string, PrebuiltGoalDef> = new Map(
  PREBUILT_GOALS.map((g) => [g.id, g]),
);

// ─── Bundles ──────────────────────────────────────────────────────────────────

export const BUNDLES: Bundle[] = [
  {
    id: "bundle_shema_daily",
    name: "Shema Daily",
    tagline: "Morning and night Shema — the foundation",
    emoji: "🕯️",
    goalIds: ["__pack_shema_morning__", "__pack_shema_night__"],
  },
  {
    id: "bundle_full_davening",
    name: "Full Davening",
    tagline: "Complete three-tefila day — Shacharis, Mincha, Maariv + Shema",
    emoji: "🌅",
    goalIds: [
      "__pack_shacharis__",
      "__pack_shema_morning__",
      "__pack_mincha__",
      "__pack_maariv__",
      "__pack_shema_night__",
    ],
  },
  {
    id: "bundle_tefillin_shacharis",
    name: "Tefillin & Shacharis",
    tagline: "Morning mitzvot — Tefillin, Shacharis, and Shema",
    emoji: "🕍",
    goalIds: ["__pack_tefillin__", "__pack_shacharis__", "__pack_shema_morning__"],
  },
  {
    id: "bundle_shabbos",
    name: "Shabbos Pack",
    tagline: "Candles and Havdalah — bookend Shabbos",
    emoji: "🕯️",
    goalIds: ["__pre_candles__", "__pre_havdalah__"],
  },
  {
    id: "bundle_chesed",
    name: "Chesed Bundle",
    tagline: "Maaser, volunteering, and visiting the sick",
    emoji: "🤝",
    goalIds: ["__pre_maaser__", "__pre_volunteer__", "__pre_bikur_cholim__"],
  },
  {
    id: "bundle_sukkot",
    name: "Sukkot Pack",
    tagline: "Buy your Daled Minim and shake them all 7 days",
    emoji: "🌿",
    goalIds: ["__pre_lulav_esrog__", "__pre_arba_minim__"],
  },
];
