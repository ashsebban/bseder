import type { MinyanOccurrence, Prayer } from "@/features/shuls/types/minyan";
import type { Nusach } from "@/features/settings/types/calendar-preferences";

export interface GoDavenV2Shul {
  id: number;
  name: string;
  formatted_address: string;
  phone?: string | null;
  nusach?: string;
  rabbi?: string;
  distance: number;
  location_point: { type: string; coordinates: [number, number] }; // [lng, lat]
  todays_time: string; // "HH:MM:SS"
  type: string;        // "shachris" | "shacharis" | "mincha" | "mariv"
}

export interface GoDavenV2Response {
  total: number;
  num_of_pages: number;
  shuls: GoDavenV2Shul[];
}

function mapNusach(raw: string | undefined): Nusach {
  if (!raw) return "ashkenaz";
  const n = raw.toLowerCase().trim();
  if (n === "sefard" || n.includes("sfard") || n.includes("chassid") || n.includes("hasid")) return "sfard";
  if (n.includes("sephardi") || n.includes("sephardic") || n.includes("mizra")) return "sephardi";
  if (n.includes("chabad") || n.includes("lubavitch")) return "chabad";
  if (n.includes("temani") || n.includes("yemenite")) return "temanim";
  return "ashkenaz";
}

function mapPrayer(type: string): Prayer {
  const normalized = type.toLowerCase().trim();
  if (normalized === "mincha") return "mincha";
  if (normalized === "mariv" || normalized === "maariv") return "maariv";
  return "shacharit";
}

function formatPhone(raw: string | null | undefined): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw.trim() || undefined;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function parseTimeMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function parseGoDavenV2Response(
  data: GoDavenV2Response,
  nowMins: number, // minutes since midnight at user's local time
): MinyanOccurrence[] {
  return data.shuls
    .filter((s) => s.location_point?.coordinates?.length === 2)
    .map((s): MinyanOccurrence => {
      const [lng, lat] = s.location_point.coordinates;
      const prayer = mapPrayer(s.type);
      const time = s.todays_time.slice(0, 5); // "HH:MM"
      const timeMins = parseTimeMins(time);

      // Handle Maariv midnight wrap-around: a time like 12:00 AM (0 mins)
      // when it's 9 PM (1260 mins) appears deeply past but is actually
      // next-day late Maariv. Do not apply this to Shacharit/Mincha; when
      // viewing a full day, their earlier times should remain past.
      let minutesUntil = timeMins - nowMins;
      if (prayer === "maariv" && minutesUntil < -(12 * 60)) minutesUntil += 24 * 60;

      return {
        key: `${s.id}-${prayer}-${time}`,
        shulId: String(s.id),
        shulName: titleCase(s.name),
        address: s.formatted_address,
        lat: lat!,
        lng: lng!,
        nusach: mapNusach(s.nusach),
        phone: formatPhone(s.phone),
        rabbi: s.rabbi || undefined,
        prayer,
        time,
        distanceMiles: s.distance,
        minutesUntil,
      };
    });
}
