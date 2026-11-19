# Flow approval - test plan (R-06)

Prereqs: environment up (U-01), decision endpoint (N-10), execution process (U-10), a seeded risk case in `PENDING_APPROVAL`, a PROCUREMENT_MANAGER user and a VIEWER user. `CID` = the case's correlation ID. Log every run in `boomi/TEST_LOG.md`.

## A. Acceptance 1 - Approve starts execution, Reject does not
| # | Step | Endpoint (CONTRACTS 4) | Expected |
|---|---|---|---|
| A1 | Start the Flow for case X as the manager | `GET /risk-cases/{id}` | Approval page shows evidence, ranked options, comment box, 3 buttons; status `PENDING_APPROVAL` |
| A2 | Select option rank 1, comment "ok", click Approve | `POST /recommendations/{id}/decision` `{APPROVE, "ok"}` | 200; Confirmation says "Execution started" |
| A3 | Check the case | `GET /risk-cases/{id}` | `APPROVED` then `EXECUTING`; decision in approvals; an execution exists |
| A4 | Wait for Boomi result | `POST /internal/executions/{id}/result` (Boomi), then `GET /risk-cases/{id}` | `RECOVERED`, or `EXECUTION_FAILED` with error |
| A5 | Case Y: click Reject with empty comment | none | validation blocks, no call |
| A6 | Reject with comment "supplier will recover" | `POST /recommendations/{id}/decision` `{REJECT, ...}` | 200; "No ERP change will be made" |
| A7 | Check case Y | `GET /risk-cases/{id}` | `REJECTED`; executions empty; mock ERP unchanged |
| A8 | Case Z: Request changes with comment | `POST .../decision` `{REQUEST_CHANGES, ...}` | 200; returned for rework, no execution |

## B. Acceptance 2 - visible in SaaS Approval Center and audit within 5 s
| # | Step | Endpoint | Expected |
|---|---|---|---|
| B1 | Note time T when Approve is clicked | - | - |
| B2 | Open case X in SaaS Approval Center (R-05) | `GET /risk-cases/{id}` | decision, actor, comment visible by T+5 s |
| B3 | Audit Center (R-08) filtered by correlation ID | `GET /audit?correlation_id=CID` | events from spec section 10 present by T+5 s, same CID on every row |
| B4 | Repeat B1-B3 for Reject | same | same |

## C. Guards and errors
| # | Step | Endpoint | Expected |
|---|---|---|---|
| C1 | Start the Flow as VIEWER | `GET /me` | Not authorized, no decision call |
| C2 | Call decision as VIEWER directly (bypass Flow) | `POST .../decision` | 403 `FORBIDDEN` |
| C3 | Decide the same case twice (second tab) | `POST .../decision` | 409 `CONFLICT`; Flow reloads, shows already decided |
| C4 | Case not in `PENDING_APPROVAL` | `GET /risk-cases/{id}` | Flow says not actionable |
| C5 | Stop Django or use a bad base URL | any | error page with Retry; after 3 retries points to Approval Center |
| C6 | Business-rule failure (case supplied by N-10) | `POST .../decision` | 422 message shown, back to Approval page |
| C7 | Correlation ID | any call | `X-Correlation-ID` equals `CID` on request and response and in audit |

## D. Escalation
| # | Step | Expected |
|---|---|---|
| D1 | Set `escalation_hours` to ~2 minutes, open the Approval page, wait | banner shown, ADMIN notified, status still `PENDING_APPROVAL` |
| D2 | Check audit | `GET /audit?correlation_id=CID` shows the escalation event (once its endpoint exists) |
| D3 | Decide after escalation | works normally |

## E. Fallback check
Disable Flow; decide in the SaaS Approval Center; confirm Django triggers the same Boomi execution (CONTRACTS 8). Same results as A3 / A7.
