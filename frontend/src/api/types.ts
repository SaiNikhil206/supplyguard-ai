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

/** R-02: `id` = Supplier.erp_id (tenant-scoped business key, e.g. SUP-1001). */
export interface Supplier {
  id: string;
  name: string;
  country: string; // ISO-2, e.g. "IN"
  city: string;
  category: string;
  status: SupplierStatus;
  risk_level: RiskLevel;
  /** 0-100; null until N-04 defines a supplier score (no Django source yet). */
  risk_score: number | null;
  open_po_count: number; // computed: OPEN purchase orders
  on_time_delivery_pct: number; // 0-100
}

export interface SupplierKpis {
  on_time_delivery_pct: number;
  /** Supplier.quality_score, scale 0-5 (was `quality_pass_pct`: the seed has no pass rate). */
  quality_score: number;
  /** null: no Django source (nothing invented). */
  avg_lead_time_days: number | null;
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
  capacity_per_week: number | null; // null = unknown
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
  supplier_id: string; // supplier_erp_id as received
  event_type: EventType;
  severity: Severity;
  event_time: string;
  expected_duration_hours: number | null;
  description: string;
  source_system: string;
  correlation_id: string;
  shipment_id?: string | null;
  po_id?: string | null;
}

/** PROVISIONAL list item. */
export interface RiskCaseListItem {
  id: string;
  status: RiskCaseState;
  severity: Severity;
  /** null when the case has no supplier (RiskCase.supplier is nullable). */
  supplier_id: string | null;
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

export interface AffectedPO {
  po_id: string;
  item_id: string;
  item_name: string;
  qty: number;
  value: Money;
  due_date: string;
  days_late_estimate: number;
  /** null when no inventory data (inventory_coverage_days is nullable). */
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

/** CONTRACTS section 6: Recovery option, plus `id` (REC-...) added by Django. */
export type RecommendationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';

export interface Recommendation {
  id: string;
  round?: number;
  status?: RecommendationStatus;
  /** true when N-07 rejected it as unsupported by ERP data; cannot be approved. */
  unsupported?: boolean;
  unsupported_reasons?: string[];
  rank: number;
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

/** PROVISIONAL. */
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

/** PROVISIONAL. */
export interface Execution {
  id: string; // EXE-...
  recommendation_id: string;
  status: ExecutionStatus;
  started_at: string | null;
  error_class?: 'VALIDATION' | 'AUTH' | 'BUSINESS' | 'TRANSIENT' | 'DOWNSTREAM' | null;
  retry_count?: number;
  finished_at: string | null;
  error: string | null;
  retryable: boolean;
}

/** PROVISIONAL. */
export interface TimelineEntry {
  at: string;
  actor: string;
  action: string;
  detail: string;
}

export interface RiskCaseDetail extends RiskCaseListItem {
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
