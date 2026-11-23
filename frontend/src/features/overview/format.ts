import type { RiskCaseListItem, Severity, TrendPoint } from "@/api/types";

export const hasTrend = (t: TrendPoint[] | undefined) => !!t && t.length > 0;

const SEV_RANK: Record<Severity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};
const CLOSED = new Set(["RECOVERED", "CLOSED", "REJECTED"]);

/** Top-N open cases, most severe (then highest score) first. */
export function topOpenCases(
  cases: RiskCaseListItem[],
  n = 3,
): RiskCaseListItem[] {
  return cases
    .filter((c) => !CLOSED.has(c.status))
    .sort(
      (a, b) =>
        SEV_RANK[b.severity] - SEV_RANK[a.severity] ||
        b.risk_score - a.risk_score,
    )
    .slice(0, n);
}

/** Percent change first -> last of a trend, or undefined when not computable. */
export function trendDelta(
  t: TrendPoint[] | undefined,
): { pct: number; up: boolean } | undefined {
  if (!t || t.length < 2 || t[0].value === 0) return undefined;
  const pct =
    ((t[t.length - 1].value - t[0].value) / Math.abs(t[0].value)) * 100;
  return { pct: Math.abs(Math.round(pct)), up: pct >= 0 };
}
