/**
 * Stateful MSW mock for the approval flow (PROVISIONAL shapes, CONTRACTS section 4).
 *
 *  POST /recommendations/:id/decision  -> 403 role | 404 | 409 already decided | 422 unsupported option | 200 DecisionResult
 *  POST /executions/:id/retry          -> 403 role | 404 | 409 unless FAILED and retryable | 200 Execution
 *  GET  /risk-cases, /risk-cases/:id   -> overridden here so decisions/executions show up (registered BEFORE the base handlers)
 *
 * Execution lifecycle: RUNNING for the execution delay, then SUCCEEDED. Demo option REC-000102 (inventory transfer)
 * FAILS the first time with a retryable error; the retry succeeds.
 */
import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  Approval,
  ApprovalDecision,
  ErrorCode,
  Execution,
  Paginated,
  Recommendation,
  RiskCaseDetail,
  RiskCaseListItem,
  RiskCaseState,
  TimelineEntry,
} from '@/api/types';
import { riskCaseDetail, riskCaseList, users } from './fixtures';

export const DEFAULT_EXECUTION_DELAY_MS = 400;
export const FAILING_DEMO_RECOMMENDATION = 'REC-000102';
const DECIDERS = ['ADMIN', 'PROCUREMENT_MANAGER'];
const PENDING: RiskCaseState[] = ['PENDING_APPROVAL', 'RECOMMENDATION_READY'];

interface ExecRec {
  exec: Execution;
  startedMs: number;
  willFail: boolean;
  settled: boolean;
}
interface CaseState {
  status?: RiskCaseState;
  updatedAt?: string;
  approvals: Approval[];
  executions: ExecRec[];
  timeline: TimelineEntry[];
}

let executionDelayMs = DEFAULT_EXECUTION_DELAY_MS;
let seq = 1;
let store = new Map<string, CaseState>();
const failedOnce = new Set<string>();

export function setExecutionDelay(ms: number) {
  executionDelayMs = ms;
}

function caseState(id: string): CaseState {
  let s = store.get(id);
  if (!s) {
    s = { approvals: [], executions: [], timeline: [] };
    store.set(id, s);
  }
  return s;
}

function seed() {
  caseState('RC-000041').approvals.push({
    id: 'APR-000041',
    recommendation_id: 'REC-000081',
    decision: 'REJECT',
    comments: 'Capacity loss is only 10%; absorb within existing safety stock.',
    decided_by: 'Pranav Procurement',
    decided_at: '2026-11-24T11:10:00Z',
  });
  const failed = caseState('RC-000042');
  failed.approvals.push({
    id: 'APR-000042',
    recommendation_id: 'REC-000091',
    decision: 'APPROVE',
    comments: 'Go ahead with the replacement PO.',
    decided_by: 'Pranav Procurement',
    decided_at: '2026-11-26T13:00:00Z',
  });
  failed.executions.push({
    exec: {
      id: 'EXE-000042',
      recommendation_id: 'REC-000091',
      status: 'FAILED',
      started_at: '2026-11-26T13:00:05Z',
      finished_at: '2026-11-26T13:00:40Z',
      error: 'ERP timeout while creating the replacement PO.',
      retryable: true,
    },
    startedMs: 0,
    willFail: false,
    settled: true,
  });
}

/** Reset all decisions/executions back to the seeded demo state. Call from test setup. */
export function resetApprovalsMock() {
  store = new Map();
  failedOnce.clear();
  seq = 1;
  executionDelayMs = DEFAULT_EXECUTION_DELAY_MS;
  seed();
}
resetApprovalsMock();

function settle() {
  for (const s of store.values()) {
    for (const r of s.executions) {
      if (r.settled || Date.now() - r.startedMs < executionDelayMs) continue;
      r.settled = true;
      const now = new Date().toISOString();
      r.exec = r.willFail
        ? { ...r.exec, status: 'FAILED', finished_at: now, error: 'ERP rejected the write: connection reset.', retryable: true }
        : { ...r.exec, status: 'SUCCEEDED', finished_at: now, error: null, retryable: false };
      s.status = r.willFail ? 'EXECUTION_FAILED' : 'RECOVERED';
      s.updatedAt = now;
      s.timeline.push({
        at: now,
        actor: 'boomi-execution',
        action: r.willFail ? 'EXECUTION_FAILED' : 'EXECUTION_SUCCEEDED',
        detail: `${r.exec.id} ${r.exec.status}`,
      });
    }
  }
}

