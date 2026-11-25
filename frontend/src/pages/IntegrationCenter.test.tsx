import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { integrationStatusFixture } from '@/mocks/admin/integrations';
import { renderWithProviders } from '@/test/renderWithProviders';
import { loginAs } from '@/test/loginAs';

const URL = '*/api/v1/integrations/status';

describe('IntegrationCenter', () => {
  beforeEach(async () => {
    await loginAs('admin');
  });

  it('renders a card per connection with status text', async () => {
    renderWithProviders({ path: '/integrations' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Integration Center' })).toBeInTheDocument();
    const es = await screen.findByTestId('connection-CON-EVENT-STREAMS');
    expect(within(es).getByText('Fallback')).toBeInTheDocument();
    expect(within(es).getByText(/API Management endpoint/)).toBeInTheDocument();
    expect(within(screen.getByTestId('connection-CON-FLOW')).getByText('Degraded')).toBeInTheDocument();
    expect(within(screen.getByTestId('connection-CON-DB')).getByText('4 ms')).toBeInTheDocument();
  });

  it('shows the healthy summary count', async () => {
    renderWithProviders({ path: '/integrations' });
    expect(await screen.findByText('4 of 7 healthy')).toBeInTheDocument();
    expect(screen.getByText(/checked at/)).toBeInTheDocument();
  });

  it('DOWN card reveals its last error', async () => {
    renderWithProviders({ path: '/integrations' });
    const erp = await screen.findByTestId('connection-CON-MOCK-ERP');
    expect(within(erp).getByText('Down')).toBeInTheDocument();
    expect(within(erp).queryByText(/Connection refused/)).not.toBeInTheDocument();
    await userEvent.click(within(erp).getByRole('button', { name: /show last error/i }));
    expect(within(erp).getByText(/Connection refused/)).toBeInTheDocument();
    expect(within(erp).getByText('ERP_UNAVAILABLE')).toBeInTheDocument();
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
    await screen.findByText('4 of 7 healthy');
    expect(calls).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(calls).toBe(2));
  });

  it('shows error state and retries', async () => {
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
    expect(await screen.findByText('4 of 7 healthy')).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ checked_at: new Date().toISOString(), connections: [] })));
    renderWithProviders({ path: '/integrations' });
    expect(await screen.findByText('No integrations configured')).toBeInTheDocument();
  });
});
