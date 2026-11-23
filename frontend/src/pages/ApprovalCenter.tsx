import { useSearchParams } from 'react-router-dom';
import { Clock, MousePointerClick, ShieldCheck, Wallet } from 'lucide-react';
import { useApprovalQueue } from '@/api/approvals';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { ErrorState, Skeleton, toast } from '@/components/ui';
import { CasePanel } from '@/features/approvals/CasePanel';
import { waitingTime } from '@/features/approvals/format';
import { HistoryTable, QueueTable } from '@/features/approvals/Tables';
import { PageHeader, StatCard } from '@/features/risk/ui';

const panel = 'rounded-2xl border border-border/60 bg-card/80 shadow-sm backdrop-blur';

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
        eyebrow="Human in the loop"
        title="Approval Center"
        description="Review AI recommendations, decide, and watch the approved change execute."
      >
        {!isLoading && !error && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={ShieldCheck} label="Waiting for approval" value={pending.length} tone="bg-warning/10 text-warning" />
            <StatCard
              icon={Wallet}
              label="Exposure waiting"
              value={new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
                style: 'currency',
                currency,
                maximumFractionDigits: 0,
              }).format(total)}
            />
            <StatCard
              icon={Clock}
              label="Longest wait"
              value={oldest ? waitingTime(oldest.updated_at) : '-'}
              hint={oldest ? oldest.id : 'Nothing waiting'}
              tone="bg-info/10 text-info"
            />
          </div>
        )}
      </PageHeader>

      {isLoading ? (
        <div role="status" aria-label="Loading approvals" className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-3">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
          <Skeleton className="h-96 rounded-2xl" />
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
        <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Waiting for approval ({pending.length})</h2>
              <QueueTable items={pending} selectedId={selectedId} onSelect={select} />
            </div>
            <div className={`${panel} overflow-hidden`}>
              <h2 className="border-b border-border px-5 py-3.5 text-sm font-semibold">Decision history</h2>
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
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MousePointerClick aria-hidden="true" className="h-6 w-6" />
                </span>
                <p className="text-sm text-muted">Select a case to review its recommendation.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
