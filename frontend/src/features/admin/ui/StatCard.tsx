import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Accepted for API compatibility; v2 stat cards have no tinted icon squares. */
export type Tint = "primary" | "emerald" | "amber" | "orange" | "rose" | "violet";

/** v2 stat card: uppercase label, big tabular number, hint text. No icon tile. */
export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tint?: Tint;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </div>
      {hint && <div className="mt-1.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}
