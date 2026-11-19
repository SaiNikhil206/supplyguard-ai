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
    await userEvent.selectOptions(screen.getByLabelText('Entity type'), 'APPROVAL');
    await waitFor(() => expect(router.state.location.search).toContain('entity_type=APPROVAL'));
    const table = await screen.findByRole('table', { name: 'Audit events' });
    await waitFor(() => {
      const rows = within(table).getAllByRole('row').slice(1);
      expect(rows.length).toBeGreaterThan(0);
      rows.forEach((r) => expect(r).toHaveTextContent('APPROVAL'));
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
    expect(actions[0]).toContain('RECEIVED');
    expect(actions[actions.length - 1]).toContain('RESULT');
    expect(actions.findIndex((t) => t.includes('DECIDED'))).toBeLessThan(actions.findIndex((t) => t.includes('RESULT')));
  });

  it('notes a missing stage', async () => {
    renderWithProviders({ path: `/audit?correlation_id=${INCOMPLETE_CORRELATION_ID}&view=trace` });
    expect(await screen.findByText(/Missing stage: no Approval events/)).toBeInTheDocument();
    expect(screen.getByText(/Missing stage: no Execution events/)).toBeInTheDocument();
  });

  it('renders SETTINGS and unknown entity events under Other events', async () => {
    const base = {
      actor: { type: 'USER', id: 'USR-001', name: 'Asha Admin' },
      from_state: null,
      to_state: null,
      correlation_id: 'zz',
      detail: 'x',
    };
    const results = [
      { ...base, id: 'A1', at: '2026-11-01T10:00:00Z', entity_type: 'SETTINGS', entity_id: 'SET-1', action: 'UPDATED', detail: 'Threshold changed' },
      { ...base, id: 'A2', at: '2026-11-01T10:01:00Z', entity_type: 'WIDGET', entity_id: 'W-1', action: 'POKED', detail: 'Unknown type' },
    ];
    server.use(http.get('*/api/v1/audit', () => HttpResponse.json({ count: 2, next: null, previous: null, results })));
    renderWithProviders({ path: '/audit?correlation_id=zz&view=trace' });
    const other = await screen.findByTestId('trace-other');
    expect(within(other).getByText('Other events')).toBeInTheDocument();
    expect(within(other).getByText(/Threshold changed/)).toBeInTheDocument();
    expect(within(other).getByText(/Unknown type/)).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    renderWithProviders({ path: '/audit?entity_type=EXECUTION&action=UPDATED' });
    expect(await screen.findByText('No audit events match')).toBeInTheDocument();
  });

  it('shows error with retry', async () => {
    server.use(http.get('*/api/v1/audit', () => HttpResponse.json({ error: { code: 'INTERNAL', message: 'boom', details: {}, correlation_id: 'x' } }, { status: 500 })));
    renderWithProviders({ path: '/audit' });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
