import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BellRing, ShieldCheck } from 'lucide-react';
import { ApiError } from '@/api/client';
import { listRiskCases } from '@/api/endpoints';
import { useRiskCases } from '@/api/queries';
import { useClampPage } from '@/api/useClampPage';
import type { RiskCaseState, Severity } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Button, EmptyState, ErrorState, Skeleton, toast } from '@/components/ui';
import { PageHeader } from '../ui';
import { CaseFilters } from './CaseFilters';
import { SEVERITIES, STATES } from './filterOptions';
import { CaseTable } from './CaseTable';
import { clockTime } from './format';
import { Pagination } from './Pagination';
import { SeveritySummary } from './SeveritySummary';
import { SimulateDisruption } from './SimulateDisruption';
import { useNewCases } from './useNewCases';

export const POLL_MS = 3000;
const PAGE_SIZE = 10;

export function RiskInbox() {
  const [params, setParams] = useSearchParams();
  const { hasRole } = useAuth();

  const severity = SEVERITIES.find((s) => s === params.get('severity'));
  const status = STATES.find((s) => s === params.get('status'));
  const page = Math.max(1, Number(params.get('page')) || 1);

  const setFilter = (key: 'severity' | 'status', value: Severity | RiskCaseState | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page'); // filter change resets paging
    setParams(next);
  };
  const setPage = (p: number) => {
    const next = new URLSearchParams(params);
    if (p > 1) next.set('page', String(p));
    else next.delete('page');
    setParams(next);
  };

  const { data, isPending, isError, error, refetch, isPlaceholderData, dataUpdatedAt } = useRiskCases(
    { severity, status, page, page_size: PAGE_SIZE },
    { refetchInterval: POLL_MS, keepPrevious: true },
  );

  const clamping = useClampPage({
    error,
    page,
    pageSize: PAGE_SIZE,
    fetchCount: async () => (await listRiskCases({ severity, status, page: 1, page_size: PAGE_SIZE })).count,
    onClamp: setPage,
  });

  const viewKey = `${severity ?? ''}|${status ?? ''}|${page}`;
  const { fresh, announcement } = useNewCases(
    data && !isPlaceholderData ? data.results.map((c) => c.id) : undefined,
    viewKey,
  );

  // Toast on arrival of a new case.
  useEffect(() => {
    if (announcement) toast.info(announcement, { icon: <BellRing className="h-4 w-4" aria-hidden="true" /> });
  }, [announcement]);

  const filtered = !!(severity || status);
  const now = dataUpdatedAt; // relative times refresh with every poll

  let body;
  if (isPending || clamping) {
    body = (
      <div
        className="space-y-2 rounded-2xl border border-border/60 bg-card/80 p-4"
        aria-busy="true"
        aria-label="Loading risk cases"
      >
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-12 flex-1" />
          </div>
        ))}
      </div>
    );
  } else if (!data) {
    body = (
      <ErrorState
        title="Could not load risk cases"
        message={error instanceof Error ? error.message : 'Unknown error'}
        correlationId={error instanceof ApiError ? (error.correlationId ?? undefined) : undefined}
        onRetry={() => void refetch()}
      />
    );
  } else if (data.count === 0) {
    body = (
      <div className="rounded-2xl border border-dashed border-border bg-card/60">
        {filtered ? (
          <EmptyState
            title="No cases match these filters"
            description="Try a different severity or status."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  ['severity', 'status', 'page'].forEach((k) => next.delete(k));
                  setParams(next);
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<ShieldCheck />}
            title="No risk cases yet"
            description="Cases appear here when a supplier disruption is detected."
          />
        )}
      </div>
    );
  } else {
    body = (
      <div className="space-y-3">
        <CaseTable items={data.results} fresh={fresh} now={now} />
        <Pagination page={page} pageSize={PAGE_SIZE} count={data.count} onPage={setPage} />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Risk operations"
        title="Risk Command Center"
        description={
          <span data-testid="live-indicator" className="inline-flex items-center gap-2 text-sm">
            {isError && data ? (
              'Update failed - retrying'
            ) : (
              <>
                <span aria-hidden="true" className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                Live · updated {dataUpdatedAt ? clockTime(dataUpdatedAt) : '--:--:--'}
              </>
            )}
          </span>
        }
        actions={hasRole('ADMIN') ? <SimulateDisruption /> : undefined}
      />

      <SeveritySummary severity={severity} onSeverity={(s) => setFilter('severity', s)} pollMs={POLL_MS} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <CaseFilters status={status} onStatus={(s) => setFilter('status', s)} />
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {body}
    </section>
  );
}
