import { Activity } from "lucide-react";
import type { Connection, ConnectionStatus } from "@/api/admin/integrations";
import { cn } from "@/lib/utils";
import { STATUS_META } from "./statusMeta";

const ORDER: ConnectionStatus[] = ["UP", "DEGRADED", "FALLBACK", "DOWN"];

/** Donut of connection statuses plus an uptime-style segmented bar (pure SVG/CSS, no chart lib). */
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
  const R = 42;
  const C = 2 * Math.PI * R;
  const present = counts.filter((c) => c.n > 0);
  const starts = present.map((_, i) =>
    present.slice(0, i).reduce((a, c) => a + (c.n / total) * C, 0),
  );
  const allUp = healthy === total;

  return (
    <div className="rounded-2xl bg-border p-px">
      <div className="flex flex-wrap items-center gap-8 rounded-2xl bg-card p-6">
        <div className="relative h-32 w-32 shrink-0" aria-hidden="true">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              strokeWidth="10"
              className="stroke-surface-2"
            />
            {present.map((c, i) => {
              const len = (c.n / total) * C;
              return (
                <circle
                  key={c.status}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  strokeWidth="10"
                  stroke={STATUS_META[c.status].stroke}
                  strokeDasharray={`${Math.max(0, len - 2)} ${C}`}
                  strokeDashoffset={-starts[i]}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold tabular-nums">
              {healthy}
            </span>
            <span className="text-xs text-muted">of {total} up</span>
          </div>
        </div>

        <div className="min-w-64 flex-1 space-y-4">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <Activity className="h-3.5 w-3.5" aria-hidden="true" /> System
              health
            </p>
            <p className="text-lg" role="status">
              <strong>
                {healthy} of {total} healthy
              </strong>
              <span className="text-sm text-muted">
                {" "}
                · checked at{" "}
                <time dateTime={checkedAt}>
                  {new Date(checkedAt).toLocaleTimeString()}
                </time>{" "}
                · auto-refreshes every 30 s
              </span>
            </p>
            <p className="text-sm text-muted">
              {allUp
                ? "All systems operational."
                : "Some services need attention. See the cards below for the last error and fallback."}
            </p>
          </div>

          <div aria-hidden="true" className="flex gap-1">
            {connections.map((c) => (
              <span
                key={c.id}
                title={`${c.name}: ${STATUS_META[c.status].label}`}
                className={cn(
                  "h-8 flex-1 rounded-md opacity-90 transition hover:opacity-100",
                  STATUS_META[c.status].bar,
                )}
              />
            ))}
          </div>

          <ul className="flex flex-wrap gap-2 text-xs">
            {counts.map((c) => (
              <li
                key={c.status}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2 py-0.5 text-muted"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-2 w-2 rounded-full",
                    STATUS_META[c.status].dot,
                  )}
                />
                <span className="tabular-nums">{c.n}</span>{" "}
                {STATUS_META[c.status].label.toLowerCase()}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
