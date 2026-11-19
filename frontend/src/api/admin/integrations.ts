import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../client';

// PROVISIONAL shape (GET /integrations/status) - confirm against U-05/U-06.
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
}

export const INTEGRATIONS_POLL_MS = 30_000;

export const getIntegrationStatus = () => apiFetch<IntegrationStatus>('/integrations/status');

export const integrationsQueryKey = ['integrations', 'status'] as const;

export const useIntegrationStatus = () =>
  useQuery({
    queryKey: integrationsQueryKey,
    queryFn: getIntegrationStatus,
    refetchInterval: INTEGRATIONS_POLL_MS,
  });
