import { http, HttpResponse, type HttpHandler } from 'msw';
import type { IntegrationStatus } from '@/api/admin/integrations';

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

export function integrationStatusFixture(): IntegrationStatus {
  return {
    checked_at: new Date().toISOString(),
    connections: [
      { id: 'CON-BOOMI-INT', name: 'Boomi Integration', kind: 'BOOMI_INTEGRATION', status: 'UP', latency_ms: 182, last_success_at: ago(45_000), last_error: null, fallback_note: null },
      { id: 'CON-EVENT-STREAMS', name: 'Event Streams', kind: 'EVENT_STREAMS', status: 'FALLBACK', latency_ms: null, last_success_at: ago(6 * 3600_000), last_error: { code: 'DOWNSTREAM_ERROR', message: 'Event Streams topic supplier.disruption not provisioned.', at: ago(6 * 3600_000) }, fallback_note: 'Using fallback: Boomi process triggered directly by the API Management endpoint (CONTRACTS section 8).' },
      { id: 'CON-AGENTSTUDIO', name: 'Agentstudio', kind: 'AGENTSTUDIO', status: 'UP', latency_ms: 940, last_success_at: ago(2 * 60_000), last_error: null, fallback_note: null },
      { id: 'CON-FLOW', name: 'Boomi Flow', kind: 'FLOW', status: 'DEGRADED', latency_ms: 2310, last_success_at: ago(12 * 60_000), last_error: { code: 'TIMEOUT', message: 'Flow approval callback exceeded 2s threshold.', at: ago(15 * 60_000) }, fallback_note: null },
      { id: 'CON-API-MGMT', name: 'API Management', kind: 'API_MANAGEMENT', status: 'UP', latency_ms: 96, last_success_at: ago(20_000), last_error: null, fallback_note: null },
      { id: 'CON-MOCK-ERP', name: 'Mock ERP', kind: 'MOCK_ERP', status: 'DOWN', latency_ms: null, last_success_at: ago(3 * 3600_000), last_error: { code: 'ERP_UNAVAILABLE', message: 'Connection refused on mock-erp:8001.', at: ago(90_000) }, fallback_note: null },
      { id: 'CON-DB', name: 'PostgreSQL', kind: 'DATABASE', status: 'UP', latency_ms: 4, last_success_at: ago(5_000), last_error: null, fallback_note: null },
    ],
  };
}

export const integrationHandlers: HttpHandler[] = [
  http.get('*/api/v1/integrations/status', ({ request }) => {
    const auth = request.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication credentials were not provided.', details: {}, correlation_id: 'mock' } },
        { status: 401 },
      );
    }
    return HttpResponse.json(integrationStatusFixture());
  }),
];
