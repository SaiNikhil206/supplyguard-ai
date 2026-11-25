import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Local copy of the ChartCard recipe: card with title, description and legend chips. */
export function ChartCard({
  title,
  description,
  legend,
  children,
  className,
  ring,
}: {
  title: string;
  description?: string;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
  ring?: boolean;
}) {
  const body = (
    <div
      className={cn(
        "h-full rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm backdrop-blur transition hover:shadow-md",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
        {legend && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            {legend}
          </div>
        )}
      </div>
      {children}
    </div>
  );
  return ring ? (
    <div className="rounded-2xl bg-gradient-to-br from-primary/40 via-border to-transparent p-px">
      {body}
    </div>
  ) : (
    body
  );
}

export function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2 py-0.5">
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
