import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TINT = {
  primary: "bg-foreground/5 text-muted",
  emerald: "bg-foreground/5 text-muted",
  amber: "bg-foreground/5 text-muted",
  orange: "bg-foreground/5 text-muted",
  rose: "bg-foreground/5 text-muted",
  violet: "bg-foreground/5 text-muted",
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
