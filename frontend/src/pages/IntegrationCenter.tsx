import { useQueryClient } from "@tanstack/react-query";
import { Plug, RefreshCw } from "lucide-react";
import { ApiError } from "@/api/client";
import {
  integrationsQueryKey,
  useIntegrationStatus,
} from "@/api/admin/integrations";
import { Button, ErrorState, Skeleton } from "@/components/ui";
import { ConnectionCard } from "@/features/admin/integrations/ConnectionCard";
import { HealthHero } from "@/features/admin/integrations/HealthHero";
import { PageHeader } from "@/features/admin/ui/PageHeader";

export default function IntegrationCenter() {
  const q = useIntegrationStatus();
  const qc = useQueryClient();
  const data = q.data;

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Integration Center"
        description="Live status of the Boomi services and systems SupplyGuard depends on."
        actions={
          <Button
            variant="secondary"
            size="sm"
            loading={q.isFetching}
            onClick={() =>
              void qc.invalidateQueries({ queryKey: integrationsQueryKey })
            }
          >
            {!q.isFetching && (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            Refresh
          </Button>
        }
      />

      {q.isPending && (
        <div role="status" aria-busy="true" className="space-y-6">
          <span className="sr-only">Loading integration status</span>
          <Skeleton className="h-32 w-full rounded-lg" />
          <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        </div>
      )}

      {q.isError && (
        <ErrorState
          message={q.error.message}
          correlationId={
            q.error instanceof ApiError
              ? (q.error.correlationId ?? undefined)
              : undefined
          }
          onRetry={() => void q.refetch()}
        />
      )}

      {data && data.connections.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
          <Plug
            className="h-10 w-10 text-muted"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <h2 className="text-sm font-semibold">No integrations configured</h2>
          <p className="max-w-sm text-sm text-muted">
            Connections appear here once the tenant integrations are set up.
          </p>
        </div>
      )}

      {data && data.connections.length > 0 && (
        <>
          <HealthHero
            connections={data.connections}
            checkedAt={data.checked_at}
          />
          <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.connections.map((c) => (
              <ConnectionCard key={c.id} connection={c} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
