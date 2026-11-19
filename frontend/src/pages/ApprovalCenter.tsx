import { useSearchParams } from 'react-router-dom';
import { useApprovalQueue } from '@/api/approvals';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { Card, CardBody, CardHeader, CardTitle, ErrorState, Spinner } from '@/components/ui';
import { CasePanel } from '@/features/approvals/CasePanel';
import { HistoryTable, QueueTable } from '@/features/approvals/Tables';
import { Toast } from '@/features/approvals/Toast';
import { useToast } from '@/features/approvals/useToast';

export default function ApprovalCenter() {
  const { me, hasRole } = useAuth();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('case');
  const { pending, decided, isLoading, error, refetch } = useApprovalQueue();
  const { toast, notify, dismiss } = useToast();

  const select = (id: string) => setParams({ case: id }, { replace: true });
  const canDecide = hasRole('PROCUREMENT_MANAGER', 'ADMIN');

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Approval Center</h1>

      {isLoading ? (
        <Spinner label="Loading approvals" />
      ) : error ? (
        <Card>
          <ErrorState
            message={error instanceof ApiError ? error.message : 'Could not load approvals.'}
            correlationId={error instanceof ApiError ? (error.correlationId ?? undefined) : undefined}
            onRetry={refetch}
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Waiting for approval ({pending.length})</CardTitle>
              </CardHeader>
              <QueueTable items={pending} selectedId={selectedId} onSelect={select} />
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Decision history</CardTitle>
              </CardHeader>
              <HistoryTable rows={decided} selectedId={selectedId} onSelect={select} />
            </Card>
          </div>
          <div>
            {selectedId ? (
              <CasePanel
                caseId={selectedId}
                canDecide={canDecide}
                actor={me?.user.full_name ?? 'You'}
                onNotice={notify}
              />
            ) : (
              <Card>
                <CardBody>
                  <p className="text-sm text-muted">Select a case to review its recommendation.</p>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}
      <Toast toast={toast} onDismiss={dismiss} />
    </section>
  );
}
