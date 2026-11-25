# Flow approval - test plan (R-06)

Prereqs: environment up (U-01), decision endpoint (N-10, built), execution process (U-10), a seeded risk case in `PENDING_APPROVAL` with 2+ options (each its own `REC-...`), a PROCUREMENT_MANAGER user, a VIEWER user, an ADMIN user. `CID` = the case's correlation ID. Log every run in `boomi/TEST_LOG.md`.

Auth for all decision calls: `Authorization: Bearer <manager JWT>` (an API key gets 403, see spec section 6). Success is HTTP **201** with a flat body.

## A. Acceptance 1 - Approve starts execution, Reject does not
| # | Step | Endpoint (CONTRACTS 4) | Expected |
|---|---|---|---|
| A1 | Start the Flow for case X as the manager | `GET /risk-cases/{id}` | Approval page shows evidence, ranked options, comment box, 3 buttons; status `PENDING_APPROVAL` |
| A2 | Select option rank 1, comment "ok", click Approve | `POST /recommendations/{REC}/decision` `{APPROVE, "ok"}` | 201; `decision=APPROVE`, `recommendation_status=APPROVED`, `case_status=APPROVED`, `execution_id` set; page says "Execution started" |
| A3 | Check the case | `GET /risk-cases/{id}` | `APPROVED` then `EXECUTING`; approval recorded; one execution exists |
| A4 | Wait for Boomi result | `POST /internal/executions/{id}/result` (Boomi), then `GET /risk-cases/{id}` | `RECOVERED`, or `EXECUTION_FAILED` with error; mock ERP changed only now |
| A5 | Case Y: click Reject with empty comment | none | Flow validation blocks, no call (backend would answer 400) |
| A6 | Case Y with ONE option: Reject with comment "supplier will recover" | `POST .../decision` `{REJECT, ...}` | 201; `execution_id` null; `case_status=REJECTED`; "No ERP change will be made" |
| A7 | Check case Y | `GET /risk-cases/{id}` | `REJECTED`; executions empty; mock ERP unchanged |
| A7b | Case W with 2 options: Reject option 1 | `POST .../decision` | 201; `case_status` stays `PENDING_APPROVAL`; Flow offers back-to-Approval; option 2 still decidable; no execution |
| A8 | Case Z: Request changes with comment | `POST .../decision` `{REQUEST_CHANGES, ...}` | 201; `case_status=ANALYZING`, `analysis_round` + 1; no execution |

## B. Acceptance 2 - visible in SaaS Approval Center and audit within 5 s
| # | Step | Endpoint | Expected |
|---|---|---|---|
| B1 | Note time T when Approve is clicked | - | - |
| B2 | Open case X in SaaS Approval Center (R-05) | `GET /risk-cases/{id}` | decision, actor (the manager), comment visible by T+5 s |
| B3 | Audit Center (R-08) filtered by correlation ID | `GET /audit?correlation_id=CID` | events from spec section 10 (`recommendation.decided`, `risk_case.status_changed`) present by T+5 s, case CID on every row |
| B4 | Repeat B1-B3 for Reject | same | same |

## C. Guards and errors
| # | Step | Endpoint | Expected |
|---|---|---|---|
| C1 | Start the Flow as VIEWER | `GET /me` | Not authorized, no decision call |
| C2 | Call decision directly as VIEWER, ADMIN, and with a SYSTEM API key | `POST .../decision` | each 403 `FORBIDDEN` |
| C3 | Decide the same option twice (second tab) | `POST .../decision` | 409 `CONFLICT`, `details.reason` `CASE_NOT_PENDING_APPROVAL` or `ALREADY_DECIDED`; Flow reloads and shows already decided |
| C4 | Case not in `PENDING_APPROVAL` | `GET /risk-cases/{id}` | Flow says not actionable |
| C5 | Stop Django or use a bad base URL | any | error page with Retry; after 3 retries points to Approval Center; reload before reporting any outcome |
| C6 | Option flagged `unsupported` by N-07 | `POST .../decision` | 422 `BUSINESS_RULE`, `details.reason` `UNSUPPORTED_OPTION`; message and reasons shown, back to Approval |
| C7 | Decide an option of an old round (after a re-analysis) | `POST .../decision` | 409 `details.reason` `STALE_ROUND`; Flow reloads options |
| C8 | Expired or missing JWT | `POST .../decision` | 401 `UNAUTHENTICATED`; re-login then retry once |
| C9 | Other tenant's recommendation id | `POST .../decision` | 404 `NOT_FOUND` (same as a missing id) |
| C10 | Comment over 2000 chars | `POST .../decision` | 400 `VALIDATION_ERROR` |
| C11 | Correlation ID | any call | `X-Correlation-ID` sent by Flow is echoed in the response; audit rows carry the case's CID, request CID in `data.request_correlation_id` |

## D. Escalation
| # | Step | Expected |
|---|---|---|
| D1 | Set `escalation_hours` to ~2 minutes, open the Approval page, wait | banner shown, ADMIN notified, status still `PENDING_APPROVAL` |
| D2 | Check audit | `APPROVAL_ESCALATED` event only if an endpoint for it exists (open question); otherwise record "not auditable yet" in the test log |
| D3 | Decide after escalation | works normally |

## E. Fallback check
Disable Flow; decide in the SaaS Approval Center; confirm Django triggers the same Boomi execution (CONTRACTS 8). Same results as A3 / A7.
