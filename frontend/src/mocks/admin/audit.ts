import { http, HttpResponse, type HttpHandler } from 'msw';
import type { AuditEvent } from '@/api/admin/audit';

export const RC45_CORRELATION_ID = '6f1c2a54-8d3e-4b7a-9c10-5e2f7a1b3d90';
export const INCOMPLETE_CORRELATION_ID = 'b2d4e6f8-1111-4a2b-8c3d-aaaaaaaaaaaa';

const SYS = { type: 'SYSTEM', id: 'sys-boomi', name: 'Boomi Integration' } as const;
const AGENT = { type: 'AGENT', id: 'agt-risk', name: 'Risk Analyst Agent' } as const;
const MGR = { type: 'USER', id: 'USR-002', name: 'Meera Manager' } as const;
const ADM = { type: 'USER', id: 'USR-001', name: 'Asha Admin' } as const;

type Row = Omit<AuditEvent, 'id'>;

const c45 = RC45_CORRELATION_ID;
const chain45: Row[] = [
  { at: '2026-11-18T09:00:05Z', actor: SYS, entity_type: 'EVENT', entity_id: 'EVT-000045', action: 'RECEIVED', from_state: null, to_state: 'RECEIVED', correlation_id: c45, detail: 'Fire at Pune Forge & Motors Line 2 received from news feed.' },
  { at: '2026-11-18T09:00:09Z', actor: SYS, entity_type: 'RISK_CASE', entity_id: 'RC-000045', action: 'CREATED', from_state: null, to_state: 'NEW', correlation_id: c45, detail: 'Risk case opened; 3 POs correlated.' },
  { at: '2026-11-18T09:00:31Z', actor: AGENT, entity_type: 'ANALYSIS', entity_id: 'ANL-000045', action: 'STORED', from_state: null, to_state: null, correlation_id: c45, detail: 'Analysis stored, risk score 92, schema valid, facts checked.' },
  { at: '2026-11-18T09:00:33Z', actor: AGENT, entity_type: 'RECOMMENDATION', entity_id: 'REC-000045-A', action: 'STORED', from_state: null, to_state: null, correlation_id: c45, detail: 'Recommended: reroute PO-1001 to alternate supplier.' },
  { at: '2026-11-18T09:00:34Z', actor: SYS, entity_type: 'RISK_CASE', entity_id: 'RC-000045', action: 'TRANSITION', from_state: 'NEW', to_state: 'AWAITING_APPROVAL', correlation_id: c45, detail: 'Analysis ready; awaiting human approval.' },
  { at: '2026-11-18T10:12:40Z', actor: MGR, entity_type: 'APPROVAL', entity_id: 'APR-000045', action: 'DECIDED', from_state: 'PENDING', to_state: 'APPROVED', correlation_id: c45, detail: 'Approved option REC-000045-A. Comment: go ahead.' },
  { at: '2026-11-18T10:12:42Z', actor: SYS, entity_type: 'RISK_CASE', entity_id: 'RC-000045', action: 'TRANSITION', from_state: 'AWAITING_APPROVAL', to_state: 'APPROVED', correlation_id: c45, detail: 'Approval recorded.' },
  { at: '2026-11-18T10:13:05Z', actor: SYS, entity_type: 'EXECUTION', entity_id: 'EXE-000045', action: 'RESULT', from_state: 'RUNNING', to_state: 'SUCCEEDED', correlation_id: c45, detail: 'ERP PO-1001 updated: supplier SUP-0007, delivery 2026-11-25.' },
];

// Chain without approval/execution: exercises the "missing stage" note.
const cInc = INCOMPLETE_CORRELATION_ID;
const chainIncomplete: Row[] = [
  { at: '2026-11-17T14:00:00Z', actor: SYS, entity_type: 'EVENT', entity_id: 'EVT-000044', action: 'RECEIVED', from_state: null, to_state: 'RECEIVED', correlation_id: cInc, detail: 'Port strike notice received.' },
  { at: '2026-11-17T14:00:20Z', actor: AGENT, entity_type: 'ANALYSIS', entity_id: 'ANL-000044', action: 'STORED', from_state: null, to_state: null, correlation_id: cInc, detail: 'Analysis stored, risk score 61.' },
];

type Kind = [Row['entity_type'], string, string | null, string | null, Row['actor'], string];
const kinds: Kind[] = [
  ['EVENT', 'RECEIVED', null, 'RECEIVED', SYS, 'Disruption event received.'],
  ['RISK_CASE', 'TRANSITION', 'NEW', 'UNDER_REVIEW', SYS, 'Case moved to review.'],
  ['ANALYSIS', 'STORED', null, null, AGENT, 'Analysis stored.'],
  ['APPROVAL', 'DECIDED', 'PENDING', 'REJECTED', MGR, 'Rejected: cost too high.'],
  ['SETTINGS', 'UPDATED', null, null, ADM, 'Approval threshold changed.'],
];
const noise: Row[] = [];
for (let i = 0; i < 20; i++) {
  const [entity_type, action, from_state, to_state, actor, detail] = kinds[i % kinds.length];
  const day = String(1 + (i % 16)).padStart(2, '0');
  const hh = String(8 + (i % 9)).padStart(2, '0');
  const mm = String((i * 7) % 60).padStart(2, '0');
  noise.push({
    at: `2026-11-${day}T${hh}:${mm}:00Z`,
    actor,
    entity_type,
    entity_id: `${entity_type.slice(0, 3)}-${100 + i}`,
    action,
    from_state,
    to_state,
    correlation_id: `c0ffee00-0000-4000-8000-${String(i).padStart(12, '0')}`,
    detail,
  });
}

/** Newest first. */
export const auditEvents: AuditEvent[] = [...chain45, ...chainIncomplete, ...noise]
  .sort((a, b) => b.at.localeCompare(a.at))
  .map((r, i) => ({ id: `AUD-${String(i + 1).padStart(6, '0')}`, ...r }));

export const auditHandlers: HttpHandler[] = [
  http.get('*/api/v1/audit', ({ request }) => {
    const p = new URL(request.url).searchParams;
    const et = p.get('entity_type');
    const action = p.get('action');
    const from = p.get('from');
    const to = p.get('to');
    const cid = p.get('correlation_id');
    const filtered = auditEvents.filter(
      (e) =>
        (!et || e.entity_type === et) &&
        (!action || e.action === action) &&
        (!from || e.at.slice(0, 10) >= from) &&
        (!to || e.at.slice(0, 10) <= to) &&
        (!cid || e.correlation_id === cid),
    );
    const page = Math.max(1, Number(p.get('page')) || 1);
    const size = Math.min(100, Math.max(1, Number(p.get('page_size')) || 10));
    const start = (page - 1) * size;
    return HttpResponse.json({
      count: filtered.length,
      next: start + size < filtered.length ? 'next' : null,
      previous: page > 1 ? 'prev' : null,
      results: filtered.slice(start, start + size),
    });
  }),
];