function view(id: string): RiskCaseDetail | undefined {
  const base = riskCaseDetail(id);
  if (!base) return undefined;
  const s = store.get(id);
  if (!s) return base;
  return {
    ...base,
    status: s.status ?? base.status,
    updated_at: s.updatedAt ?? base.updated_at,
    approvals: [...base.approvals, ...s.approvals],
    executions: [...base.executions, ...s.executions.map((r) => r.exec)],
    timeline: [...base.timeline, ...s.timeline],
  };
}

function listView(): RiskCaseListItem[] {
  return riskCaseList.map((c) => {
    const s = store.get(c.id);
    return s?.status ? { ...c, status: s.status, updated_at: s.updatedAt ?? c.updated_at } : c;
  });
}

function findRecommendation(recId: string): { rec: Recommendation; caseId: string } | undefined {
  for (const c of riskCaseList) {
    const rec = riskCaseDetail(c.id)?.recommendations.find((r) => r.id === recId);
    if (rec) return { rec, caseId: c.id };
  }
  return undefined;
}

/** Same rule the UI applies: no estimate means the data does not support the option. */
export function unsupportedReason(rec: Recommendation): string | null {
  if (rec.estimated_lead_time_days === null || rec.estimated_cost_delta === null) {
    return rec.data_gaps[0] ?? 'Data does not support an estimate for this option.';
  }
  return null;
}

// ---- small copies of the base handlers' private helpers ----
function errorResponse(status: number, code: ErrorCode, message: string, request: Request, details: Record<string, unknown> = {}) {
  const cid = request.headers.get('X-Correlation-ID') ?? crypto.randomUUID();
  return HttpResponse.json({ error: { code, message, details, correlation_id: cid } }, { status, headers: { 'X-Correlation-ID': cid } });
}

function authed(request: Request): { name: string; role: string } | Response {
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  try {
    const pad = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(pad + '='.repeat((4 - (pad.length % 4)) % 4))) as { user_id: string; role: string; exp: number };
    const user = users.find((u) => u.id === claims.user_id);
    if (user && claims.exp > Date.now() / 1000) return { name: user.full_name, role: user.role };
  } catch {
    /* fall through to 401 */
  }
  return errorResponse(401, 'UNAUTHENTICATED', 'Authentication credentials were not provided or are invalid.', request);
}

function paginate<T>(items: T[], url: URL): Paginated<T> {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const size = Math.min(100, Math.max(1, Number(url.searchParams.get('page_size')) || 10));
  const start = (page - 1) * size;
  return {
    count: items.length,
    next: start + size < items.length ? `${url.origin}${url.pathname}?page=${page + 1}` : null,
    previous: page > 1 ? `${url.origin}${url.pathname}?page=${page - 1}` : null,
    results: items.slice(start, start + size),
  };
}

const STATUS_AFTER: Record<ApprovalDecision, RiskCaseState> = {
  APPROVE: 'EXECUTING',
  REJECT: 'REJECTED',
  REQUEST_CHANGES: 'ANALYZING',
};

const API = '*/api/v1';

