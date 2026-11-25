# Approval Flow - build spec (R-06)

Contracts used: CONTRACTS sections 1 (conventions, errors, correlation ID), 2 (roles), 4 (endpoints), 6 (recovery options shape), 7 (state machine), 8 (fallback).

## 1. Map (state diagram)
```mermaid
flowchart TD
  S([Start: riskCaseId, recommendationId, correlationId]) --> RC{Role check:<br/>role is PROCUREMENT_MANAGER?}
  RC -- no --> DENY[/Message: Not authorized/]
  RC -- yes --> L[Step: Load case<br/>GET /risk-cases/id]
  L -- ok --> ST{status is PENDING_APPROVAL?}
  L -- 404, 5xx, timeout --> ERR[/Page: Error - retry or close/]
  ST -- no --> DONE0[/Message: Already decided or not actionable/]
  ST -- yes --> P[Page: Approval<br/>evidence, ranked options, comment]
  P -- Approve --> V1{option selected?}
  P -- Reject --> V2{comment present?}
  P -- Request changes --> V3{comment present?}
  P -. no decision after N hours .-> ESC[Wait element: escalation timer]
  V1 -- no --> P
  V2 -- no --> P
  V3 -- no --> P
  V1 -- yes --> D[Step: Call decision API<br/>POST /recommendations/id/decision]
  V2 -- yes --> D
  V3 -- yes --> D
  ESC --> EM[Step: Escalate - notify ADMIN, flag task] --> P
  D -- 201 --> C[/Page: Confirmation/]
  D -- 409 --> E409[/Page: State changed - reload/]
  D -- 422 --> E422[/Page: Business rule error/]
  D -- 401, 403 --> E403[/Message: Not authorized/]
  D -- 5xx, timeout --> E5[/Page: Technical error - retry/]
  E409 --> L
  E422 --> P
  E5 --> D
```
Re-submitting after a timeout is safe: the endpoint returns `409` (`ALREADY_DECIDED` or `CASE_NOT_PENDING_APPROVAL`) if the decision was already recorded, and the Flow then reloads, treats it as "already recorded" and shows the final state. Backend design: `backend/apps/workflow/WORKFLOW_DESIGN.md` s3.

## 2. Inputs (Flow start)
Provided by the Boomi process that creates the task: `riskCaseId` (RC-...), `recommendationId` (REC-...), `correlationId` (UUID v4, same as the case so audit lines up).

## 3. Flow values
| Name | Type | Source / use |
|---|---|---|
| `riskCaseId` | String | start input |
| `recommendationId` | String | start input |
| `correlationId` | String | start input; sent as `X-Correlation-ID` on every call; generate UUID v4 if empty |
| `currentUserRole` | String | from Flow identity / `GET /me` |
| `case` | Object | response of Load case; `case.status` must be `PENDING_APPROVAL` |
| `evidence` | List of Object `{source, entity, field, value}` | analysis.evidence |
| `facts`, `assumptions`, `missingData` | List of String | analysis; show missing data honestly |
| `options` | List of Object `{rank, option_type, proposed_action, estimated_lead_time_days, estimated_cost_delta, trade_offs, evidence, assumptions, data_gaps}` | CONTRACTS 6 recovery plan |
| `noViableReason` | String | `no_viable_option_reason` |
| `selectedOption` | Object | row chosen in options table (default rank 1); carries that option's `recommendationId` (REC-...), the path id of the decision call |
| `decision` | String | `APPROVE` / `REJECT` / `REQUEST_CHANGES`, set by the clicked outcome |
| `comments` | String | textarea |
| `decisionResult` | Object | flat 201 body: `approval_id, recommendation_id, decision, recommendation_status, risk_case_id, case_status, analysis_round, execution_id (null unless APPROVE), decided_by, decided_at, correlation_id` |
| `jwt` | String (secret) | the signed-in manager's access token (section 6); never logged or displayed |
| `errorMessage`, `errorCode`, `errorCorrelationId` | String | from the CONTRACTS error body |
| `escalated` | Boolean | set by the escalation step |
| `retryCount` | Number | retry cap |
| `config.*` | String / Number | keys from `values.example.json` |

