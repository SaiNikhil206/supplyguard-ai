import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { INCOMPLETE_CORRELATION_ID, RC45_CORRELATION_ID } from '@/mocks/admin/audit';
import { renderWithProviders } from '@/test/renderWithProviders';
import { loginAs } from '@/test/loginAs';

describe('Audit Center', () => {
  beforeEach(async () => {
    await loginAs('admin');
  });

  it('renders rows', async () => {
    renderWithProviders({ path: '/audit' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Audit Center' })).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Audit events' });
    expect((await within(table).findAllByRole('row')).length).toBeGreaterThan(5);
  });

  it('puts a filter in the URL', async () => {
    const { router } = renderWithProviders({ path: '/audit' });
    await screen.findByRole('table', { name: 'Audit events' });
    await userEvent.selectOptions(screen.getByLabelText('Entity type'), 'Recommendation');
    await waitFor(() => expect(router.state.location.search).toContain('entity_type=Recommendation'));
    const table = await screen.findByRole('table', { name: 'Audit events' });
    await waitFor(() => {
      const rows = within(table).getAllByRole('row').slice(1);
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((r) => expect(r).toHaveTextContent('Recommendation'));
    });
  });

  it('AC-07: correlation search shows four stages in order', async () => {
    const { router } = renderWithProviders({ path: '/audit' });
    await screen.findByRole('table', { name: 'Audit events' });
    await userEvent.type(screen.getByLabelText('Correlation ID'), RC45_CORRELATION_ID);
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(router.state.location.search).toContain('view=trace'));
    const stages = await screen.findAllByTestId('trace-stage');
    expect(stages.map((s) => s.getAttribute('aria-label'))).toEqual(['Event', 'Analysis', 'Approval', 'Execution']);
    stages.forEach((s) => expect(within(s).queryByText(/Missing stage/)).toBeNull());
    const actions = screen.getAllByTestId('trace-event').map((e) => e.textContent ?? '');
    expect(actions[0]).toContain('event.received');
    expect(actions[actions.length - 1]).toContain('execution.dispatch_stubbed');
    expect(actions.findIndex((t) => t.includes('recommendation.decided'))).toBeLessThan(actions.findIndex((t) => t.includes('execution.dispatch_stubbed')));
  });

  it('notes a missing stage', async () => {
    renderWithProviders({ path: `/audit?correlation_id=${INCOMPLETE_CORRELATION_ID}&view=trace` });
    expect(await screen.findByText(/Missing stage: no Approval events/)).toBeInTheDocument();
    expect(screen.getByText(/Missing stage: no Execution events/)).toBeInTheDocument();
  });

  it('renders settings and unknown entity events under Other events', async () => {
    const base = { actor: 'USR-1', correlation_id: 'zz', data: {} };
    const results = [
      { ...base, id: 2, timestamp: '2026-11-01T10:01:00Z', entity_type: 'Widget', entity_id: 'W-1', action: 'widget.poked', data: { reason: 'Unknown type' } },
      { ...base, id: 1, timestamp: '2026-11-01T10:00:00Z', entity_type: 'Tenant', entity_id: 'TEN-ACME', action: 'settings.updated', data: { reason: 'Threshold changed' } },
    ];
    server.use(http.get('*/api/v1/audit', () => HttpResponse.json({ count: 2, next: null, previous: null, results })));
    renderWithProviders({ path: '/audit?correlation_id=zz&view=trace' });
    const other = await screen.findByTestId('trace-other');
    expect(within(other).getByText('Other events')).toBeInTheDocument();
    expect(within(other).getByText(/Threshold changed/)).toBeInTheDocument();
    expect(within(other).getByText(/Unknown type/)).toBeInTheDocument();
  });

  it('follows pagination and orders a trace by timestamp, not by API order', async () => {
    const mk = (id: number, timestamp: string, action: string, entity_type: string) => ({
      id, timestamp, actor: 'SYSTEM', action, entity_type, entity_id: 'X-1', correlation_id: 'zz', data: {},
    });
    server.use(
      http.get('*/api/v1/audit', ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        return page === '2'
          ? HttpResponse.json({ count: 2, next: null, previous: 'p', results: [mk(1, '2026-11-01T10:00:00Z', 'event.received', 'DisruptionEvent')] })
          : HttpResponse.json({ count: 2, next: 'http://x/api/v1/audit?page=2', previous: null, results: [mk(2, '2026-11-01T10:05:00Z', 'analysis.recorded', 'RiskCase')] });
      }),
    );
    renderWithProviders({ path: '/audit?correlation_id=zz&view=trace' });
    const events = await screen.findAllByTestId('trace-event');
    expect(events).toHaveLength(2);
    expect(events[0]).toHaveTextContent('event.received');
    expect(events[1]).toHaveTextContent('analysis.recorded');
  });

  it('403 shows an access message without Retry', async () => {
    server.use(http.get('*/api/v1/audit', () => HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Permission denied.', details: {}, correlation_id: 'c-403' } }, { status: 403 })));
    renderWithProviders({ path: '/audit' });
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('shows the backend message for a malformed correlation id (400)', async () => {
    renderWithProviders({ path: '/audit?correlation_id=not-a-uuid&view=trace' });
    expect(await screen.findByText(/correlation_id: Must be a valid UUID/)).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    renderWithProviders({ path: '/audit?entity_type=Execution&action=settings.updated' });
    expect(await screen.findByText('No audit events match')).toBeInTheDocument();
  });

  it('shows error with retry', async () => {
    server.use(http.get('*/api/v1/audit', () => HttpResponse.json({ error: { code: 'INTERNAL', message: 'boom', details: {}, correlation_id: 'x' } }, { status: 500 })));
    renderWithProviders({ path: '/audit' });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
