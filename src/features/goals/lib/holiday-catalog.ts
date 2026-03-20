/** All supported exclusion categories (Layer 1 chips) */
export const HOLIDAY_CATEGORIES = [
  { key: "Yom Tov", label: "Yom Tov" },
  { key: "Erev Yom Tov", label: "Erev Yom Tov" },
  { key: "Chol HaMoed", label: "Chol HaMoed" },
  { key: "Rosh Chodesh", label: "Rosh Chodesh" },
  { key: "Major Fasts", label: "Major Fasts" },
  { key: "Minor Fasts", label: "Minor Fasts" },
  { key: "Erev Fasts", label: "Erev Fasts" },
  { key: "Chanukah", label: "Chanukah" },
] as const;

export type HolidayCategory = (typeof HOLIDAY_CATEGORIES)[number]["key"];

/** Individual holidays grouped for Layer 2 */
export interface HolidayItem {
  key: string;         // stable identifier used in goal.excludes.individual
  label: string;       // display name
  days?: number;       // optional day count shown in parentheses
  categories: string[]; // which categories include this item
}

export interface HolidayGroup {
  key: string;
  label: string;
  items: HolidayItem[];
}

export const HOLIDAY_GROUPS: HolidayGroup[] = [
  {
    key: "yomtov",
    label: "YOM TOV",
    items: [
      { key: "Rosh_Hashana", label: "Rosh Hashana", days: 2, categories: ["Yom Tov"] },
      { key: "Yom_Kippur", label: "Yom Kippur", categories: ["Yom Tov", "Major Fasts"] },
      { key: "Sukkos", label: "Sukkos", days: 2, categories: ["Yom Tov"] },
      { key: "Shmini_Atzeres", label: "Shmini Atzeres", categories: ["Yom Tov"] },
      { key: "Simchas_Torah", label: "Simchas Torah", categories: ["Yom Tov"] },
      { key: "Pesach", label: "Pesach", days: 2, categories: ["Yom Tov"] },
      { key: "Pesach_7", label: "7th day Pesach", categories: ["Yom Tov"] },
      { key: "Pesach_8", label: "8th day Pesach", categories: ["Yom Tov"] },
      { key: "Shavuos", label: "Shavuos", days: 2, categories: ["Yom Tov"] },
    ],
  },
  {
    key: "erev",
    label: "EREV YOM TOV",
    items: [
      { key: "Erev_Rosh_Hashana", label: "Erev Rosh Hashana", categories: ["Erev Yom Tov"] },
      { key: "Erev_Yom_Kippur", label: "Erev Yom Kippur", categories: ["Erev Yom Tov"] },
      { key: "Erev_Sukkos", label: "Erev Sukkos", categories: ["Erev Yom Tov"] },
      { key: "Erev_Pesach", label: "Erev Pesach", categories: ["Erev Yom Tov"] },
      { key: "Erev_Shavuos", label: "Erev Shavuos", categories: ["Erev Yom Tov"] },
    ],
  },
  {
    key: "cholhamoed",
    label: "CHOL HAMOED",
    items: [
      { key: "Chol_HaMoed_Pesach", label: "Chol HaMoed Pesach", days: 4, categories: ["Chol HaMoed"] },
      { key: "Chol_HaMoed_Sukkos", label: "Chol HaMoed Sukkos", days: 4, categories: ["Chol HaMoed"] },
    ],
  },
  {
    key: "fasts",
    label: "FAST DAYS",
    items: [
      { key: "Tisha_BAv", label: "Tisha B'Av", categories: ["Major Fasts"] },
      { key: "17_Tammuz", label: "17 Tammuz", categories: ["Minor Fasts"] },
      { key: "10_Tevet", label: "10 Tevet", categories: ["Minor Fasts"] },
      { key: "Fast_of_Gedaliah", label: "Fast of Gedaliah", categories: ["Minor Fasts"] },
      { key: "Fast_of_Esther", label: "Fast of Esther", categories: ["Minor Fasts"] },
      { key: "Erev_Tisha_BAv", label: "Erev Tisha B'Av", categories: ["Erev Fasts"] },
    ],
  },
  {
    key: "roshchodesh",
    label: "ROSH CHODESH",
    items: [
      { key: "Rosh_Chodesh_Nissan", label: "Nissan", categories: ["Rosh Chodesh"] },
      { key: "Rosh_Chodesh_Iyar", label: "Iyar", categories: ["Rosh Chodesh"] },
      { key: "Rosh_Chodesh_Sivan", label: "Sivan", categories: ["Rosh Chodesh"] },
      { key: "Rosh_Chodesh_Tammuz", label: "Tammuz", categories: ["Rosh Chodesh"] },
      { key: "Rosh_Chodesh_Av", label: "Av", categories: ["Rosh Chodesh"] },
      { key: "Rosh_Chodesh_Elul", label: "Elul", categories: ["Rosh Chodesh"] },
      { key: "Rosh_Chodesh_Tishrei", label: "Tishrei", categories: ["Rosh Chodesh"] },
      { key: "Rosh_Chodesh_Cheshvan", label: "Cheshvan", categories: ["Rosh Chodesh"] },
      { key: "Rosh_Chodesh_Kislev", label: "Kislev", categories: ["Rosh Chodesh"] },
      { key: "Rosh_Chodesh_Tevet", label: "Tevet", categories: ["Rosh Chodesh"] },
      { key: "Rosh_Chodesh_Shevat", label: "Shevat", categories: ["Rosh Chodesh"] },
      { key: "Rosh_Chodesh_Adar", label: "Adar", categories: ["Rosh Chodesh"] },
    ],
  },
  {
    key: "special",
    label: "SPECIAL DATES",
    items: [
      { key: "Chanukah", label: "Chanukah", days: 8, categories: ["Chanukah"] },
      { key: "Purim", label: "Purim / Shushan Purim", categories: [] },
      { key: "Tu_BShvat", label: "Tu B'Shvat", categories: [] },
      { key: "Lag_BaOmer", label: "Lag BaOmer", categories: [] },
    ],
  },
];

/** Get all individual holiday keys that belong to the given categories */
export function getIndividualKeysForCategories(categories: string[]): string[] {
  const keys: string[] = [];
  for (const group of HOLIDAY_GROUPS) {
    for (const item of group.items) {
      if (item.categories.some((c) => categories.includes(c))) {
        keys.push(item.key);
      }
    }
  }
  return keys;
}

/** Given a set of selected individual keys, return which categories are fully/partially selected */
export function getCategorySelectionState(
  individualKeys: string[],
  categories: string[],
): Record<string, "full" | "partial" | "none"> {
  const result: Record<string, "full" | "partial" | "none"> = {};
  for (const cat of categories) {
    const members = HOLIDAY_GROUPS.flatMap((g) =>
      g.items.filter((i) => i.categories.includes(cat)).map((i) => i.key),
    );
    if (members.length === 0) {
      result[cat] = "none";
      continue;
    }
    const selectedCount = members.filter((k) => individualKeys.includes(k)).length;
    if (selectedCount === 0) result[cat] = "none";
    else if (selectedCount === members.length) result[cat] = "full";
    else result[cat] = "partial";
  }
  return result;
}
