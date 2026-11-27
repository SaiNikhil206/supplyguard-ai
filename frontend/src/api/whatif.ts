/**
 * What-if API (CONTRACTS: `POST /what-if`, N-11). Types mirror the real Django response
 * (backend/apps/intelligence/whatif.py `run_what_if`); every figure is an ESTIMATE.
 * Roles allowed to run: ADMIN, OPS_MANAGER, PROCUREMENT_MANAGER (VIEWER is read-only).
 * The backend derives severity from the duration and ignores any client severity, so it is not sent.
 */
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { EventType, Money, OptionType, Severity } from './types';

export interface WhatIfRequest {
  supplier_id: string;
  event_type: EventType;
  /** Backend accepts integers 1..90. */
  duration_days: number;
  /** ISO datetime; backend defaults to now. */
  start?: string;
}

export interface WhatIfScenario {
  supplier_id: string;
  supplier_name: string | null;
  event_type: EventType;
  severity: Severity;
  duration_days: number;
  duration_hours: number;
  start: string;
  end: string;
  risk_case_id?: string | null;
  source?: string;
}

/** One row per (po_id, item_id). */
export interface WhatIfAffectedPO {
  po_id: string;
  item_id: string;
  line_nos: number[];
  due_date: string; // YYYY-MM-DD
  affected_qty: number;
  estimated_delay_days: number;
  exposure_amount: Money;
  /** null when inventory/demand is unknown. */
  inventory_coverage_days: number | null;
  shortage: boolean;
}

export interface WhatIfInventoryItem {
  item_id: string;
  affected_qty: number;
  min_coverage_days: number | null;
  shortage: boolean;
  shortage_gap_ratio: number | null;
  mitigation_level: number;
  candidate_alternate_supplier_ids: string[];
}

export interface WhatIfCoverageRow {
  item_id: string;
  location_id: string;
  on_hand: number;
  reserved: number;
  safety_stock: number;
  daily_demand: number | null;
  available_qty: number;
  /** null when daily demand is missing. */
  coverage_days: number | null;
  coverage_days_gross: number | null;
  transfer_surplus_qty: number | null;
}

export interface WhatIfRecommended {
  option_type: Extract<OptionType, 'ALTERNATE_SUPPLIER' | 'INVENTORY_TRANSFER'>;
  qty: number;
  supplier_id?: string;
  from_location_id?: string;
  unit_price?: Money;
  capacity_known?: boolean;
  /** null when unknown (no lead time modelled). */
  lead_time_days: number | null;
  /** null when unknown (e.g. current unit price missing). */
  estimated_cost_delta: Money | null;
}

export type WhatIfItemStatus = 'COVERED_BY_STOCK' | 'RECOMMENDED' | 'NO_OPTION';

export interface WhatIfItemOption {
  item_id: string;
  affected_qty: number;
  status: WhatIfItemStatus;
  recommended: WhatIfRecommended | null;
  data_gap: string | null;
  note: string | null;
}

export interface WhatIfBestOption {
  is_estimate: boolean;
  rule: string;
  items: WhatIfItemOption[];
  uncovered_item_ids: string[];
  total_estimated_cost_delta: Money;
  /** false = at least one chosen option has an unknown cost, so the total is a lower bound. */
  cost_delta_complete: boolean;
  max_lead_time_days: number | null;
}

export interface WhatIfResponse {
  estimate: true;
  disclaimer: string;
  labels: Record<string, 'ESTIMATE'>;
  scenario: WhatIfScenario;
  affected_pos: WhatIfAffectedPO[];
  inventory: {
    gaps: WhatIfInventoryItem[];
    items: WhatIfInventoryItem[];
    coverage: WhatIfCoverageRow[];
  };
  exposure: Money;
  estimated_delay_days: number;
  shortage: boolean;
  risk: {
    score: number;
    level: Severity;
    components: Record<string, { weight: number; value: string; points: string }>;
  };
  /** null when no PO line is affected. */
  best_option_estimate: WhatIfBestOption | null;
  assumptions: string[];
  /** Missing / inconsistent data the estimate could not rely on. */
  data_gaps: string[];
}

/** Backend gives no timing, so `client_ms` is measured round-trip in the browser. */
export type WhatIfResult = WhatIfResponse & { client_ms: number };

export async function runWhatIf(req: WhatIfRequest): Promise<WhatIfResult> {
  const t0 = performance.now();
  const body = await apiFetch<WhatIfResponse>('/what-if', {
    method: 'POST',
    body: JSON.stringify({
      supplier_id: req.supplier_id,
      event_type: req.event_type,
      duration_days: req.duration_days,
      ...(req.start ? { start: req.start } : {}),
    }),
  });
  return { ...body, client_ms: Math.round(performance.now() - t0) };
}

/** No persistence server-side, so no cache invalidation needed. */
export const useWhatIf = () => useMutation({ mutationFn: runWhatIf });
