import type { Goal } from "../types/goal";

type DafMasechta = {
  name: string;
  blatt: number;
};

// Based on Hebcal's Daf Yomi cycle data so we can derive labels synchronously
// in both the app bundle and the CommonJS unit-test runner.
const DAF_YOMI_MASECHTOT: DafMasechta[] = [
  { name: "Berachot", blatt: 64 },
  { name: "Shabbat", blatt: 157 },
  { name: "Eruvin", blatt: 105 },
  { name: "Pesachim", blatt: 121 },
  { name: "Shekalim", blatt: 22 },
  { name: "Yoma", blatt: 88 },
  { name: "Sukkah", blatt: 56 },
  { name: "Beitzah", blatt: 40 },
  { name: "Rosh Hashana", blatt: 35 },
  { name: "Taanit", blatt: 31 },
  { name: "Megillah", blatt: 32 },
  { name: "Moed Katan", blatt: 29 },
  { name: "Chagigah", blatt: 27 },
  { name: "Yevamot", blatt: 122 },
  { name: "Ketubot", blatt: 112 },
  { name: "Nedarim", blatt: 91 },
  { name: "Nazir", blatt: 66 },
  { name: "Sotah", blatt: 49 },
  { name: "Gitin", blatt: 90 },
  { name: "Kiddushin", blatt: 82 },
  { name: "Baba Kamma", blatt: 119 },
  { name: "Baba Metzia", blatt: 119 },
  { name: "Baba Batra", blatt: 176 },
  { name: "Sanhedrin", blatt: 113 },
  { name: "Makkot", blatt: 24 },
  { name: "Shevuot", blatt: 49 },
  { name: "Avodah Zarah", blatt: 76 },
  { name: "Horayot", blatt: 14 },
  { name: "Zevachim", blatt: 120 },
  { name: "Menachot", blatt: 110 },
  { name: "Chullin", blatt: 142 },
  { name: "Bechorot", blatt: 61 },
  { name: "Arachin", blatt: 34 },
  { name: "Temurah", blatt: 34 },
  { name: "Keritot", blatt: 28 },
  { name: "Meilah", blatt: 22 },
  { name: "Kinnim", blatt: 4 },
  { name: "Tamid", blatt: 9 },
  { name: "Midot", blatt: 5 },
  { name: "Niddah", blatt: 73 },
];

const OLD_CYCLE_START_ABS = gregorianDateToAbs(1923, 8, 11);
const NEW_CYCLE_START_ABS = gregorianDateToAbs(1975, 5, 24);

export function getGoalProgramLabel(
  goal: Pick<Goal, "programKey" | "startDate" | "endDate">,
  date: Date,
): string | null {
  switch (goal.programKey) {
    case "daf-yomi":
      return getDafYomiLabel(date);
    case "omer":
      return getOmerLabel(goal, date);
    default:
      return null;
  }
}

function getDafYomiLabel(date: Date): string | null {
  try {
    const absDate = dateToAbs(date);
    if (absDate < OLD_CYCLE_START_ABS) return null;

    let cycleNumber: number;
    let dayOffset: number;
    if (absDate >= NEW_CYCLE_START_ABS) {
      cycleNumber = 8 + Math.floor((absDate - NEW_CYCLE_START_ABS) / 2711);
      dayOffset = (absDate - NEW_CYCLE_START_ABS) % 2711;
    } else {
      cycleNumber = 1 + Math.floor((absDate - OLD_CYCLE_START_ABS) / 2702);
      dayOffset = (absDate - OLD_CYCLE_START_ABS) % 2702;
    }

    const masechtot =
      cycleNumber <= 7
        ? DAF_YOMI_MASECHTOT.map((entry, index) =>
            index === 4 ? { ...entry, blatt: 13 } : entry,
          )
        : DAF_YOMI_MASECHTOT;

    const daf = findDafYomiPage(masechtot, dayOffset);
    return daf ? `${daf.name} ${daf.blatt}` : null;
  } catch {
    return null;
  }
}

function findDafYomiPage(masechtot: DafMasechta[], dayOffset: number): DafMasechta | null {
  let total = 0;
  for (let index = 0; index < masechtot.length; index++) {
    total += masechtot[index].blatt - 1;
    if (dayOffset >= total) continue;

    let blatt = masechtot[index].blatt + 1 - (total - dayOffset);
    switch (index) {
      case 36:
        blatt += 21;
        break;
      case 37:
        blatt += 24;
        break;
      case 38:
        blatt += 32;
        break;
      default:
        break;
    }
    return { name: masechtot[index].name, blatt };
  }
  return null;
}

function dateToAbs(date: Date): number {
  return gregorianDateToAbs(date.getFullYear(), date.getMonth(), date.getDate());
}

function gregorianDateToAbs(year: number, monthIndex: number, day: number): number {
  return Math.floor(Date.UTC(year, monthIndex, day) / 86_400_000);
}

function getOmerLabel(
  goal: Pick<Goal, "startDate" | "endDate">,
  date: Date,
): string | null {
  if (!goal.startDate) return null;

  const dateIso = toIsoDate(date);
  if (dateIso < goal.startDate) return null;
  if (goal.endDate && dateIso > goal.endDate) return null;

  const start = parseIsoDate(goal.startDate);
  if (!start) return null;

  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = target.getTime() - start.getTime();
  const dayNumber = Math.floor(diffMs / 86_400_000) + 1;
  if (dayNumber < 1) return null;
  return `Day ${dayNumber} of Omer`;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}
