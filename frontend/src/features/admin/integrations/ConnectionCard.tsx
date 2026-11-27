import { useId, useState } from "react";
import { ChevronDown, Clock, LifeBuoy } from "lucide-react";
import type { Connection } from "@/api/admin/integrations";
import { Alert, AlertDescription } from "@/components/ui";
import { cn } from "@/lib/utils";
import { KIND_META, STATUS_META } from "./statusMeta";
import { relativeTime } from "./relativeTime";

export function StatusPill({ status }: { status: Connection["status"] }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
        meta.pill,
      )}
    >
      <span aria-hidden="true" className="relative flex h-2 w-2">
        {status !== "DOWN" && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none",
              meta.dot,
            )}
          />
        )}
        <span
          className={cn("relative inline-flex h-2 w-2 rounded-full", meta.dot)}
        />
      </span>
      {meta.label}
    </span>
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
      className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm backdrop-blur transition hover:shadow-md"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/5 text-sm font-bold text-muted ring-1 ring-border",
              )}
            >
              {kind.mono}
            </span>
            <div>
              <h2 className="text-base font-semibold leading-tight">
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
              className="h-1.5 overflow-hidden rounded-full bg-surface-2"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
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
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
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
                className="mt-2 space-y-1 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm duration-200 animate-in fade-in slide-in-from-top-1"
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
