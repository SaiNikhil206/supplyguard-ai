import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TINT = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
} as const;
export type Tint = keyof typeof TINT;

export function IconTile({
  tint = "primary",
  children,
  className,
}: {
  tint?: Tint;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-xl [&_svg]:h-5 [&_svg]:w-5",
        TINT[tint],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Local copy of the StatCard recipe: tinted icon, big tabular number, optional hint chip. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  tint?: Tint;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm backdrop-blur transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted">{label}</p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            {value}
          </p>
        </div>
        <IconTile tint={tint}>{icon}</IconTile>
      </div>
      {hint && <div className="mt-3 text-xs text-muted">{hint}</div>}
    </div>
  );
}
