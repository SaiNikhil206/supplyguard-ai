import { http, HttpResponse, type HttpHandler } from 'msw';
import type { AuditEventWire } from '@/api/admin/audit';

export const RC45_CORRELATION_ID = '6f1c2a54-8d3e-4b7a-9c10-5e2f7a1b3d90';
export const INCOMPLETE_CORRELATION_ID = 'b2d4e6f8-1111-4a2b-8c3d-aaaaaaaaaaaa';

const PAGE_SIZE = 25; // DRF PageNumberPagination, fixed
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Omit<AuditEventWire, 'id'>;
const row = (
  timestamp: string,
  actor: string,
  action: string,
  entity_type: string,
  entity_id: string,
  correlation_id: string | null,
  data: Record<string, unknown> = {},
): Row => ({ timestamp, actor, action, entity_type, entity_id, correlation_id, data });

const c45 = RC45_CORRELATION_ID;
/** Event -> analysis -> approval -> execution, with the real action names the backend writes. */
const chain45: Row[] = [
  row('2026-11-18T09:00:05Z', 'SYSTEM', 'event.received', 'DisruptionEvent', 'EVT-000045', c45, { reason: 'Fire at Pune Forge & Motors Line 2' }),
  row('2026-11-18T09:00:09Z', 'SYSTEM', 'risk_case.created', 'RiskCase', 'RC-000045', c45, { affected_po_count: 3 }),
  row('2026-11-18T09:00:31Z', 'SYSTEM', 'analysis.recorded', 'RiskCase', 'RC-000045', c45, { risk_score: 92 }),
  row('2026-11-18T09:00:34Z', 'SYSTEM', 'risk_case.status_changed', 'RiskCase', 'RC-000045', c45, { from: 'ANALYZING', to: 'PENDING_APPROVAL' }),
  row('2026-11-18T10:12:40Z', 'USR-2', 'recommendation.decided', 'Recommendation', 'REC-000045-A', c45, { decision: 'APPROVED', comments: 'go ahead' }),
  row('2026-11-18T10:12:42Z', 'USR-2', 'risk_case.status_changed', 'RiskCase', 'RC-000045', c45, { from: 'PENDING_APPROVAL', to: 'APPROVED' }),
  row('2026-11-18T10:13:05Z', 'SYSTEM', 'execution.dispatch_stubbed', 'Execution', 'EXE-000045', c45, { po: 'PO-1001' }),
];

// Chain without approval/execution: exercises the "missing stage" note.
const cInc = INCOMPLETE_CORRELATION_ID;
const chainIncomplete: Row[] = [
  row('2026-11-17T14:00:00Z', 'SYSTEM', 'event.received', 'DisruptionEvent', 'EVT-000044', cInc, { reason: 'Port strike notice' }),
  row('2026-11-17T14:00:20Z', 'SYSTEM', 'analysis.recorded', 'RiskCase', 'RC-000044', cInc, { risk_score: 61 }),
];

const kinds: [string, string, string, string, Record<string, unknown>][] = [
  ['event.received', 'DisruptionEvent', 'SYSTEM', 'EVT-0', {}],
  ['risk_case.status_changed', 'RiskCase', 'SYSTEM', 'RC-0', { from: 'NEW', to: 'ANALYZING' }],
  ['analysis.recorded', 'RiskCase', 'SYSTEM', 'RC-0', { risk_score: 40 }],
  ['recommendation.decided', 'Recommendation', 'USR-2', 'REC-0', { decision: 'REJECTED', comments: 'cost too high' }],
  ['settings.updated', 'Tenant', 'USR-1', 'TEN-ACME', { changed: 'risk_thresholds' }],
];
const noise: Row[] = [];
for (let i = 0; i < 20; i++) {
  const [action, entity_type, actor, id, data] = kinds[i % kinds.length];
  const day = String(1 + (i % 16)).padStart(2, '0');
  const hh = String(8 + (i % 9)).padStart(2, '0');
  const mm = String((i * 7) % 60).padStart(2, '0');
  noise.push(
    row(`2026-11-${day}T${hh}:${mm}:00Z`, actor, action, entity_type, `${id}${100 + i}`, `c0ffee00-0000-4000-8000-${String(i).padStart(12, '0')}`, data),
  );
}

/** Newest first, numeric ids, like the real endpoint. */
export const auditEvents: AuditEventWire[] = [...chain45, ...chainIncomplete, ...noise]
  .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  .map((r, i) => ({ id: 1000 - i, ...r }));

function errBody(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
  return HttpResponse.json({ error: { code, message, details, correlation_id: 'mock' } }, { status });
}

function role(request: Request): string | null {
  const t = (request.headers.get('Authorization') ?? '').replace('Bearer ', '');
  try {
    const p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return (JSON.parse(atob(p + '='.repeat((4 - (p.length % 4)) % 4))) as { role: string }).role;
  } catch {
    return null;
  }
}

/** `to` is EXCLUSIVE and `from` inclusive, as on the backend; date-only values mean midnight UTC. */
const toMs = (v: string) => Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00Z` : v);

export const auditHandlers: HttpHandler[] = [
  http.get('*/api/v1/audit', ({ request }) => {
    const r = role(request);
    if (!r) return errBody(401, 'UNAUTHENTICATED', 'Authentication credentials were not provided.');
    if (r !== 'ADMIN' && r !== 'PROCUREMENT_MANAGER') return errBody(403, 'FORBIDDEN', 'Permission denied.');
    const p = new URL(request.url).searchParams;
    const cid = p.get('correlation_id');
    if (cid && !UUID_RE.test(cid)) {
      return errBody(400, 'VALIDATION_ERROR', 'Validation failed.', { correlation_id: ['Must be a valid UUID.'] });
    }
    const et = p.get('entity_type');
    const action = p.get('action');
    const from = p.get('from');
    const to = p.get('to');
    const filtered = auditEvents.filter(
      (e) =>
        (!et || e.entity_type === et) &&
        (!action || e.action === action) &&
        (!from || Date.parse(e.timestamp) >= toMs(from)) &&
        (!to || Date.parse(e.timestamp) < toMs(to)) &&
        (!cid || e.correlation_id === cid),
    );
    const page = Math.max(1, Number(p.get('page')) || 1);
    const start = (page - 1) * PAGE_SIZE;
    if (start > 0 && start >= filtered.length) return errBody(404, 'NOT_FOUND', 'Invalid page.');
    return HttpResponse.json({
      count: filtered.length,
      next: start + PAGE_SIZE < filtered.length ? `http://localhost/api/v1/audit?page=${page + 1}` : null,
      previous: page > 1 ? `http://localhost/api/v1/audit?page=${page - 1}` : null,
      results: filtered.slice(start, start + PAGE_SIZE),
    });
  }),
];
