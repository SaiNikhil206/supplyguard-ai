import { useSearchParams } from 'react-router-dom';
import { MousePointerClick } from 'lucide-react';
import { useApprovalQueue } from '@/api/approvals';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { ErrorState, Skeleton, toast } from '@/components/ui';
import { CasePanel } from '@/features/approvals/CasePanel';
import { waitingTime } from '@/features/approvals/format';
import { HistoryTable, QueueTable } from '@/features/approvals/Tables';
import { PageHeader, StatCard } from '@/features/risk/ui';

const panel = 'rounded-lg border border-border bg-card';

const notify = (message: string, tone: 'success' | 'error') =>
  tone === 'success' ? toast.success(message) : toast.error(message);

export default function ApprovalCenter() {
  const { me, hasRole } = useAuth();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('case');
  const { pending, decided, isLoading, error, refetch } = useApprovalQueue();

  const select = (id: string) => setParams({ case: id }, { replace: true });
  const canDecide = hasRole('PROCUREMENT_MANAGER', 'ADMIN');

  const oldest = pending.length ? pending.reduce((a, b) => (a.updated_at < b.updated_at ? a : b)) : null;
  const total = pending.reduce((sum, c) => sum + Number(c.exposure.amount), 0);
  const currency = pending[0]?.exposure.currency ?? 'INR';

  return (
    <section className="space-y-6">
      <PageHeader
        title="Approval Center"
        description="Review AI recommendations, decide, and watch the approved change execute."
      >
        {!isLoading && !error && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Waiting for approval" dot="bg-warning" value={pending.length} />
            <StatCard
              label="Exposure waiting"
              value={new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
                style: 'currency',
                currency,
                maximumFractionDigits: 0,
              }).format(total)}
            />
            <StatCard
              label="Longest wait"
              value={oldest ? waitingTime(oldest.updated_at) : '-'}
              hint={oldest ? oldest.id : 'Nothing waiting'}
            />
          </div>
        )}
      </PageHeader>

      {isLoading ? (
        <div role="status" aria-label="Loading approvals" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
          <div className="space-y-3">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
          <Skeleton className="h-96 rounded-lg" />
        </div>
      ) : error ? (
        <div className={panel}>
          <ErrorState
            message={error instanceof ApiError ? error.message : 'Could not load approvals.'}
            correlationId={error instanceof ApiError ? (error.correlationId ?? undefined) : undefined}
            onRetry={refetch}
          />
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
          <div className="min-w-0 space-y-6">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Waiting for approval ({pending.length})</h2>
              <QueueTable items={pending} selectedId={selectedId} onSelect={select} />
            </div>
            <div className={`${panel} overflow-hidden`}>
              <h2 className="border-b border-border px-5 py-4 text-sm font-semibold">Decision history</h2>
              <HistoryTable rows={decided} selectedId={selectedId} onSelect={select} />
            </div>
          </div>
          <div className="lg:sticky lg:top-4">
            {selectedId ? (
              <CasePanel
                caseId={selectedId}
                canDecide={canDecide}
                actor={me?.user.full_name ?? 'You'}
                onNotice={notify}
              />
            ) : (
              <div className={`${panel} flex flex-col items-center gap-2 px-6 py-12 text-center`}>
                <MousePointerClick aria-hidden="true" className="h-10 w-10 text-muted" strokeWidth={1.5} />
                <p className="text-sm text-muted">Select a case to review its recommendation.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
