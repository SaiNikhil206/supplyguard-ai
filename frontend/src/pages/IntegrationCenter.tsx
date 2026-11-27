import { useQueryClient } from "@tanstack/react-query";
import { Plug, RefreshCw } from "lucide-react";
import {
  type IntegrationStatus,
  integrationsQueryKey,
  useIntegrationStatus,
} from "@/api/admin/integrations";
import { Button, ErrorState, Skeleton } from "@/components/ui";
import { ConnectionCard } from "@/features/admin/integrations/ConnectionCard";
import { HealthHero } from "@/features/admin/integrations/HealthHero";
import { describeError } from "@/features/admin/ui/errors";
import { PageHeader } from "@/features/admin/ui/PageHeader";

function EventCounts({ counts }: { counts: IntegrationStatus["events_24h"] }) {
  const items: [string, number, string][] = [
    ["Received", counts.RECEIVED, "events-received"],
    ["Published", counts.PUBLISHED, "events-published"],
    ["Publish failed", counts.PUBLISH_FAILED, "events-publish-failed"],
    ["Needs data correction", counts.needs_data_correction, "events-needs-correction"],
  ];
  return (
    <section aria-label="Events in the last 24 hours" className="space-y-2">
      <h2 className="text-sm font-semibold">Events, last 24 hours</h2>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map(([label, n, id]) => (
          <div key={id} data-testid={id} className="rounded-2xl border border-border bg-card p-4">
            <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function IntegrationCenter() {
  const q = useIntegrationStatus();
  const qc = useQueryClient();
  const data = q.data;
  const err = q.isError
    ? describeError(q.error, "Only tenant admins can view integration status.")
    : null;

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
          <Skeleton className="h-44 w-full rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      )}

      {q.isError && (
        <ErrorState
          title={err!.title}
          message={err!.message}
          correlationId={err?.correlationId}
          onRetry={err!.retryable ? () => void q.refetch() : undefined}
        />
      )}

      {data && data.connections.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Plug className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold">No integrations configured</h2>
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.connections.map((c) => (
              <ConnectionCard key={c.id} connection={c} />
            ))}
          </div>
          <EventCounts counts={data.events_24h} />
          <p className="text-xs text-muted">
            The backend reports Boomi connectivity and event counts only; other
            services (Event Streams, Agentstudio, Flow, ERP) are not yet monitored here.
          </p>
        </>
      )}
    </section>
  );
}
