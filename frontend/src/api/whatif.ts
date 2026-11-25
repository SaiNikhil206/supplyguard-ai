/**
 * What-if API (CONTRACTS section 2: `POST /what-if`).
 *
 * PROVISIONAL response shape: CONTRACTS only says "returns estimate + assumptions, no persistence".
 * This shape is a guess until Nikhil's N-11 backend ships; swap `WhatIfResult` for the generated type then.
 * Roles allowed to run: ADMIN, OPS_MANAGER, PROCUREMENT_MANAGER (VIEWER is read-only).
 */
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { AffectedPO, EventType, Money, OptionType, Severity } from './types';

export interface WhatIfRequest {
  supplier_id: string;
  event_type: EventType;
  duration_days: number;
  severity?: Severity;
}

export interface InventoryGapPoint {
  date: string; // YYYY-MM-DD
  on_hand: number;
  required: number;
}

export interface WhatIfBestOption {
  option_type: OptionType;
  summary: string;
  /** null when data does not support an estimate. */
  estimated_lead_time_days: number | null;
  estimated_cost_delta: Money | null;
}

export interface WhatIfResult {
  affected_pos: AffectedPO[];
  inventory_gap: InventoryGapPoint[];
  exposure: Money;
  /** null = no viable option. */
  best_option: WhatIfBestOption | null;
  assumptions: string[];
  missing_data: string[];
  computed_ms: number;
}

export const runWhatIf = (req: WhatIfRequest) =>
  apiFetch<WhatIfResult>('/what-if', { method: 'POST', body: JSON.stringify(req) });

/** No persistence server-side, so no cache invalidation needed. */
export const useWhatIf = () => useMutation({ mutationFn: runWhatIf });
