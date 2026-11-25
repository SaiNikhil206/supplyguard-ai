# Mocks (MSW)

Handlers in `handlers.ts`, data in `fixtures.ts`. Enabled with `VITE_API_MOCK=true`; turn off to hit the Django backend.

## R-02 response shapes

Mirrors `backend/apps/portal/serializers.py`. Base `/api/v1`, JWT required, tenant from the token. Dates ISO 8601 UTC. `Money` = `{amount: "33600.00", currency}`; other decimals are JSON numbers.

Errors: `{"error": {"code", "message", "details", "correlation_id"}}`. Unknown or foreign id: 404 `NOT_FOUND`. Bad enum filter or date: 400 `VALIDATION_ERROR`.
Pagination: `?page=1&page_size=10` (max 100) -> `{count, next, previous, results}`.

### GET /suppliers
Filters `status`, `risk_level`, `search` (name / id). Item: `id` (erp_id), `name`, `country`, `category`, `status`, `risk_level`, `open_po_count`, `on_time_delivery_pct`. No `risk_score`.

### GET /suppliers/{id}
Item fields + `contact_email`, `kpis` {`on_time_delivery_pct`, `avg_lead_time_days` (number|null), `open_po_value` Money, `disruptions_last_12m`}, `disruption_history[]` {`event_id`, `event_type`, `severity`, `event_time`, `description`, `risk_case_id` (string|null)}. No `quality_pass_pct`.

### GET /dashboard/summary
`suppliers`, `open_pos`, `active_shipments`, `exposure` Money, `open_cases`, `recovered_value` Money, `exposure_trend[]`, `cases_trend[]` ({`date`, `value`}).

### GET /risk-cases
Filters `status`, `severity`, `from` (inclusive), `to` (exclusive); date-only = midnight UTC. Newest first.
Item: `id`, `status`, `severity`, `supplier_id`, `supplier_name` (string|null), `event_type`, `title`, `risk_score`, `affected_po_count`, `exposure` Money, `created_at`, `updated_at`.

### GET /risk-cases/{id}
Item fields + `event` {`event_id`, `tenant_id`, `supplier_id`, `event_type`, `severity`, `event_time`, `expected_duration_hours` (number|null), `description`, `source_system`, `correlation_id`}; `affected_pos[]` {`po_id`, `item_id`, `item_name`, `qty`, `value` Money, `due_date`, `days_late_estimate`, `stock_cover_days` (number|null), `shortage`}; `analysis` (raw JSON|null); `recommendations[]` {`id`, `round`, `rank`, `option_type`, `status`, `unsupported`, `proposed_action`, `action_steps`, `estimated_lead_time_days`, `estimated_cost_delta` (Money|null), `trade_offs`, `evidence`, `assumptions`, `data_gaps`}; `no_viable_option_reason`; `approvals[]` {`id`, `recommendation_id`, `decision`, `comments`, `decided_by`, `decided_at`}; `executions[]` {`id`, `recommendation_id`, `status`, `started_at`, `finished_at`, `error`, `retryable`}; `timeline[]` {`at`, `actor`, `action`, `detail`}.
