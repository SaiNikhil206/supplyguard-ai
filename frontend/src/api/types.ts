/**
 * API types derived by hand from docs/CONTRACTS.md (sections 1-7).
 * These are REPLACED by openapi-typescript output once U-02 publishes `/api/schema/`.
 * Shapes marked PROVISIONAL are guesses where CONTRACTS is silent.
 */

export interface Money {
  amount: string; // decimal as string
  currency: string; // e.g. "INR"
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS_RULE'
  | 'DOWNSTREAM_ERROR'
  | 'DOWNSTREAM_TIMEOUT'
  | 'NETWORK_ERROR'; // client-side only: fetch failed / non-JSON body

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    correlation_id?: string;
  };
}

export type Role = 'ADMIN' | 'PROCUREMENT_MANAGER' | 'OPS_MANAGER' | 'VIEWER' | 'SYSTEM';

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface TokenPair {
  access: string;
  refresh: string;
}

/** PROVISIONAL until U-02 ships `/me`. */
export interface Me {
  user: { id: string; username: string; full_name: string; email: string };
  tenant: { id: string; name: string };
  role: Role;
}

// ---- Suppliers (PROVISIONAL: CONTRACTS does not define the shape) ----
export type SupplierStatus = 'ACTIVE' | 'ON_HOLD' | 'INACTIVE';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Backed by `core.Supplier`; `id` is the ERP id (`SUP-1008`), not the DB pk. */
export interface Supplier {
  id: string;
  name: string;
  country: string; // ISO-3166 alpha-2, e.g. "IN"
  category: string;
  status: SupplierStatus;
  risk_level: RiskLevel;
  /** No such column on Supplier: only present if the API computes one. UI falls back to risk_level. */
  risk_score?: number | null; // 0-100
  open_po_count: number; // annotation: OPEN purchase orders
  on_time_delivery_pct: number; // 0-100
}

export interface SupplierKpis {
  on_time_delivery_pct: number;
  /** Not returned by the API (no source): UI must handle it missing. */
  quality_pass_pct?: number | null;
  /** Average of (expected_date - order_date) over the supplier's POs; null when it has no POs. */
  avg_lead_time_days?: number | null;
  open_po_value: Money;
  disruptions_last_12m: number;
}

export interface SupplierDisruption {
  event_id: string;
  event_type: EventType;
  severity: Severity;
  event_time: string;
  description: string;
  risk_case_id: string | null;
}

export interface SupplierDetail extends Supplier {
  contact_email: string;
  kpis: SupplierKpis;
  disruption_history: SupplierDisruption[];
}

export interface SupplierFilters {
  status?: SupplierStatus;
  risk_level?: RiskLevel;
  search?: string;
  page?: number;
  page_size?: number;
}

// ---- Dashboard (PROVISIONAL) ----
export interface TrendPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface DashboardSummary {
  suppliers: number;
  open_pos: number;
  active_shipments: number;
  exposure: Money;
  open_cases: number;
  recovered_value: Money;
  exposure_trend: TrendPoint[];
  cases_trend: TrendPoint[];
}

// ---- Events / Risk cases ----
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type EventType =
  | 'FACTORY_OUTAGE'
  | 'SHIPMENT_DELAY'
  | 'QUALITY_HOLD'
  | 'CAPACITY_REDUCTION'
  | 'LOGISTICS_DISRUPTION';

/** CONTRACTS section 7. */
export type RiskCaseState =
  | 'RECEIVED'
  | 'ANALYZING'
  | 'RECOMMENDATION_READY'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTING'
  | 'EXECUTION_FAILED'
  | 'RECOVERED'
  | 'CLOSED';

/** CONTRACTS section 3. */
export interface DisruptionEvent {
  event_id: string;
  tenant_id: string;
  supplier_id: string;
  event_type: EventType;
  severity: Severity;
  event_time: string;
  expected_duration_hours: number | null; // DisruptionEvent.expected_duration_hours is nullable
  description: string;
  source_system: string;
  correlation_id: string;
}

/**
 * List item backed by `core.RiskCase` (+ event + supplier joins).
 * `severity` = RiskCase.risk_level; `exposure` = {exposure_amount, currency};
 * `supplier_id` = event.supplier_erp_id; `supplier_name` is null when the supplier is
 * unknown or foreign (RiskCase.supplier is nullable).
 */
export interface RiskCaseListItem {
  id: string;
  status: RiskCaseState;
  severity: Severity;
  supplier_id: string;
  supplier_name: string | null;
  event_type: EventType;
  title: string;
  risk_score: number;
  affected_po_count: number;
  exposure: Money;
  created_at: string;
  updated_at: string;
}

