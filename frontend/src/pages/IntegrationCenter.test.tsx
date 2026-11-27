import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { integrationStatusFixture } from '@/mocks/admin/integrations';
import { renderWithProviders } from '@/test/renderWithProviders';
import { loginAs } from '@/test/loginAs';

const URL = '*/api/v1/integrations/status';

describe('IntegrationCenter (real wire shape)', () => {
  beforeEach(async () => {
    await loginAs('admin');
  });

  it('maps REACHABLE boomi to an Up card with latency and shows 24h event counts', async () => {
    renderWithProviders({ path: '/integrations' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Integration Center' })).toBeInTheDocument();
    const card = await screen.findByTestId('connection-CON-BOOMI-INT');
    expect(within(card).getByText('Up')).toBeInTheDocument();
    expect(within(card).getByText('182 ms')).toBeInTheDocument();
    expect(screen.getByText('1 of 1 healthy')).toBeInTheDocument();
    expect(within(screen.getByTestId('events-published')).getByText('12')).toBeInTheDocument();
    expect(within(screen.getByTestId('events-publish-failed')).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByTestId('events-needs-correction')).getByText('2')).toBeInTheDocument();
  });

  it('UNREACHABLE boomi is Down and reveals the probe error', async () => {
    server.use(http.get(URL, () => HttpResponse.json(integrationStatusFixture({ status: 'UNREACHABLE', reachable: false, latency_ms: null }))));
    renderWithProviders({ path: '/integrations' });
    const card = await screen.findByTestId('connection-CON-BOOMI-INT');
    expect(within(card).getByText('Down')).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: /show last error/i }));
    expect(within(card).getByText('UNREACHABLE')).toBeInTheDocument();
  });

  it('NOT_CONFIGURED boomi shows the fallback note', async () => {
    server.use(
      http.get(URL, () =>
        HttpResponse.json(integrationStatusFixture({ status: 'NOT_CONFIGURED', configured: false, reachable: null, latency_ms: null, checked_at: null, host: '' })),
      ),
    );
    renderWithProviders({ path: '/integrations' });
    const card = await screen.findByTestId('connection-CON-BOOMI-INT');
    expect(within(card).getByText('Fallback')).toBeInTheDocument();
    expect(within(card).getByText(/Boomi is not configured/)).toBeInTheDocument();
  });

  it('refresh button refetches', async () => {
    let calls = 0;
    server.use(
      http.get(URL, () => {
        calls += 1;
        return HttpResponse.json(integrationStatusFixture());
      }),
    );
    renderWithProviders({ path: '/integrations' });
    await screen.findByText('1 of 1 healthy');
    expect(calls).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(calls).toBe(2));
  });

  it('shows error state and retries on a server error', async () => {
    let fail = true;
    server.use(
      http.get(URL, () =>
        fail
          ? HttpResponse.json(
              { error: { code: 'DOWNSTREAM_ERROR', message: 'Status service unavailable.', details: {}, correlation_id: 'cid-1' } },
              { status: 502 },
            )
          : HttpResponse.json(integrationStatusFixture()),
      ),
    );
    renderWithProviders({ path: '/integrations' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Status service unavailable.');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('1 of 1 healthy')).toBeInTheDocument();
  });

  it('403 shows an access message without Retry', async () => {
    server.use(
      http.get(URL, () =>
        HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Permission denied.', details: {}, correlation_id: 'cid-2' } }, { status: 403 }),
      ),
    );
    renderWithProviders({ path: '/integrations' });
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});
