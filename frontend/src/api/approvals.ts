import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import { getRiskCase, listRiskCases } from './endpoints';
import { queryKeys } from './queries';
import type {
  Approval,
  ApprovalDecision,
  Execution,
  RiskCaseDetail,
  RiskCaseState,
} from './types';

/** Case states that wait for a human decision. */
export const PENDING_STATUSES: RiskCaseState[] = ['PENDING_APPROVAL', 'RECOMMENDATION_READY'];

/** How often the execution panel refetches while an execution is RUNNING. */
export const EXECUTION_POLL_MS = import.meta.env.MODE === 'test' ? 100 : 2000;

/** PROVISIONAL: CONTRACTS section 4 only gives the request body. */
export interface DecisionResult {
  approval: Approval;
  execution: Execution | null;
  risk_case_status: RiskCaseState;
}

export interface DecisionRequest {
  decision: ApprovalDecision;
  comments: string;
}

export const submitDecision = (recommendationId: string, body: DecisionRequest) =>
  apiFetch<DecisionResult>(`/recommendations/${encodeURIComponent(recommendationId)}/decision`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const retryExecution = (executionId: string) =>
  apiFetch<Execution>(`/executions/${encodeURIComponent(executionId)}/retry`, { method: 'POST' });

export const isPending = (c: Pick<RiskCaseDetail, 'status'>) => PENDING_STATUSES.includes(c.status);

export function latestExecution(c: Pick<RiskCaseDetail, 'executions'>): Execution | undefined {
  return [...c.executions].sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
}

export interface DecidedRow {
  approval: Approval;
  riskCase: RiskCaseDetail;
}

/**
 * Pending approvals + decided history, derived from the risk-case endpoints (CONTRACTS section 4 has no
 * dedicated approvals list). One list call, then one detail call per case (shares the `riskCase` cache key).
 */
export function useApprovalQueue() {
  const list = useQuery({
    queryKey: queryKeys.riskCases({ page_size: 100 }),
    queryFn: () => listRiskCases({ page_size: 100 }),
  });
  const ids = (list.data?.results ?? []).filter((c) => c.status !== 'RECEIVED').map((c) => c.id);
  const details = useQueries({
    queries: ids.map((id) => ({ queryKey: queryKeys.riskCase(id), queryFn: () => getRiskCase(id) })),
  });

  const cases = details.map((d) => d.data).filter((d): d is RiskCaseDetail => !!d);
  const pending = cases.filter(isPending);
  const decided: DecidedRow[] = cases
    .flatMap((riskCase) => riskCase.approvals.map((approval) => ({ approval, riskCase })))
    .sort((a, b) => b.approval.decided_at.localeCompare(a.approval.decided_at));

  const error = list.error ?? details.find((d) => d.error)?.error ?? null;
  const isLoading = list.isLoading || (ids.length > 0 && details.some((d) => d.isLoading));
  const refetch = () => {
    void list.refetch();
    details.forEach((d) => void d.refetch());
  };
  return { pending, decided, isLoading, error, refetch };
}

/** One case, polled every EXECUTION_POLL_MS while its latest execution is RUNNING. */
export function useWatchedCase(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.riskCase(id ?? ''),
    queryFn: () => getRiskCase(id as string),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      const ex = data ? latestExecution(data) : undefined;
      return ex && (ex.status === 'RUNNING' || ex.status === 'PENDING') ? EXECUTION_POLL_MS : false;
    },
  });
}

const OPTIMISTIC_STATUS: Record<ApprovalDecision, RiskCaseState> = {
  APPROVE: 'APPROVED',
  REJECT: 'REJECTED',
  REQUEST_CHANGES: 'ANALYZING',
};

export interface DecideVars extends DecisionRequest {
  caseId: string;
  recommendationId: string;
  actor: string;
}

function invalidateCaseQueries(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['risk-cases'] });
  void qc.invalidateQueries({ queryKey: ['risk-case'] });
  void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
}

export function useDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: DecideVars) =>
      submitDecision(v.recommendationId, { decision: v.decision, comments: v.comments }),
    onMutate: async (v) => {
      const key = queryKeys.riskCase(v.caseId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<RiskCaseDetail>(key);
      if (previous) {
        qc.setQueryData<RiskCaseDetail>(key, {
          ...previous,
          status: OPTIMISTIC_STATUS[v.decision],
          approvals: [
            ...previous.approvals,
            {
              id: 'APR-pending',
              recommendation_id: v.recommendationId,
              decision: v.decision,
              comments: v.comments,
              decided_by: v.actor,
              decided_at: new Date().toISOString(),
            },
          ],
        });
      }
      return { previous, key };
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
    },
    onSettled: () => invalidateCaseQueries(qc),
  });
}

export function useRetryExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (executionId: string) => retryExecution(executionId),
    onSettled: () => invalidateCaseQueries(qc),
  });
}
