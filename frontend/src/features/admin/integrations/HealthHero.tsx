import type { Connection, ConnectionStatus } from "@/api/admin/integrations";
import { cn } from "@/lib/utils";
import { STATUS_META } from "./statusMeta";

const ORDER: ConnectionStatus[] = ["UP", "DEGRADED", "FALLBACK", "DOWN"];

/** Calm health summary: one line of text, a thin segmented bar and a count per status. */
export function HealthHero({
  connections,
  checkedAt,
}: {
  connections: Connection[];
  checkedAt: string;
}) {
  const total = connections.length;
  const counts = ORDER.map((s) => ({
    status: s,
    n: connections.filter((c) => c.status === s).length,
  }));
  const healthy = counts[0].n;
  const allUp = healthy === total;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-sm" role="status">
          <strong className="text-base font-semibold">
            {healthy} of {total} healthy
          </strong>
          <span className="text-muted">
            {" "}
            · {allUp
              ? "All systems operational."
              : "Some services need attention. See the last error and fallback below."}
          </span>
        </p>
        <p className="text-xs text-muted">
          checked at{" "}
          <time dateTime={checkedAt}>
            {new Date(checkedAt).toLocaleTimeString()}
          </time>{" "}
          · auto-refreshes every 30 s
        </p>
      </div>

      <div aria-hidden="true" className="flex gap-1">
        {connections.map((c) => (
          <span
            key={c.id}
            title={`${c.name}: ${STATUS_META[c.status].label}`}
            className={cn("h-1.5 flex-1 rounded-full", STATUS_META[c.status].bar)}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        {counts.map((c) => (
          <li key={c.status} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[c.status].dot)}
            />
            <span className="tabular-nums font-medium text-foreground">
              {c.n}
            </span>{" "}
            {STATUS_META[c.status].label.toLowerCase()}
          </li>
        ))}
      </ul>
    </div>
  );
}