export const approvalHandlers: HttpHandler[] = [
  http.get(`${API}/risk-cases`, ({ request }) => {
    const user = authed(request);
    if (user instanceof Response) return user;
    settle();
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const severity = url.searchParams.get('severity');
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const filtered = listView().filter(
      (c) =>
        (!status || c.status === status) &&
        (!severity || c.severity === severity) &&
        (!from || c.created_at >= from) &&
        (!to || c.created_at <= to),
    );
    return HttpResponse.json(paginate(filtered, url));
  }),

  http.get(`${API}/risk-cases/:id`, ({ request, params }) => {
    const user = authed(request);
    if (user instanceof Response) return user;
    settle();
    const detail = view(String(params.id));
    if (!detail) return errorResponse(404, 'NOT_FOUND', `Risk case ${params.id} not found.`, request);
    return HttpResponse.json(detail);
  }),

  http.post(`${API}/recommendations/:id/decision`, async ({ request, params }) => {
    const user = authed(request);
    if (user instanceof Response) return user;
    if (!DECIDERS.includes(user.role)) {
      return errorResponse(403, 'FORBIDDEN', 'Only procurement managers can decide on recommendations.', request);
    }
    const body = (await request.json().catch(() => ({}))) as { decision?: ApprovalDecision; comments?: string };
    if (!body.decision || !['APPROVE', 'REJECT', 'REQUEST_CHANGES'].includes(body.decision)) {
      return errorResponse(400, 'VALIDATION_ERROR', 'decision is required.', request, { decision: ['This field is required.'] });
    }
    const comments = body.comments ?? '';
    if (body.decision !== 'APPROVE' && !comments.trim()) {
      return errorResponse(400, 'VALIDATION_ERROR', 'comments are required for this decision.', request, {
        comments: ['This field is required.'],
      });
    }
    settle();
    const recId = String(params.id);
    const found = findRecommendation(recId);
    if (!found) return errorResponse(404, 'NOT_FOUND', `Recommendation ${recId} not found.`, request);
    const current = view(found.caseId);
    if (!current || !PENDING.includes(current.status) || current.approvals.length > 0) {
      return errorResponse(409, 'CONFLICT', `Recommendation ${recId} has already been decided.`, request);
    }
    const reason = unsupportedReason(found.rec);
    if (body.decision === 'APPROVE' && reason) {
      return errorResponse(422, 'BUSINESS_RULE', `Option cannot be approved: ${reason}`, request, {
        data_gaps: found.rec.data_gaps,
      });
    }

    const now = new Date().toISOString();
    const s = caseState(found.caseId);
    const approval: Approval = {
      id: `APR-${String(100 + seq).padStart(6, '0')}`,
      recommendation_id: recId,
      decision: body.decision,
      comments,
      decided_by: user.name,
      decided_at: now,
    };
    s.approvals.push(approval);
    s.status = STATUS_AFTER[body.decision];
    s.updatedAt = now;
    s.timeline.push({ at: now, actor: user.name, action: `DECISION_${body.decision}`, detail: `${approval.id} on ${recId}` });

    let execution: Execution | null = null;
    if (body.decision === 'APPROVE') {
      execution = {
        id: `EXE-${String(100 + seq).padStart(6, '0')}`,
        recommendation_id: recId,
        status: 'RUNNING',
        started_at: now,
        finished_at: null,
        error: null,
        retryable: false,
      };
      const willFail = recId === FAILING_DEMO_RECOMMENDATION && !failedOnce.has(recId);
      if (willFail) failedOnce.add(recId);
      s.executions.push({ exec: execution, startedMs: Date.now(), willFail, settled: false });
    }
    seq += 1;
    return HttpResponse.json({ approval, execution, risk_case_status: s.status });
  }),

  http.post(`${API}/executions/:id/retry`, ({ request, params }) => {
    const user = authed(request);
    if (user instanceof Response) return user;
    if (!DECIDERS.includes(user.role)) {
      return errorResponse(403, 'FORBIDDEN', 'Only procurement managers can retry executions.', request);
    }
    settle();
    const id = String(params.id);
    for (const s of store.values()) {
      const r = s.executions.find((x) => x.exec.id === id);
      if (!r) continue;
      if (r.exec.status !== 'FAILED' || !r.exec.retryable) {
        return errorResponse(409, 'CONFLICT', `Execution ${id} cannot be retried (status ${r.exec.status}).`, request);
      }
      const now = new Date().toISOString();
      r.exec = { ...r.exec, status: 'RUNNING', started_at: now, finished_at: null, error: null, retryable: false };
      r.startedMs = Date.now();
      r.willFail = false;
      r.settled = false;
      s.status = 'EXECUTING';
      s.updatedAt = now;
      s.timeline.push({ at: now, actor: user.name, action: 'EXECUTION_RETRIED', detail: id });
      return HttpResponse.json(r.exec);
    }
    return errorResponse(404, 'NOT_FOUND', `Execution ${id} not found.`, request);
  }),
];
