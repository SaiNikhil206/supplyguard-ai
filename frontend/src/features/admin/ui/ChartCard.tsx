import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** v2 chart card: flat bordered surface, title + description, legend top-right. */
export function ChartCard({
  title,
  description,
  legend,
  children,
  className,
}: {
  title: string;
  description?: string;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Accepted for API compatibility; v2 has no gradient rings. */
  ring?: boolean;
}) {
  return (
    <section
      className={cn("h-full rounded-lg border border-border bg-card p-5", className)}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
        {legend && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            {legend}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

export function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
