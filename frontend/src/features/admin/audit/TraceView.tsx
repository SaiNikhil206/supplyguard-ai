import { Button, Card, ErrorState, Spinner } from '@/components/ui';
import { useAudit } from '@/api/admin/audit';
import { formatTime, groupByStage } from './stages';
import { EntityCell } from './AuditTable';

export function TraceView({ correlationId, onBack }: { correlationId: string; onBack: () => void }) {
  const q = useAudit({ correlation_id: correlationId, page_size: 100 });

  return (
    <section aria-label="Correlation trace" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={onBack}>
          Back to list
        </Button>
        <h2 className="text-lg font-semibold">
          Trace <span className="font-mono text-sm">{correlationId}</span>
        </h2>
      </div>

      {q.isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {q.isError && <ErrorState message={q.error.message} onRetry={() => void q.refetch()} />}
      {q.data && q.data.results.length === 0 && (
        <Card>
          <p className="p-4 text-sm text-muted">No audit events match this correlation id.</p>
        </Card>
      )}
      {q.data && q.data.results.length > 0 && <Stages events={q.data.results} />}
    </section>
  );
}

function Stages({ events }: { events: import('@/api/admin/audit').AuditEvent[] }) {
  const { groups, other } = groupByStage(events);
  return (
    <ol className="space-y-4">
      {groups.map((g, i) => (
        <li key={g.stage} data-testid="trace-stage" aria-label={g.stage}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
            {i + 1}. {g.stage}
          </h3>
          {g.events.length === 0 ? (
            <p className="rounded-md border border-dashed border-warning/60 px-3 py-2 text-sm text-warning">
              Missing stage: no {g.stage} events recorded for this correlation id.
            </p>
          ) : (
            <ul className="space-y-2 border-l-2 border-border pl-4">
              {g.events.map((e) => (
                <li key={e.id} data-testid="trace-event" className="text-sm">
                  <div className="font-mono text-xs text-muted">{formatTime(e.at)}</div>
                  <div>
                    <span className="font-medium">{e.action}</span> · <EntityCell e={e} /> · {e.actor.name}
                    {(e.from_state || e.to_state) && (
                      <span className="text-muted">
                        {' '}
                        ({e.from_state ?? '-'} to {e.to_state ?? '-'})
                      </span>
                    )}
                  </div>
                  <div className="text-muted">{e.detail}</div>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
      {other.length > 0 && (
        <li data-testid="trace-other">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Other events</h3>
          <ul className="space-y-2 border-l-2 border-border pl-4">
            {other.map((e) => (
              <li key={e.id} className="text-sm">
                <span className="font-mono text-xs text-muted">{formatTime(e.at)}</span> {e.action} · {e.detail}
              </li>
            ))}
          </ul>
        </li>
      )}
    </ol>
  );
}
