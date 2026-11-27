import { http, HttpResponse, delay, type HttpHandler } from 'msw';
import type { ErrorCode, Severity } from '@/api/types';
import type {
  WhatIfAffectedPO,
  WhatIfCoverageRow,
  WhatIfInventoryItem,
  WhatIfItemOption,
  WhatIfRequest,
  WhatIfResponse,
} from '@/api/whatif';
import { suppliers } from './fixtures';

function err(status: number, code: ErrorCode, message: string, request: Request) {
  const cid = request.headers.get('X-Correlation-ID') ?? crypto.randomUUID();
  return HttpResponse.json(
    { error: { code, message, details: {}, correlation_id: cid } },
    { status, headers: { 'X-Correlation-ID': cid } },
  );
}

function roleOf(request: Request): string | null {
  const h = request.headers.get('Authorization') ?? '';
  const parts = h.startsWith('Bearer ') ? h.slice(7).split('.') : [];
  if (parts.length !== 3) return null;
  try {
    const p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return (JSON.parse(atob(p + '='.repeat((4 - (p.length % 4)) % 4))) as { role: string }).role;
  } catch {
    return null;
  }
}

const addDays = (base: Date, n: number) => new Date(base.getTime() + n * 86_400_000).toISOString().slice(0, 10);

const severityFor = (days: number): Severity => (days <= 3 ? 'MEDIUM' : days <= 14 ? 'HIGH' : 'CRITICAL');

/**
 * Deterministic estimate in the REAL backend shape (apps/intelligence/whatif.py): same input -> same output,
 * scales with duration. Includes one unknown-cover row and a data gap so the "missing data" UI is exercised.
 */
