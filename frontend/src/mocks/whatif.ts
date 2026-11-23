import { http, HttpResponse, delay, type HttpHandler } from 'msw';
import type { AffectedPO, ErrorCode } from '@/api/types';
import type { WhatIfBestOption, WhatIfRequest, WhatIfResult } from '@/api/whatif';
import { suppliers } from './fixtures';

const RISK_FACTOR = { LOW: 1, MEDIUM: 1.3, HIGH: 1.6, CRITICAL: 2 } as const;
const EVENT_FACTOR = {
  FACTORY_OUTAGE: 1.5,
  SHIPMENT_DELAY: 1,
  QUALITY_HOLD: 1.2,
  CAPACITY_REDUCTION: 0.8,
  LOGISTICS_DISRUPTION: 1.1,
} as const;

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

/** Deterministic estimate: same input -> same output; scales with duration. */
export function computeWhatIf(req: WhatIfRequest): WhatIfResult | null {
  const s = suppliers.find((x) => x.id === req.supplier_id);
  if (!s) return null;
  const factor = RISK_FACTOR[req.severity ?? s.risk_level] * EVENT_FACTOR[req.event_type];
  const d = req.duration_days;
  const poCount = Math.min(s.open_po_count, Math.max(0, Math.ceil((d / 30) * s.open_po_count * factor)));
  const base = new Date('2026-12-01T00:00:00Z');

  const affected_pos: AffectedPO[] = Array.from({ length: poCount }, (_, i) => ({
    po_id: `PO-${s.id.slice(-3)}${String(i + 1).padStart(2, '0')}`,
    item_id: `ITM-${100 + i}`,
    item_name: `${s.category} component ${i + 1}`,
    qty: 200 + i * 50,
    value: { amount: String((200 + i * 50) * 1500), currency: 'INR' },
    due_date: addDays(base, 3 + i * 2),
    days_late_estimate: Math.max(0, Math.round(d * factor) - i),
    stock_cover_days: Math.max(0, 10 - i - Math.round(d / 3)),
  }));
  const total = affected_pos.reduce((a, p) => a + Number(p.value.amount), 0);

  const inventory_gap = Array.from({ length: Math.min(14, d + 5) }, (_, day) => ({
    date: addDays(base, day),
    on_hand: Math.max(0, Math.round(1000 - day * (60 + 20 * factor))),
    required: Math.round(400 + day * 25),
  }));

  const best_option: WhatIfBestOption | null =
    poCount === 0
      ? null
      : {
          option_type: d > 14 ? 'ALTERNATE_SUPPLIER' : 'REVISED_SCHEDULE',
          summary:
            d > 14
              ? `Source ${poCount} PO(s) from an alternate supplier.`
              : `Re-schedule ${poCount} PO(s) by about ${d} days.`,
          estimated_lead_time_days: d > 14 ? 9 : d,
          estimated_cost_delta: d > 14 ? { amount: String(Math.round(total * 0.08)), currency: 'INR' } : null,
        };

  return {
    affected_pos,
    inventory_gap,
    exposure: { amount: String(total), currency: 'INR' },
    best_option,
    assumptions: [
      `Outage lasts ${d} day(s) with no partial shipments.`,
      'Demand follows the trailing 30-day run rate.',
    ],
    missing_data: best_option && d > 14 ? [] : ['Alternate supplier quotes are not available.'],
    computed_ms: 120 + d * 4,
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
