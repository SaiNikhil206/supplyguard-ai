import type { RiskLevel, Supplier } from "@/api/types";

export const LEVEL_BAR: Record<RiskLevel, string> = {
  LOW: "bg-sev-low",
  MEDIUM: "bg-sev-medium",
  HIGH: "bg-sev-high",
  CRITICAL: "bg-sev-critical",
};

export function initials(name: string): string {
  const parts = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

const FLAGS: Record<string, string> = {
  india: "🇮🇳",
  china: "🇨🇳",
  germany: "🇩🇪",
  usa: "🇺🇸",
  "united states": "🇺🇸",
  japan: "🇯🇵",
  vietnam: "🇻🇳",
  taiwan: "🇹🇼",
  "south korea": "🇰🇷",
  mexico: "🇲🇽",
  "united kingdom": "🇬🇧",
  uk: "🇬🇧",
  france: "🇫🇷",
  italy: "🇮🇹",
  thailand: "🇹🇭",
  indonesia: "🇮🇩",
  brazil: "🇧🇷",
  turkey: "🇹🇷",
  poland: "🇵🇱",
  singapore: "🇸🇬",
  malaysia: "🇲🇾",
};

export const flagFor = (country: string): string =>
  FLAGS[country.trim().toLowerCase()] ?? "🌐";

/** Count of suppliers per risk level. */
export function countByLevel(
  suppliers: Supplier[] | undefined,
): Record<RiskLevel, number> {
  const out: Record<RiskLevel, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };
  for (const s of suppliers ?? []) out[s.risk_level] += 1;
  return out;
}