## 4. Pages
### 4.1 Approval page
Components, top to bottom:
1. Presentation: case header - `riskCaseId`, severity, summary, supplier.
2. Table `Evidence` bound to `evidence` (source, entity, field, value). Below it lists for `facts`, `assumptions`, `missingData` (label missing data clearly, never hide it).
3. Table `Recovery options` bound to `options`, single-select row sets `selectedOption`. Columns: rank, option_type, lead time days, cost delta, trade-offs. Row detail: proposed_action, evidence, assumptions, data_gaps. If `options` is empty show `noViableReason` and hide Approve.
4. Textarea `Comment` bound to `comments`. Required for Reject and Request changes; optional for Approve.
5. Outcome buttons: **Approve** (primary), **Reject**, **Request changes**. Each sets `decision`, then validates, then runs Call decision API.
6. Banner when `escalated` is true.

Validation: Approve needs `selectedOption`; Reject and Request changes need non-empty `comments`.
Body: the decision body is `{decision, comments}` only. The option is chosen by the URL: each option is its own Recommendation (`REC-...`), so `POST /recommendations/{selectedOption.recommendationId}/decision`. The `recommendationId` start input is only the pre-selected option. Approve decides exactly one option; Reject on one option leaves the others decidable (see 4.2).

### 4.2 Confirmation page
Shows `decision`, `decisionResult.recommendation_status`, `decisionResult.case_status`, `decisionResult.execution_id`, correlation ID, and a line by decision: Approve = "Execution started" (`execution_id` set, case `APPROVED`); Reject = "No ERP change will be made" - if `case_status` is still `PENDING_APPROVAL` other options remain: show a button back to the Approval page to decide another option, else the case is `REJECTED`; Request changes = "Sent back for re-analysis" (`case_status` `ANALYZING`, `analysis_round` + 1, new options arrive later; this Flow instance ends). Link to the case in the SaaS Approval Center.

### 4.3 Error pages
Show `errorMessage` and `errorCorrelationId`; buttons Retry / Reload case / Close depending on the error (section 7).

## 5. Service / Connector: `SupplyGuard API`
Type: HTTP / REST Flow Service. Base URL `config.django_base_url` (API Management gateway).

Headers on every action:
- credential header from API Management (section 6)
- `X-Correlation-ID: {correlationId}`
- `Content-Type: application/json`, `Accept: application/json`

| Action | Method / path | Request | Response mapped to |
|---|---|---|---|
| `loadCase` | `GET {base}/risk-cases/{riskCaseId}` | none | `case`, `evidence`, `options`, `facts`, `assumptions`, `missingData`, `noViableReason` (from event, analysis, recommendations) |
| `submitDecision` | `POST {base}/recommendations/{selectedOption.recommendationId}/decision` | `{ "decision": "APPROVE\|REJECT\|REQUEST_CHANGES", "comments": "<text>" }` (`comments` max 2000 chars; required and non-blank for REJECT and REQUEST_CHANGES) | `decisionResult` (HTTP **201**, flat body) |

Tenant is never sent in body or query; the server derives it from the JWT `tenant_id` claim. Paths have no trailing slash (`.../decision`).

## 6. Authentication (decided: Q1 in WORKFLOW_DESIGN.md s6)
- `POST /recommendations/{id}/decision` requires a **user JWT** of a `PROCUREMENT_MANAGER`: `Authorization: Bearer <access token>` (from `POST /auth/token`, claims `user_id`, `tenant_id`, `role`). An `X-Api-Key` (SYSTEM) caller gets **403**; there is no "system on behalf of user" variant. The audit actor is the signed-in human.
- So the Flow must run as the approving manager: a Flow login page calls `/auth/token` (or the SaaS Approval Center link passes a token), and the result is kept in the `jwt` value and sent only in the `Authorization` header. Never in git, logs, Flow values shown on pages, or the confirmation page.
- Read calls (`GET /risk-cases/{id}`) use the same user JWT, so the tenant filter applies.
- Target setup: Flow calls the API Management gateway (U-09), which must forward `Authorization` and `X-Correlation-ID` unchanged and may rate-limit. Open item for Uday: confirm the gateway passes `Authorization` through. Direct-to-Django is fine for local tests.
- The Flow role check is a UX guard; Django is the enforcer (403).

