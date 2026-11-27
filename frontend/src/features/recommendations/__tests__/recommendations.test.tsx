import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/renderWithProviders';
import { loginAs } from '@/test/loginAs';
import { server } from '@/mocks/server';
import { riskCaseDetail45 } from '@/mocks/fixtures';

describe('AI Recommendations', () => {
  beforeEach(async () => {
    await loginAs('admin');
  });

  it('renders 4 option cards in rank order for ?case=RC-000045', async () => {
    renderWithProviders({ path: '/recommendations?case=RC-000045' });
    expect(await screen.findByRole('heading', { level: 1, name: 'AI Recommendations' })).toBeInTheDocument();
    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(4);
    expect(cards.map((c) => c.getAttribute('data-rank'))).toEqual(['1', '2', '3', '4']);
    expect(within(cards[0]).getByText('Move 400 units of PO-1001 to SUP-1003')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to approval' })).toHaveAttribute('href', '/approvals?case=RC-000045');
  });

  it('renders the comparison table with best markers', async () => {
    renderWithProviders({ path: '/recommendations?case=RC-000045' });
    const table = await screen.findByRole('table', { name: /comparison/i });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    const row = within(table).getByRole('row', { name: /Inventory transfer/ });
    expect(within(row).getByText(/1 days/)).toBeInTheDocument();
    expect(within(row).getAllByText(/Best/).length).toBeGreaterThan(0);
  });

  it('shows Not available for a null cost', async () => {
    renderWithProviders({ path: '/recommendations?case=RC-000045' });
    const card = (await screen.findAllByRole('article'))[3];
    expect(within(card).getAllByText('Not available')).toHaveLength(2);
    expect(within(card).getAllByText('Missing data').length).toBeGreaterThan(0);
  });

  it('labels unsupported options', async () => {
    renderWithProviders({ path: '/recommendations?case=RC-000045' });
    const cards = await screen.findAllByRole('article');
    expect(within(cards[0]).queryByText(/cannot be approved/)).not.toBeInTheDocument();
    expect(within(cards[3]).getByText(/Not supported by data — cannot be approved/)).toBeInTheDocument();
  });

  it('shows the no-viable-option reason', async () => {
    server.use(
      http.get('*/api/v1/risk-cases/RC-000045', () =>
        HttpResponse.json({
          ...riskCaseDetail45,
          recommendations: [],
          no_viable_option_reason: 'No alternate supplier has capacity.',
        }),
      ),
    );
    renderWithProviders({ path: '/recommendations?case=RC-000045' });
    expect(await screen.findByText('No alternate supplier has capacity.')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('lists pickable cases without ?case', async () => {
    renderWithProviders({ path: '/recommendations' });
    const link = await screen.findByRole('link', { name: /View options for RC-000045/ });
    expect(link).toHaveAttribute('href', '/recommendations?case=RC-000045');
    expect(screen.queryByText(/RC-000044/)).not.toBeInTheDocument();
  });

  it('shows an error state for an unknown case', async () => {
    renderWithProviders({ path: '/recommendations?case=RC-999999' });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('renders recommendations with an analysis-pending note when analysis is null', async () => {
    const d = { ...riskCaseDetail45, analysis: null, status: 'PENDING_APPROVAL' as const };
    server.use(http.get('*/api/v1/risk-cases/RC-000045', () => HttpResponse.json(d)));
    renderWithProviders({ path: '/recommendations?case=RC-000045' });
    expect(await screen.findAllByRole('article')).toHaveLength(4);
    expect(screen.getByText('Analysis pending')).toBeInTheDocument();
  });
});
