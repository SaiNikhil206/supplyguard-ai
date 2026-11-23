import type { ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Spinner";

/** Kept for API compatibility. v2 uses one accent: only the sparkline stroke varies, by semantic tone. */
export type StatTone =
  "primary" | "emerald" | "amber" | "orange" | "rose" | "violet" | "sky";

const STROKE: Record<StatTone, string> = {
  primary: "hsl(var(--primary))",
  sky: "hsl(var(--primary))",
  violet: "hsl(var(--primary))",
  emerald: "hsl(var(--success))",
  amber: "hsl(var(--warning))",
  orange: "hsl(var(--sev-high))",
  rose: "hsl(var(--danger))",
};

export interface StatDelta {
  value: string;
  direction: "up" | "down";
  /** Whether the change is good or bad for the business. */
  tone: "good" | "bad" | "neutral";
}

/** v2: no count-up animation; renders the final value. Kept as an export for existing callers. */
export function CountUp({ value }: { value: number; duration?: number }) {
  return <>{value}</>;
}

export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Accepted for API compatibility; v2 stat cards carry no icon squares, so it is not rendered. */
  icon?: ReactNode;
  tone?: StatTone;
  delta?: StatDelta;
  hint?: string;
  /** Real numeric series for a thin sparkline. Omit when there is no backing history. */
  trend?: number[];
  loading?: boolean;
  className?: string;
}

const deltaClass = {
  good: "text-success",
  bad: "text-danger",
  neutral: "text-muted",
} as const;

export function StatCard({
  label,
  value,
  tone = "primary",
  delta,
  hint,
  trend,
  loading,
  className,
}: StatCardProps) {
  const stroke = STROKE[tone];
  return (
    <div
      aria-busy={loading || undefined}
      className={cn("rounded-lg border border-border bg-card p-5", className)}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      {loading ? (
        <div data-testid="kpi-skeleton" className="mt-3 space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      ) : (
        <>
          <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {value}
          </div>
          {(delta || hint) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {delta && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-medium",
                    deltaClass[delta.tone],
                  )}
                >
                  {delta.direction === "up" ? (
                    <ArrowUp
                      aria-hidden="true"
                      className="h-3 w-3"
                      strokeWidth={1.75}
                    />
                  ) : (
                    <ArrowDown
                      aria-hidden="true"
                      className="h-3 w-3"
                      strokeWidth={1.75}
                    />
                  )}
                  {delta.value}
                  <span className="sr-only">
                    {delta.direction === "up" ? " increase" : " decrease"}
                  </span>
                </span>
              )}
              {hint && <span className="text-muted">{hint}</span>}
            </div>
          )}
          {trend && trend.length > 1 && (
            <div aria-hidden="true" className="mt-3 h-9">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trend.map((v, i) => ({ i, v }))}
                  margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
                >
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={stroke}
                    strokeWidth={1.5}
                    fill={stroke}
                    fillOpacity={0.08}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
