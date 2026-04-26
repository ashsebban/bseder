export type ObservanceLevel = "shabbos" | "not-shabbos" | "mixed" | "unknown";
export type HavdalahOpinion = "tzeit-8_5" | "42" | "50" | "72";

export function deriveDefaultActiveDays(level: ObservanceLevel): string[] {
  if (level === "shabbos") return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
}
