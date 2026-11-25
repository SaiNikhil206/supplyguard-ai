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
import { ErrorState, Button, Skeleton } from "@/components/ui";
import { useAudit, type AuditEvent } from "@/api/admin/audit";
import { cn } from "@/lib/utils";
import { formatGap, formatTime, groupByStage, type Stage } from "./stages";
import { ActorCell, CopyId, EntityCell, StateChange } from "./AuditTable";

const STAGE_META: Record<Stage, { icon: typeof Radio; tint: string }> = {
  Event: {
    icon: Radio,
    tint: "bg-sky-500/10 text-sky-600 ring-sky-500/30 dark:text-sky-400",
  },
  Analysis: {
    icon: ScanSearch,
    tint: "bg-violet-500/10 text-violet-600 ring-violet-500/30 dark:text-violet-400",
  },
  Approval: {
    icon: UserCheck,
    tint: "bg-amber-500/10 text-amber-600 ring-amber-500/30 dark:text-amber-400",
  },
  Execution: {
    icon: Zap,
    tint: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400",
  },
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
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          Trace <CopyId id={correlationId} />
        </h2>
      </div>

      {q.isLoading && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
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
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
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
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
            missing === 0
              ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
          )}
        >
          {missing === 0 ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {complete} of {groups.length} stages recorded
        </span>
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
                  className="absolute left-5 top-11 h-[calc(100%-2.75rem)] w-px bg-border"
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-2",
                  g.events.length
                    ? meta.tint
                    : "bg-surface-2 text-muted ring-border",
                )}
              >
                {g.events.length ? (
                  <Icon className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
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
                  <p className="flex items-center gap-2 rounded-xl border border-dashed border-amber-500/50 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                    Missing stage: no {g.stage} events recorded for this
                    correlation id.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {g.events.map((e) => (
                      <li
                        key={e.id}
                        data-testid="trace-event"
                        className="space-y-1.5 rounded-2xl border border-border/60 bg-card/80 p-3 text-sm shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-xs text-muted">
                            {formatTime(e.at)}
                          </span>
                          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3 w-3" aria-hidden="true" />
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            {e.action}
                          </span>
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
          <li data-testid="trace-other" className="space-y-2 pl-14">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Other events
            </h3>
            <ul className="space-y-2">
              {other.map((e) => (
                <li
                  key={e.id}
                  className="rounded-xl border border-border/60 bg-card/80 px-3 py-2 text-sm"
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
