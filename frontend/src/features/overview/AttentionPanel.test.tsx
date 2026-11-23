import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/renderWithProviders';
import { loginAs } from '@/test/loginAs';
import { server } from '@/mocks/server';
import type { RiskCaseListItem } from '@/api/types';
import { topOpenCases } from './format';

const mk = (over: Partial<RiskCaseListItem>): RiskCaseListItem => ({
  id: 'RC-1',
  status: 'PENDING_APPROVAL',
  severity: 'LOW',
  supplier_id: 'SUP-1',
  supplier_name: 'Acme',
  event_type: 'SHIPMENT_DELAY',
  title: 'Case',
  risk_score: 10,
  affected_po_count: 2,
  exposure: { amount: '1000.00', currency: 'INR' },
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
  ...over,
});

describe('topOpenCases', () => {
  it('drops closed cases, ranks by severity then score, keeps top 3', () => {
    const out = topOpenCases([
      mk({ id: 'a', severity: 'LOW', risk_score: 99 }),
      mk({ id: 'b', severity: 'CRITICAL', risk_score: 50 }),
      mk({ id: 'c', severity: 'CRITICAL', risk_score: 70 }),
      mk({ id: 'd', severity: 'HIGH', risk_score: 10 }),
      mk({ id: 'e', severity: 'CRITICAL', risk_score: 99, status: 'CLOSED' }),
    ]);
    expect(out.map((c) => c.id)).toEqual(['c', 'b', 'd']);
  });
});

describe('AttentionPanel', () => {
  beforeEach(async () => {
    await loginAs('admin');
  });

  it('lists at most 3 open cases with severity chip and case link', async () => {
    renderWithProviders({ path: '/' });
    const panel = await screen.findByRole('region', { name: 'Attention needed' });
    let caseLinks: HTMLElement[] = [];
    await waitFor(() => {
      caseLinks = within(panel)
        .getAllByRole('link')
        .filter((l) => l.getAttribute('href')?.startsWith('/risk?case='));
      expect(caseLinks.length).toBeGreaterThan(0);
    });
    expect(caseLinks.length).toBeGreaterThan(0);
    expect(caseLinks.length).toBeLessThanOrEqual(3);
    expect(within(caseLinks[0]).getByText(/Critical|High|Medium|Low/)).toBeInTheDocument();
  });

  it('shows an all-clear state when nothing is open', async () => {
    server.use(
      http.get('*/api/v1/risk-cases', () => HttpResponse.json({ count: 0, next: null, previous: null, results: [] })),
    );
    renderWithProviders({ path: '/' });
    expect(await screen.findByText('All clear')).toBeInTheDocument();
  });
});
