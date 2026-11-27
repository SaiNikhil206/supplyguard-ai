import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../client';

/**
 * REAL wire shape of GET /api/v1/integrations/status (backend/apps/integrations IntegrationStatusView,
 * ADMIN only): only the Boomi connection plus 24 h event counts. Per-service health (Event Streams,
 * Agentstudio, Flow, API Management, Mock ERP, DB) is NOT reported by the backend yet (gap for Uday),
 * so the UI shows one Boomi card and the event counts.
 */
export type BoomiWireStatus = 'NOT_CONFIGURED' | 'REACHABLE' | 'UNREACHABLE';

export interface IntegrationStatusWire {
  boomi: {
    status: BoomiWireStatus | string;
    configured: boolean;
    auth_mode: string;
    host: string;
    reachable: boolean | null;
    latency_ms: number | null;
    checked_at: string | null;
  };
  events_24h: {
    RECEIVED: number;
    PUBLISHED: number;
    PUBLISH_FAILED: number;
    needs_data_correction: number;
  };
}

export type ConnectionKind =
  | 'BOOMI_INTEGRATION'
  | 'EVENT_STREAMS'
  | 'AGENTSTUDIO'
  | 'FLOW'
  | 'API_MANAGEMENT'
  | 'MOCK_ERP'
  | 'DATABASE';
export type ConnectionStatus = 'UP' | 'DEGRADED' | 'DOWN' | 'FALLBACK';

export interface ConnectionError {
  code: string;
  message: string;
  at: string;
}

/** UI view-model of one connection card (derived from the wire shape). */
export interface Connection {
  id: string;
  name: string;
  kind: ConnectionKind;
  status: ConnectionStatus;
  latency_ms: number | null;
  last_success_at: string | null;
  last_error: ConnectionError | null;
  fallback_note: string | null;
}

export interface IntegrationStatus {
  checked_at: string;
  connections: Connection[];
  events_24h: IntegrationStatusWire['events_24h'];
}

/** Map the wire payload to cards. NOT_CONFIGURED shows as FALLBACK (backend runs without Boomi). */
export function toIntegrationStatus(w: IntegrationStatusWire): IntegrationStatus {
  const b = w.boomi;
  const checked = b.checked_at ?? new Date().toISOString();
  const target = b.host || 'Boomi';
  let conn: Connection;
  if (b.status === 'REACHABLE') {
    conn = {
      id: 'CON-BOOMI-INT',
      name: 'Boomi Integration',
      kind: 'BOOMI_INTEGRATION',
      status: 'UP',
      latency_ms: b.latency_ms,
      last_success_at: b.checked_at,
      last_error: null,
      fallback_note: null,
    };
  } else if (b.status === 'UNREACHABLE') {
    conn = {
      id: 'CON-BOOMI-INT',
      name: 'Boomi Integration',
      kind: 'BOOMI_INTEGRATION',
      status: 'DOWN',
      latency_ms: null,
      last_success_at: null,
      last_error: { code: 'UNREACHABLE', message: `Health probe to ${target} failed.`, at: checked },
      fallback_note: null,
    };
  } else {
    conn = {
      id: 'CON-BOOMI-INT',
      name: 'Boomi Integration',
      kind: 'BOOMI_INTEGRATION',
      status: 'FALLBACK',
      latency_ms: null,
      last_success_at: null,
      last_error: null,
      fallback_note: `Boomi is not configured (auth mode: ${b.auth_mode}). Events are stored but not published.`,
    };
  }
  return { checked_at: checked, connections: [conn], events_24h: w.events_24h };
}

export const INTEGRATIONS_POLL_MS = 30_000;

export const getIntegrationStatus = () => apiFetch<IntegrationStatusWire>('/integrations/status').then(toIntegrationStatus);

export const integrationsQueryKey = ['integrations', 'status'] as const;

export const useIntegrationStatus = () =>
  useQuery({
    queryKey: integrationsQueryKey,
    queryFn: getIntegrationStatus,
    refetchInterval: INTEGRATIONS_POLL_MS,
  });
