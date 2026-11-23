import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Radio,
  ScanSearch,
  Timer,
  UserCheck,
  Zap,
} from "lucide-react";
import { Badge, ErrorState, Button, Skeleton } from "@/components/ui";
import { useAudit, type AuditEvent } from "@/api/admin/audit";
import { cn } from "@/lib/utils";
import { formatGap, formatTime, groupByStage, type Stage } from "./stages";
import { ActorCell, CopyId, EntityCell, StateChange } from "./AuditTable";

const STAGE_META: Record<Stage, { icon: typeof Radio }> = {
  Event: { icon: Radio },
  Analysis: { icon: ScanSearch },
  Approval: { icon: UserCheck },
  Execution: { icon: Zap },
};

export function TraceView({
  correlationId,
  onBack,
}: {
  correlationId: string;
  onBack: () => void;
}) {
  const q = useAudit({ correlation_id: correlationId, page_size: 100 });

  return (
    <section aria-label="Correlation trace" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to list
        </Button>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          Trace <CopyId id={correlationId} />
        </h2>
      </div>

      {q.isLoading && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      )}
      {q.isError && (
        <ErrorState
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      )}
      {q.data && q.data.results.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <ScanSearch className="h-8 w-8 text-muted" aria-hidden="true" />
          <p className="text-sm text-muted">
            No audit events match this correlation id.
          </p>
        </div>
      )}
      {q.data && q.data.results.length > 0 && (
        <Stages events={q.data.results} />
      )}
    </section>
  );
}

function Stages({ events }: { events: AuditEvent[] }) {
  const { groups, other } = groupByStage(events);
  const missing = groups.filter((g) => g.events.length === 0).length;
  const complete = groups.length - missing;
  const gaps = groups.map((g, i) => {
    if (!g.events.length) return null;
    const start = new Date(g.events[0].at).getTime();
    for (let k = i - 1; k >= 0; k--) {
      const prev = groups[k].events;
      if (prev.length)
        return Math.max(
          0,
          start - new Date(prev[prev.length - 1].at).getTime(),
        );
    }
    return null;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={missing === 0 ? "success" : "warning"}>
          {missing === 0 ? (
            <CheckCircle2 aria-hidden="true" />
          ) : (
            <AlertTriangle aria-hidden="true" />
          )}
          {complete} of {groups.length} stages recorded
        </Badge>
      </div>
      <ol className="space-y-0">
        {groups.map((g, i) => {
          const meta = STAGE_META[g.stage];
          const Icon = meta.icon;
          const gap = gaps[i];
          const last = i === groups.length - 1 && other.length === 0;
          return (
            <li
              key={g.stage}
              data-testid="trace-stage"
              aria-label={g.stage}
              className="relative flex gap-4 pb-6"
            >
              {!last && (
                <span
                  aria-hidden="true"
                  className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px bg-border"
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                  g.events.length
                    ? "border-primary/30 bg-accent text-accent-foreground"
                    : "border-warning/40 bg-card text-warning",
                )}
              >
                {g.events.length ? (
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
                )}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                    {i + 1}. {g.stage}
                  </h3>
                  {gap !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                      <Timer className="h-3 w-3" aria-hidden="true" />+
                      {formatGap(gap)} after previous stage
                    </span>
                  )}
                </div>
                {g.events.length === 0 ? (
                  <p className="flex items-center gap-2 rounded-md border border-dashed border-warning/40 bg-warning/5 px-3 py-2 text-sm text-warning">
                    Missing stage: no {g.stage} events recorded for this
                    correlation id.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {g.events.map((e) => (
                      <li
                        key={e.id}
                        data-testid="trace-event"
                        className="space-y-1.5 rounded-lg border border-border bg-card p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-xs text-muted">
                            {formatTime(e.at)}
                          </span>
                          <span className="flex items-center gap-1 text-xs font-medium text-success">
                            <Check className="h-3 w-3" aria-hidden="true" />
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <Badge tone="primary">{e.action}</Badge>
                          <EntityCell e={e} />
                          <ActorCell actor={e.actor} />
                          <StateChange from={e.from_state} to={e.to_state} />
                        </div>
                        <p className="text-muted">{e.detail}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
        {other.length > 0 && (
          <li data-testid="trace-other" className="space-y-2 pl-12">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              Other events
            </h3>
            <ul className="space-y-2">
              {other.map((e) => (
                <li
                  key={e.id}
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs text-muted">
                    {formatTime(e.at)}
                  </span>{" "}
                  {e.action} · {e.detail}
                </li>
              ))}
            </ul>
          </li>
        )}
      </ol>
    </div>
  );
}