export interface RiskCaseFilters {
  status?: RiskCaseState;
  severity?: Severity;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

/**
 * One row per PO line (unique on po_id + item_id), from `core.AffectedPO`:
 * qty=affected_qty, value={exposure_amount,currency}, days_late_estimate=estimated_delay_days,
 * stock_cover_days=inventory_coverage_days (null when inventory is unknown).
 */
export interface AffectedPO {
  po_id: string;
  item_id: string;
  item_name: string;
  qty: number;
  value: Money;
  due_date: string; // YYYY-MM-DD
  days_late_estimate: number;
  stock_cover_days: number | null;
  shortage?: boolean;
}

export type EvidenceSource = 'ERP' | 'EVENT' | 'IMPACT';

/** ai/schemas/common.schema.json `evidence`. value null = source record has no value. */
export interface EvidenceRef {
  source: EvidenceSource;
  entity: string;
  field: string;
  value: string | number | boolean | null;
  item_id?: string;
  location_id?: string;
}

export type AffectedEntityType = 'PO' | 'SUPPLIER' | 'ITEM' | 'SHIPMENT' | 'LOCATION';

/** recovery_plan.schema.json `change`; required keys depend on option_type. */
export interface ProposedChange {
  supplier_id?: string;
  expected_date?: string; // YYYY-MM-DD
  qty?: number;
  item_id?: string;
  from_location_id?: string;
  to_location_id?: string;
}

/** CONTRACTS section 6: Risk Analysis Agent output. */
export interface RiskAnalysis {
  risk_case_id: string;
  risk_level: Severity;
  risk_score: number;
  summary: string;
  affected_entities: { type: AffectedEntityType; id: string }[];
  evidence: EvidenceRef[];
  facts: string[];
  estimates: { statement: string; basis: string }[];
  assumptions: string[];
  missing_data: string[];
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
}

export type OptionType =
  | 'ALTERNATE_SUPPLIER'
  | 'INVENTORY_TRANSFER'
  | 'REVISED_SCHEDULE'
  | 'SPLIT_ORDER';

export type RecommendationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';

/** CONTRACTS section 6: Recovery option, plus `id` (REC-...) added by Django. */
export interface Recommendation {
  id: string;
  rank: number;
  round?: number;
  /** Recommendation.status; APPROVED never together with unsupported. */
  status?: RecommendationStatus;
  unsupported?: boolean;
  unsupported_reasons?: string[];
  option_type: OptionType;
  proposed_action: { po_id: string; change: ProposedChange };
  action_steps: string[];
  /** null only when data does not support an estimate; data_gaps then says why. */
  estimated_lead_time_days: number | null;
  estimated_cost_delta: Money | null;
  trade_offs: string[];
  evidence: EvidenceRef[];
  assumptions: string[];
  data_gaps: string[];
}

export type ApprovalDecision = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';

/** From `core.Approval`; decided_by is a display name/username of the deciding user. */
export interface Approval {
  id: string; // APR-...
  round?: number;
  recommendation_id: string;
  decision: ApprovalDecision;
  comments: string;
  decided_by: string;
  decided_at: string;
}

export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

/** From `core.Execution`; recommendation_id comes via execution.approval.recommendation. */
export interface Execution {
  id: string; // EXE-...
  recommendation_id: string;
  status: ExecutionStatus;
  started_at: string | null; // null while PENDING
  finished_at: string | null;
  error: string | null;
  retryable: boolean; // Execution.retryable property
}

/** From `audit.AuditEvent` rows for the case: at=timestamp, actor, action, detail=summary of `data`. */
export interface TimelineEntry {
  at: string;
  actor: string;
  action: string;
  detail: string;
}

export interface RiskCaseDetail extends RiskCaseListItem {
  /** Missing/odd source data noticed by the impact engine; shown on the case page. */
  data_quality_flags?: string[];
  event: DisruptionEvent;
  affected_pos: AffectedPO[];
  analysis: RiskAnalysis | null;
  recommendations: Recommendation[];
  /** recovery_plan: non-empty string when recommendations is empty, else null. */
  no_viable_option_reason: string | null;
  approvals: Approval[];
  executions: Execution[];
  timeline: TimelineEntry[];
}

// ---- Demo ----
/** PROVISIONAL: CONTRACTS says "scenario name". */
export interface SimulateScenario {
  scenario: string;
}

export interface SimulateResult {
  event_id: string;
  correlation_id: string;
  status: 'RECEIVED';
}
