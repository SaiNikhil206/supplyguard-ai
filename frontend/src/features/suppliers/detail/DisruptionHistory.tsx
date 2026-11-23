import { Link } from "react-router-dom";
import { EmptyState, SeverityBadge } from "@/components/ui";
import { SectionTitle } from "@/components/patterns";
import type { Severity, SupplierDisruption } from "@/api/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { eventTypeLabel } from "./format";

const DOT: Record<Severity, string> = {
  LOW: "bg-sev-low",
  MEDIUM: "bg-sev-medium",
  HIGH: "bg-sev-high",
  CRITICAL: "bg-sev-critical",
};

/** Vertical timeline: severity dot, connector line, case link. */
export function DisruptionHistory({ items }: { items: SupplierDisruption[] }) {
  const sorted = [...items].sort(
    (a, b) =>
      new Date(b.event_time).getTime() - new Date(a.event_time).getTime(),
  );
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <SectionTitle
        title="Disruption history"
        description="Most recent first"
      />
      {sorted.length === 0 ? (
        <EmptyState
          title="No disruptions recorded"
          description="No disruption events have been logged for this supplier."
        />
      ) : (
        <ul aria-label="Disruption history" className="mt-5">
          {sorted.map((d, i) => (
            <li key={d.event_id} className="relative flex gap-4 pb-6 last:pb-0">
              {i < sorted.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[5px] top-4 w-px bg-border"
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "relative mt-1.5 h-3 w-3 shrink-0 rounded-full ring-4 ring-card",
                  DOT[d.severity],
                )}
              />
              <div className="min-w-0 flex-1 rounded-md border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={d.severity} />
                  <span className="text-sm font-semibold text-foreground">
                    {eventTypeLabel(d.event_type)}
                  </span>
                  <time
                    dateTime={d.event_time}
                    className="ml-auto text-xs text-muted"
                  >
                    {formatDateTime(d.event_time)}
                  </time>
                </div>
                <p className="mt-2 text-sm text-muted">{d.description}</p>
                <div className="mt-3 text-sm">
                  {d.risk_case_id ? (
                    <Link
                      className="font-medium text-primary hover:underline"
                      to={`/risk?case=${encodeURIComponent(d.risk_case_id)}`}
                    >
                      View case {d.risk_case_id}
                    </Link>
                  ) : (
                    <span className="text-muted">No case</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
