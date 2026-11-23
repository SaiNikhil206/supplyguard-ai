import { useId, useState } from "react";
import { ChevronDown, Clock, LifeBuoy } from "lucide-react";
import type { Connection } from "@/api/admin/integrations";
import { Alert, AlertDescription, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { KIND_META, STATUS_META } from "./statusMeta";
import { relativeTime } from "./relativeTime";

export function StatusPill({ status }: { status: Connection["status"] }) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

const LATENCY_SCALE_MS = 3000;

export function ConnectionCard({ connection: c }: { connection: Connection }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const meta = STATUS_META[c.status];
  const kind = KIND_META[c.kind];
  const pct =
    c.latency_ms === null
      ? 0
      : Math.max(4, Math.min(100, (c.latency_ms / LATENCY_SCALE_MS) * 100));
  return (
    <div
      data-testid={`connection-${c.id}`}
      className="rounded-lg border border-border bg-card p-5"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-2 text-xs font-semibold text-muted"
            >
              {kind.mono}
            </span>
            <div>
              <h2 className="text-sm font-semibold leading-tight">
                {c.name}
              </h2>
              <p className="text-xs text-muted">{kind.sub}</p>
            </div>
          </div>
          <StatusPill status={c.status} />
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1.5">
            <dt className="text-xs uppercase tracking-wide text-muted">
              Latency
            </dt>
            <dd className="font-semibold tabular-nums">
              {c.latency_ms === null ? "—" : `${c.latency_ms} ms`}
            </dd>
            <div
              aria-hidden="true"
              className="h-1 overflow-hidden rounded-full bg-surface-2"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-200",
                  meta.bar,
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <dt className="text-xs uppercase tracking-wide text-muted">
              Last success
            </dt>
            <dd className="flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              {relativeTime(c.last_success_at)}
            </dd>
          </div>
        </dl>

        {c.fallback_note && (
          <Alert variant="info" className="text-sm">
            <LifeBuoy className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            <AlertDescription>{c.fallback_note}</AlertDescription>
          </Alert>
        )}

        {c.last_error && (
          <div>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((o) => !o)}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  open && "rotate-180",
                )}
                aria-hidden="true"
              />
              {open ? "Hide last error" : "Show last error"}
            </button>
            {open && (
              <div
                id={panelId}
                className="mt-2 space-y-1 rounded-md border border-danger/25 bg-danger/5 p-3 text-sm duration-200 animate-in fade-in slide-in-from-top-1"
              >
                <p className="font-mono text-xs font-semibold">
                  {c.last_error.code}
                </p>
                <p>{c.last_error.message}</p>
                <p className="text-xs text-muted">
                  {relativeTime(c.last_error.at)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
