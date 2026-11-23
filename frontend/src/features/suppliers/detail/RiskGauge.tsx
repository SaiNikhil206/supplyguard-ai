import type { RiskLevel } from "@/api/types";
import { cn } from "@/lib/utils";
import { LEVEL_BAR } from "../list/risk";

/** 0-100 risk score as a bullet/progress bar with number, exposed as an accessible meter. */
export function RiskGauge({
  score,
  level,
}: {
  score: number;
  level: RiskLevel;
}) {
  const v = Math.max(0, Math.min(100, score));
  return (
    <div
      role="meter"
      aria-label="Risk score"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      aria-valuetext={`${v} out of 100`}
      className="w-full min-w-[12rem] max-w-xs"
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        Risk score
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          aria-hidden="true"
          className="text-3xl font-semibold tabular-nums tracking-tight"
        >
          {v}
        </span>
        <span aria-hidden="true" className="text-sm text-muted">
          / 100
        </span>
      </div>
      <div
        aria-hidden="true"
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className={cn("h-full rounded-full", LEVEL_BAR[level])}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}
