import { http, HttpResponse, type HttpHandler } from 'msw';
import { gate } from './settings';
import type { IntegrationStatusWire } from '@/api/admin/integrations';

export function integrationStatusFixture(
  boomi: Partial<IntegrationStatusWire['boomi']> = {},
): IntegrationStatusWire {
  return {
    boomi: {
      status: 'REACHABLE',
      configured: true,
      auth_mode: 'basic',
      host: 'api.boomi.com',
      reachable: true,
      latency_ms: 182,
      checked_at: new Date().toISOString(),
      ...boomi,
    },
    events_24h: { RECEIVED: 3, PUBLISHED: 12, PUBLISH_FAILED: 1, needs_data_correction: 2 },
  };
}

export const integrationHandlers: HttpHandler[] = [
  http.get('*/api/v1/integrations/status', ({ request }) => {
    const denied = gate(request); // ADMIN only: 401 without a valid token, 403 for other roles
    return denied ?? HttpResponse.json(integrationStatusFixture());
  }),
];
