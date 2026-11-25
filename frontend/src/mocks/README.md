# Mocks (MSW)

Handlers in `handlers.ts`, data in `fixtures.ts`. Enabled with `VITE_API_MOCK=true`; turn off to hit the Django backend.

## R-02 response shapes

Base `/api/v1`, JWT required, tenant from the token. Field names are the UI names (`frontend/src/api/types.ts`); the backend serializer maps model columns onto them. Dates are ISO 8601 UTC (`2026-12-02T10:15:00Z`), plain dates `YYYY-MM-DD`. Decimals in `Money` are strings; plain numeric fields are JSON numbers.

Errors: `{"error": {"code", "message", "details", "correlation_id"}}`. Unknown id: 404 `NOT_FOUND`. Bad enum filter or date: 400 `VALIDATION_ERROR` with `details.<field>`.

Pagination: `?page=1&page_size=10` (max 100) -> `{count, next, previous, results}`.

### GET /suppliers
Filters: `status` (ACTIVE|ON_HOLD|INACTIVE), `risk_level` (LOW|MEDIUM|HIGH|CRITICAL), `search` (icontains on name or erp_id). Order `erp_id`.
Item: `id` (= erp_id), `name`, `country` (ISO-2), `city`, `category`, `status`, `risk_level`, `risk_score` (number 0-100 or **null**), `open_po_count` (OPEN POs), `on_time_delivery_pct` (number).

### GET /suppliers/{id}
Item fields plus `contact_email`, `capacity_per_week` (int|null), `kpis` {`on_time_delivery_pct`, `quality_score` (0-5), `avg_lead_time_days` (**null**), `open_po_value` Money, `disruptions_last_12m`}, `disruption_history[]` {`event_id`, `event_type`, `severity`, `event_time`, `description`, `risk_case_id` (string|null)}.

### GET /dashboard/summary
`suppliers`, `open_pos`, `active_shipments` (IN_TRANSIT), `exposure` Money, `open_cases`, `recovered_value` Money, `exposure_trend[]` and `cases_trend[]` of `{date: YYYY-MM-DD, value: number}` (14 days).

### GET /risk-cases
Filters: `status` (10 RiskCase states), `severity` (filters RiskCase.risk_level), `from`, `to` (date or datetime on created_at; date-only `to` is inclusive of that day). Order `-created_at, -id`.
Item: `id` (`RC-000045`), `status`, `severity` (= risk_level), `supplier_id` / `supplier_name` (**null** if no supplier), `event_type`, `title`, `risk_score` (int 0-100), `affected_po_count`, `exposure` Money (= exposure_amount + currency), `created_at`, `updated_at`.

### GET /risk-cases/{id}
Item fields plus:
- `event`: `event_id`, `tenant_id`, `supplier_id` (supplier_erp_id), `event_type`, `severity`, `event_time`, `expected_duration_hours` (number|null), `description`, `source_system`, `correlation_id`, `shipment_id`, `po_id` (null).
- `affected_pos[]`: `po_id`, `item_id`, `item_name`, `qty` (affected_qty), `value` Money, `due_date`, `days_late_estimate` (estimated_delay_days), `stock_cover_days` (inventory_coverage_days, **null**), `shortage`.
- `analysis`: RiskCase.analysis (CONTRACTS s6 risk analysis) or **null** when empty.
- `recommendations[]` (current round): `id` (`REC-..`), `round`, `status` (PENDING|APPROVED|REJECTED|CHANGES_REQUESTED), `unsupported`, `unsupported_reasons`, `rank`, `option_type`, `proposed_action`, `action_steps`, `trade_offs`, `evidence`, `assumptions`, `data_gaps`, `estimated_lead_time_days` (null), `estimated_cost_delta` Money|null.
- `no_viable_option_reason`: string|null.
- `approvals[]`: `id` (`APR-..`), `round`, `recommendation_id`, `decision` (APPROVE|REJECT|REQUEST_CHANGES), `comments`, `decided_by` (`USR-<n>`), `decided_at`.
- `executions[]`: `id` (`EXE-..`), `recommendation_id` (via approval), `status` (PENDING|RUNNING|SUCCEEDED|FAILED), `started_at` (null), `finished_at` (null), `error` (null), `error_class` (VALIDATION|AUTH|BUSINESS|TRANSIENT|DOWNSTREAM|null), `retry_count`, `retryable`.
- `timeline[]`: from AuditEvent, `{at (timestamp), actor, action, detail (string summary of data)}`, oldest first.
