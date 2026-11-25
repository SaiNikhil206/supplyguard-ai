# MSW mocks

Enabled with `VITE_API_MOCK=true`; handlers in `handlers.ts`, data in `fixtures.ts`. Turn the flag off to hit Django.

## R-02 response shapes

All endpoints are `/api/v1/...`, JWT required. Errors use the CONTRACTS error body
`{ error: { code, message, details, correlation_id } }`: unknown or foreign id -> 404 `NOT_FOUND`,
invalid filter value -> 400 `VALIDATION_ERROR` (details keyed by filter name), page past the end -> 404.
Lists are `{ count, next, previous, results }`; default page size 25, `page_size` up to 100.

- `GET /suppliers?status=&risk_level=&search=&page=&page_size=` - item `{ id (ERP id, SUP-1008), name, country (ISO-2), category, status (ACTIVE|ON_HOLD|INACTIVE), risk_level, open_po_count, on_time_delivery_pct }`. `risk_score` is optional and absent (no model column); UI falls back to `risk_level`.
- `GET /suppliers/{id}` - list fields + `contact_email`, `kpis { on_time_delivery_pct, avg_lead_time_days|null, open_po_value {amount,currency}, disruptions_last_12m }` (`quality_pass_pct` optional, absent), `disruption_history [{ event_id, event_type, severity, event_time, description, risk_case_id|null }]`.
- `GET /dashboard/summary` - `{ suppliers, open_pos, active_shipments, exposure Money, open_cases, recovered_value Money, exposure_trend [{date,value}], cases_trend [{date,value}] }`.
- `GET /risk-cases?status=&severity=&from=&to=` - item `{ id (RC-000045), status, severity (= RiskCase.risk_level), supplier_id, supplier_name|null, event_type, title, risk_score, affected_po_count, exposure Money, created_at, updated_at }`. `from` inclusive, `to` exclusive (date or ISO timestamp); newest first.
- `GET /risk-cases/{id}` - item fields + `event { event_id, tenant_id, supplier_id, event_type, severity, event_time, expected_duration_hours|null, description, source_system, correlation_id }`, `affected_pos [{ po_id, item_id, item_name, qty, value Money, due_date, days_late_estimate, stock_cover_days|null, shortage }]` (one row per PO line), `analysis` (agent JSON or null), `recommendations [{ id, round, rank, option_type, status (PENDING|APPROVED|REJECTED|CHANGES_REQUESTED), unsupported, proposed_action, action_steps, estimated_lead_time_days|null, estimated_cost_delta Money|null, trade_offs, evidence, assumptions, data_gaps }]`, `no_viable_option_reason|null`, `approvals [{ id, recommendation_id, decision, comments, decided_by, decided_at }]`, `executions [{ id, recommendation_id, status, started_at|null, finished_at|null, error|null, retryable }]`, `timeline [{ at, actor, action, detail }]`.
