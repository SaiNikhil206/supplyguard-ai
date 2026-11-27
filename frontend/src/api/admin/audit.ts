import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import type { Paginated } from '@/api/types';

/**
 * REAL wire shape of GET /api/v1/audit (backend/apps/audit AuditEventSerializer):
 * { id, timestamp, actor, action, entity_type, entity_id, correlation_id, data }.
 * Admin and PROCUREMENT_MANAGER may read (audit.read); other roles get 403.
 * Pagination is DRF PageNumberPagination (25 per page, `?page=`; no page_size param).
 * Order is newest first. Filters: entity_type, action (exact), correlation_id (UUID, else 400),
 * from (inclusive) / to (EXCLUSIVE) as ISO date or datetime.
 */
export interface AuditEventWire {
  id: number | string;
  timestamp: string;
  actor: string; // 'USR-<n>' | 'SYSTEM' | an external source
  action: string; // e.g. 'risk_case.status_changed'
  entity_type: string; // model name e.g. 'RiskCase', 'DisruptionEvent', 'Recommendation'
  entity_id: string;
  correlation_id: string | null;
  data: Record<string, unknown>;
}

/** Entity types the backend writes today (used for the filter dropdown; free text is not offered). */
export const AUDIT_ENTITY_TYPES = [
  'DisruptionEvent',
  'RiskCase',
  'Recommendation',
  'Execution',
  'Tenant',
  'User',
  'Supplier',
  'PurchaseOrder',
] as const;

/** Action names the backend writes today (apps.* record() calls). */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'event.publish_skipped': 'Event publish skipped',
  'api_key.created': 'API key created',
  'security.api_key_rejected': 'API key rejected',
};

export const actionLabel = (a: string): string => AUDIT_ACTION_LABELS[a] ?? a;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string): boolean => UUID_RE.test(s.trim());

export const AUDIT_ACTIONS = [
  'event.received',
  'event.duplicate',
  'event.flagged_data_correction',
  'event.publish_skipped',
  'risk_case.created',
  'risk_case.status_changed',
  'analysis.recorded',
  'analysis.invalid',
  'analysis.rejected',
  'analysis.request_failed',
  'recommendation.decided',
  'execution.dispatch_stubbed',
  'settings.updated',
  'user.created',
  'api_key.created',
  'security.api_key_rejected',
  'what_if.run',
  'auth.login',
  'auth.login_failed',
];

/** UI view-model built from the wire row. */
export interface AuditEvent {
  id: string;
  at: string;
  actor: { type: 'USER' | 'SYSTEM' | 'AGENT'; id: string; name: string };
  entity_type: string;
  entity_id: string;
  action: string;
  from_state: string | null;
  to_state: string | null;
  correlation_id: string | null;
  detail: string;
  data: Record<string, unknown>;
}

export interface AuditFilters {
  entity_type?: string;
  action?: string;
  from?: string;
  to?: string;
  correlation_id?: string;
  page?: number;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

function describe(w: AuditEventWire): string {
  const d = w.data ?? {};
  const bits: string[] = [];
  const reason = str(d.reason) ?? str(d.comments);
  if (w.action === 'recommendation.decided' && str(d.decision)) {
    bits.push(`Decision ${String(d.decision)} on ${w.entity_type} ${w.entity_id}`);
  }
  if (reason) bits.push(reason);
  if (bits.length === 0) {
    for (const [k, v] of Object.entries(d)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        bits.push(`${k}: ${String(v)}`);
      }
      if (bits.length >= 4) break;
    }
  }
  return bits.join(' - ');
}

export function normalizeAudit(w: AuditEventWire): AuditEvent {
  const isUser = /^USR-/i.test(w.actor);
  const d = w.data ?? {};
  return {
    id: String(w.id),
    at: w.timestamp,
    actor: {
      type: isUser ? 'USER' : 'SYSTEM',
      id: w.actor,
      name: w.actor === 'SYSTEM' ? 'System' : w.actor,
    },
    entity_type: w.entity_type,
    entity_id: w.entity_id,
    action: w.action,
    from_state: w.action === 'risk_case.status_changed' ? str(d.from) : null,
    to_state: w.action === 'risk_case.status_changed' ? str(d.to) : null,
    correlation_id: w.correlation_id,
    detail: describe(w),
    data: d,
  };
}

export function listAudit(filters: AuditFilters = {}): Promise<Paginated<AuditEvent>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return apiFetch<Paginated<AuditEventWire>>(`/audit${s ? `?${s}` : ''}`).then((p) => ({
    ...p,
    results: p.results.map(normalizeAudit),
  }));
}

export const useAudit = (filters: AuditFilters = {}) =>
  useQuery({ queryKey: ['audit', filters], queryFn: () => listAudit(filters) });

const MAX_TRACE_PAGES = 20;

/**
 * All events of one correlation id (AC-07). There is no trace endpoint: follow `next` of
 * GET /audit?correlation_id=... and order client-side by timestamp (oldest first, id as tiebreak).
 */
export async function fetchTrace(correlationId: string): Promise<AuditEvent[]> {
  const all: AuditEvent[] = [];
  for (let page = 1; page <= MAX_TRACE_PAGES; page++) {
    const res = await listAudit({ correlation_id: correlationId, page });
    all.push(...res.results);
    if (!res.next) break;
  }
  return sortOldestFirst(all);
}

export function sortOldestFirst(events: AuditEvent[]): AuditEvent[] {
  return [...events].sort(
    (a, b) =>
      new Date(a.at).getTime() - new Date(b.at).getTime() ||
      Number(a.id) - Number(b.id) ||
      a.id.localeCompare(b.id),
  );
}

export const useAuditTrace = (correlationId: string) =>
  useQuery({
    queryKey: ['audit', 'trace', correlationId],
    queryFn: () => fetchTrace(correlationId),
    enabled: !!correlationId,
  });
