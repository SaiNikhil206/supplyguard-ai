import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { integrationsQueryKey, useIntegrationStatus } from '@/api/admin/integrations';
import { Button, EmptyState, ErrorState, Spinner } from '@/components/ui';
import { ConnectionCard } from '@/features/admin/integrations/ConnectionCard';

export default function IntegrationCenter() {
  const q = useIntegrationStatus();
  const qc = useQueryClient();
  const data = q.data;
  const healthy = data?.connections.filter((c) => c.status === 'UP').length ?? 0;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Integration Center</h1>
        <Button
          variant="secondary"
          size="sm"
          loading={q.isFetching}
          onClick={() => void qc.invalidateQueries({ queryKey: integrationsQueryKey })}
        >
          Refresh
        </Button>
      </div>

      {q.isPending && <Spinner label="Loading integration status" />}

      {q.isError && (
        <ErrorState
          message={q.error.message}
          correlationId={q.error instanceof ApiError ? (q.error.correlationId ?? undefined) : undefined}
          onRetry={() => void q.refetch()}
        />
      )}

      {data && data.connections.length === 0 && (
        <EmptyState
          title="No integrations configured"
          description="Connections appear here once the tenant integrations are set up."
        />
      )}

      {data && data.connections.length > 0 && (
        <>
          <p className="text-sm" role="status">
            <strong>
              {healthy} of {data.connections.length} healthy
            </strong>
            <span className="text-muted">
              {' '}
              · checked at <time dateTime={data.checked_at}>{new Date(data.checked_at).toLocaleTimeString()}</time> ·
              auto-refreshes every 30 s
            </span>
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.connections.map((c) => (
              <ConnectionCard key={c.id} connection={c} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