export function computeWhatIf(req: WhatIfRequest): WhatIfResponse | null {
  const s = suppliers.find((x) => x.id === req.supplier_id);
  if (!s) return null;
  const d = req.duration_days;
  const poCount = Math.min(s.open_po_count, Math.max(0, Math.ceil(d / 4)));
  const base = new Date('2026-12-02T10:15:00Z');
  const start = base.toISOString().replace('.000Z', 'Z');
  const end = new Date(base.getTime() + d * 86_400_000).toISOString().replace('.000Z', 'Z');

  const affected_pos: WhatIfAffectedPO[] = Array.from({ length: poCount }, (_, i) => {
    const qty = 200 + i * 50;
    return {
      po_id: `PO-${s.id.slice(-3)}${String(i + 1).padStart(2, '0')}`,
      item_id: `ITM-${100 + (i % 2)}`,
      line_nos: [i + 1],
      due_date: addDays(base, 3 + i * 2),
      affected_qty: qty,
      estimated_delay_days: Math.max(1, d - i),
      exposure_amount: { amount: (qty * 1500).toFixed(2), currency: 'INR' },
      inventory_coverage_days: i % 2 === 0 ? Math.max(0, 10 - d / 2) : null,
      shortage: i % 2 === 0 ? 10 - d / 2 < d : false,
    };
  });
  const total = affected_pos.reduce((a, p) => a + Number(p.exposure_amount.amount), 0);
  const itemIds = [...new Set(affected_pos.map((p) => p.item_id))];

  const items: WhatIfInventoryItem[] = itemIds.map((item_id, i) => ({
    item_id,
    affected_qty: affected_pos.filter((p) => p.item_id === item_id).reduce((a, p) => a + p.affected_qty, 0),
    min_coverage_days: i === 0 ? Math.max(0, 10 - d / 2) : null,
    shortage: i === 0 ? 10 - d / 2 < d : false,
    shortage_gap_ratio: i === 0 ? 0.5 : null,
    mitigation_level: 0.5,
    candidate_alternate_supplier_ids: ['SUP-2001'],
  }));
  const coverage: WhatIfCoverageRow[] = itemIds.flatMap((item_id, i) => [
    {
      item_id,
      location_id: 'LOC-MAIN',
      on_hand: 1000,
      reserved: 100,
      safety_stock: 100,
      daily_demand: i === 0 ? 80 : null,
      available_qty: 800,
      coverage_days: i === 0 ? Math.max(0, 10 - d / 2) : null,
      coverage_days_gross: i === 0 ? 11 : null,
      transfer_surplus_qty: i === 0 ? 0 : null,
    },
  ]);

  const options: WhatIfItemOption[] = items.map((it, i) =>
    i === 0
      ? {
          item_id: it.item_id,
          affected_qty: it.affected_qty,
          status: 'RECOMMENDED',
          recommended: {
            option_type: 'ALTERNATE_SUPPLIER',
            supplier_id: 'SUP-2001',
            qty: it.affected_qty,
            unit_price: { amount: '1600.00', currency: 'INR' },
            capacity_known: false,
            lead_time_days: 9,
            estimated_cost_delta: { amount: String(Math.round(total * 0.08)) + '.00', currency: 'INR' },
          },
          data_gap: null,
          note: null,
        }
      : {
          item_id: it.item_id,
          affected_qty: it.affected_qty,
          status: 'NO_OPTION',
          recommended: null,
          data_gap: null,
          note: 'No qualified alternate with enough capacity and no transferable stock.',
        },
  );

  const gaps = [
    ...(poCount === 0 ? ['no open purchase order line falls inside the simulated outage window'] : []),
    ...(poCount > 0 ? ['daily_demand missing for ITM-101 at LOC-MAIN', 'capacity unknown for recommended alternate SUP-2001 (ITM-100)'] : []),
  ];

  return {
    estimate: true,
    disclaimer:
      'Simulation only: every figure below is an estimate computed on a fresh ERP snapshot. Nothing was saved or changed in the ERP.',
    labels: { affected_pos: 'ESTIMATE', inventory: 'ESTIMATE', exposure: 'ESTIMATE', risk: 'ESTIMATE', best_option_estimate: 'ESTIMATE' },
    scenario: {
      supplier_id: s.id,
      supplier_name: s.name,
      event_type: req.event_type,
      severity: severityFor(d),
      duration_days: d,
      duration_hours: d * 24,
      start,
      end,
      risk_case_id: null,
      source: 'REQUEST',
    },
    affected_pos,
    inventory: { gaps: items.filter((i) => i.shortage), items, coverage },
    exposure: { amount: total.toFixed(2), currency: 'INR' },
    estimated_delay_days: poCount ? d : 0,
    shortage: items.some((i) => i.shortage),
    risk: { score: Math.min(100, 20 + d * 3), level: severityFor(d), components: {} },
    best_option_estimate:
      poCount === 0
        ? null
        : {
            is_estimate: true,
            rule: 'Per item: stock transfer if a location has surplus above the outage need, else the cheapest qualified alternate whose capacity is enough or unknown.',
            items: options,
            uncovered_item_ids: options.filter((o) => o.status === 'NO_OPTION').map((o) => o.item_id),
            total_estimated_cost_delta: { amount: String(Math.round(total * 0.08)) + '.00', currency: 'INR' },
            cost_delta_complete: true,
            max_lead_time_days: 9,
          },
    assumptions: [
      'Every figure is an ESTIMATE from a simulated disruption, not a real event.',
      `The supplier is fully unable to deliver for ${d} days from ${start}; event type ${req.event_type} does not change the maths.`,
      'Nothing was written to the ERP or saved as a risk case.',
    ],
    data_gaps: gaps,
  };
}

export const whatIfHandlers: HttpHandler[] = [
  http.post('*/api/v1/what-if', async ({ request }) => {
    const role = roleOf(request);
    if (!role) return err(401, 'UNAUTHENTICATED', 'Authentication credentials were not provided or are invalid.', request);
    if (role === 'VIEWER') return err(403, 'FORBIDDEN', 'Your role may not run what-if simulations.', request);
    const body = (await request.json().catch(() => ({}))) as Partial<WhatIfRequest>;
    await delay(300);
    const result = body.supplier_id && body.event_type && body.duration_days
      ? computeWhatIf(body as WhatIfRequest)
      : null;
    if (!result) return err(404, 'NOT_FOUND', `Supplier ${body.supplier_id ?? ''} not found.`, request);
    return HttpResponse.json(result);
  }),
];
