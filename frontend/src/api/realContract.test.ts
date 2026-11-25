import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { login } from './client';
import { getDashboardSummary, getMe, getRiskCase, getSupplier, listRiskCases, listSuppliers } from './endpoints';
import me from './__fixtures__/real-me.json';
import suppliers from './__fixtures__/real-suppliers.json';
import supplier from './__fixtures__/real-supplier-detail.json';
import cases from './__fixtures__/real-risk-cases.json';
import detail from './__fixtures__/real-risk-case-detail.json';

/**
 * Contract tests: JSON captured from the REAL Django backend (apps.portal + apps.accounts,
 * sqlite + `load_seed --demo-users`) and replayed through MSW. They pin the wire shape the
 * frontend types / mappers rely on, so serializer drift shows up here.
 */
const BASE = '/api/v1';

beforeEach(async () => {
  await login('admin', 'demo123'); // mock auth only to get a bearer; data handlers are overridden below
});

describe('real backend wire shapes', () => {
  it('GET /me is flat and maps to the UI Me shape', async () => {
    server.use(http.get(`${BASE}/me`, () => HttpResponse.json(me)));
    const got = await getMe();
    expect(got).toEqual({
      user: { id: me.id, full_name: me.name, email: me.email },
      tenant: me.tenant,
      role: me.role,
    });
  });

  it('GET /suppliers: DRF page envelope + supplier fields (risk_score absent)', async () => {
    server.use(http.get(`${BASE}/suppliers`, () => HttpResponse.json(suppliers)));
    const p = await listSuppliers();
    expect(Object.keys(p).sort()).toEqual(['count', 'next', 'previous', 'results']);
    const s = p.results[0];
    expect(s.id).toMatch(/^SUP-/);
    expect(['ACTIVE', 'ON_HOLD', 'INACTIVE']).toContain(s.status);
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(s.risk_level);
    expect(typeof s.on_time_delivery_pct).toBe('number');
    expect(s.risk_score).toBeUndefined();
  });

  it('GET /suppliers/<id>: kpis + disruption_history', async () => {
    server.use(http.get(`${BASE}/suppliers/SUP-1008`, () => HttpResponse.json(supplier)));
    const s = await getSupplier('SUP-1008');
    expect(s.kpis.open_po_value).toMatchObject({ currency: expect.any(String), amount: expect.any(String) });
    expect(s.kpis.quality_pass_pct).toBeUndefined();
    expect(Array.isArray(s.disruption_history)).toBe(true);
  });

  it('GET /risk-cases: severity/exposure/supplier fields', async () => {
    server.use(http.get(`${BASE}/risk-cases`, () => HttpResponse.json(cases)));
    const p = await listRiskCases();
    const c = p.results[0];
    expect(c).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^RC-/),
        severity: expect.any(String),
        supplier_id: expect.any(String),
        affected_po_count: expect.any(Number),
        exposure: expect.objectContaining({ amount: expect.any(String) }),
      }),
    );
  });

  it('GET /risk-cases/<id>: all detail sections present with expected nullability', async () => {
    server.use(http.get(`${BASE}/risk-cases/RC-000001`, () => HttpResponse.json(detail)));
    const c = await getRiskCase('RC-000001');
    for (const k of ['event', 'affected_pos', 'analysis', 'recommendations', 'approvals', 'executions', 'timeline', 'data_quality_flags'] as const) {
      expect(c).toHaveProperty(k);
    }
    expect(c.event.correlation_id).toMatch(/[0-9a-f-]{36}/);
    expect(c.recommendations[0]).toMatchObject({ id: expect.any(String), rank: expect.any(Number), option_type: expect.any(String) });
    expect(c.affected_pos[0].stock_cover_days).toBeNull();
    expect(c.timeline[0]).toMatchObject({ at: expect.any(String), actor: expect.any(String), action: expect.any(String) });
  });

  it('GET /dashboard/summary shape', async () => {
    server.use(
      http.get(`${BASE}/dashboard/summary`, () =>
        HttpResponse.json({
          suppliers: 60, open_pos: 172, active_shipments: 13,
          exposure: { amount: '0.00', currency: 'INR' }, open_cases: 0,
          recovered_value: { amount: '0.00', currency: 'INR' },
          exposure_trend: [{ date: '2026-11-25', value: 0 }], cases_trend: [{ date: '2026-11-25', value: 0 }],
        }),
      ),
    );
    const d = await getDashboardSummary();
    expect(d.exposure_trend[0]).toEqual({ date: expect.any(String), value: expect.any(Number) });
  });
});
