import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import type { Paginated } from '@/api/types';

// PROVISIONAL shapes: align with docs/CONTRACTS.md once U-05 lands.
export type AuditEntityType =
  | 'EVENT'
  | 'RISK_CASE'
  | 'ANALYSIS'
  | 'RECOMMENDATION'
  | 'APPROVAL'
  | 'EXECUTION'
  | 'SETTINGS';

export const AUDIT_ENTITY_TYPES: AuditEntityType[] = [
  'EVENT',
  'RISK_CASE',
  'ANALYSIS',
  'RECOMMENDATION',
  'APPROVAL',
  'EXECUTION',
  'SETTINGS',
];

export interface AuditEvent {
  id: string;
  at: string;
  actor: { type: 'USER' | 'SYSTEM' | 'AGENT'; id: string; name: string };
  entity_type: AuditEntityType;
  entity_id: string;
  action: string;
  from_state: string | null;
  to_state: string | null;
  correlation_id: string;
  detail: string;
}

export interface AuditFilters {
  entity_type?: string;
  action?: string;
  from?: string;
  to?: string;
  correlation_id?: string;
  page?: number;
  page_size?: number;
}

export function listAudit(filters: AuditFilters = {}): Promise<Paginated<AuditEvent>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return apiFetch<Paginated<AuditEvent>>(`/audit${s ? `?${s}` : ''}`);
}

export const useAudit = (filters: AuditFilters = {}) =>
  useQuery({ queryKey: ['audit', filters], queryFn: () => listAudit(filters) });