## 7. Error handling
CONTRACTS error body: `{ "error": { "code", "message", "details", "correlation_id" } }`. Always display `message` and `correlation_id`.

| Status / code | Meaning | Flow behaviour |
|---|---|---|
| 201 | decision recorded | Confirmation page |
| 400 `VALIDATION_ERROR` | bad or missing `decision`; blank comments on REJECT / REQUEST_CHANGES; comments over 2000 chars | back to Approval with field message |
| 401 `UNAUTHENTICATED` | missing, invalid or expired JWT | refresh / re-login, retry once; else "sign in again" |
| 403 `FORBIDDEN` | role is not PROCUREMENT_MANAGER (ADMIN, OPS_MANAGER, VIEWER and SYSTEM API key all get 403) or inactive tenant | Not authorized, no retry |
| 404 `NOT_FOUND` | recommendation missing or in another tenant (same answer) | error page, Close only |
| 409 `CONFLICT` | `details.reason`: `CASE_NOT_PENDING_APPROVAL` (`details.current_status`), `STALE_ROUND` (options replaced by re-analysis), `ALREADY_DECIDED`, `ALREADY_APPROVED` | reload case; show "already decided" or "options were refreshed"; never retry the same call |
| 422 `BUSINESS_RULE` | `UNSUPPORTED_OPTION`: option failed N-07 fact-check (`details.unsupported_reasons`) | show message and reasons, return to Approval page; show such options disabled |
| 5xx / timeout | technical | error page with Retry of the same decision; after `max_retries` say "decision not recorded, use SaaS Approval Center" |

Never assume success on a timeout: reload the case before reporting an outcome.

## 8. Role check
Only `PROCUREMENT_MANAGER` may decide (CONTRACTS 2). OPS_MANAGER and VIEWER see nothing actionable. ADMIN is not an approver either: the endpoint returns 403 for ADMIN (`record_decision` in `apps/workflow/services.py`). ADMIN only receives escalations. Implemented twice: (1) Flow swimlane/authorization plus the Role check decision at the start of the map; (2) Django enforces on the endpoint (403). Never rely on Flow alone.

## 9. Escalation
- Wait element starts when the Approval page is shown, duration `config.escalation_hours` (default 24, demo ~2 minutes).
- On timeout without a decision: set `escalated = true`, notify `config.escalation_contact_role` (ADMIN) via task reassignment or email, keep the case in `PENDING_APPROVAL` (escalation never approves anything), show the banner, restart the timer once. After a second timeout the task stays escalated and is flagged in the SaaS UI.
- Escalation must be auditable: action `APPROVAL_ESCALATED` with the correlation ID. Flow cannot write audit itself, so the escalation step goes through a Boomi process or an endpoint (open question for Uday).

## 10. Audit events expected within 5 s of a decision
Written by Django in the same DB transaction as the decision (so they exist when the 201 returns); visible via `GET /audit?correlation_id=<id>`. Audit rows use the **case's** correlation ID; the request's own `X-Correlation-ID` is kept in `data.request_correlation_id`.

| Decision | Events (actions) |
|---|---|
| Approve | `recommendation.decided` (decision, comments, approval_id, rank, option_type); `risk_case.status_changed` PENDING_APPROVAL -> APPROVED; Execution created PENDING (`execution_id` in the 201 body), then APPROVED -> EXECUTING after commit when U-10 starts |
| Reject | `recommendation.decided`; `risk_case.status_changed` -> REJECTED only if no actionable option remains, otherwise no case change (stays PENDING_APPROVAL); no execution |
| Request changes | `recommendation.decided`; `risk_case.status_changed` -> ANALYZING with `analysis_round` + 1; re-analysis triggered; no execution |

Action strings are taken from `backend/apps/workflow/services.py`; re-check against U-05 if the audit app renames them. `APPROVAL_ESCALATED` is not implemented anywhere yet (section 9, open question).
