# Marketplace listing - SupplyGuard AI

Draft text. Anything in `[PLACEHOLDER: ...]` is filled when the final package exists. Claims below describe what the project is built to do; confirm each against the final build before submission (no performance, savings or customer claims are made).

## Title
SupplyGuard AI - Supplier Disruption Response Accelerator

## Short description (one line)
Detect supplier disruptions, find the affected purchase orders, explain the risk with evidence, and run the approved recovery action with a full audit trail.

## Long description
SupplyGuard AI is a reference accelerator that shows how Boomi can orchestrate a supplier-disruption response from first signal to approved action.

When a disruption event arrives (for example a factory outage or shipment delay), Boomi processes read the supplier, open purchase orders, inventory and alternate-supplier data from the ERP. An Agentstudio agent explains the risk using that data, and a second agent proposes recovery options. A procurement manager reviews the evidence and approves, rejects or requests changes. Only after a recorded approval does a Boomi process write the change (for example a new expected date or a switch to an alternate supplier) to the ERP. Every step is recorded in an audit trail linked by a correlation id.

The accelerator ships with a multi-tenant web application (React + Django REST + PostgreSQL), a mock ERP, a synthetic dataset and the Boomi components, so it can be installed and demonstrated end to end without connecting a real ERP. The ERP calls are isolated behind Boomi processes, so they can be pointed at a real ERP by replacing the connector settings.

Included data is synthetic and illustrative only.

## Key features
- Disruption intake through API Management and Event Streams (`supplier.disruption`, `shipment.delay`, `recovery.status`).
- Impact analysis: which open purchase orders are affected, exposure value, inventory coverage.
- AI risk explanation and recovery recommendations produced by Agentstudio agents, validated against a JSON schema and checked against the source data before they are shown as actionable. Missing data is stated, not invented.
- Human approval step (Boomi Flow app, with an approval screen in the web app as fallback).
- Approved-action execution into the (mock) ERP with idempotency, retry and dead-letter handling.
- Audit trail for events, analysis, decisions and ERP writes, filtered by tenant and correlation id.
- Multi-tenant: tenant comes from the credential, not from the request body.
- Demo tooling: scenario simulator and a mock ERP with a failure-injection endpoint for testing error handling.

## Boomi services used
| Service | Used for |
|---|---|
| Boomi Integration (Runtime, processes, connectors) | ERP read processes, correlation and impact orchestration, approved-action execution, error handling |
| Event Streams | Topics `supplier.disruption`, `shipment.delay`, `recovery.status` |
| Agentstudio (Agent Garden) | Supplier Risk Analyst and Recovery Planning agents |
| Flow | Approval workflow app |
| API Management | API gateway with API-key policy in front of the Boomi listener processes |
| Data Hub | Optional, not required to run the accelerator |

Fallbacks if a service is unavailable in your account are documented in `docs/CONTRACTS.md` section 8 of the source repository.

## Target users
- Integration architects and partners who want a worked example of event-driven, human-in-the-loop automation on Boomi.
- Supply chain / procurement teams evaluating AI-assisted disruption response.
- Developers who want a reference for combining Boomi Integration, Event Streams, Agentstudio, Flow and API Management in one solution.

## Prerequisites
- A Boomi account with access to: Integration, Event Streams, Agentstudio, Flow and API Management. [PLACEHOLDER: confirm required licence/edition names after the dry run]
- An Atom or Runtime Cluster in an environment you can deploy to, reachable from the SaaS app and able to reach the ERP URL.
- Boomi API token (or credentials) permitted to import/deploy components. Never commit it.
- Docker and Docker Compose to run the SaaS app, PostgreSQL and the mock ERP locally (or equivalent hosting).
- Python 3.12 and Node.js for local development of the sample app. [PLACEHOLDER: exact versions from docs/INSTALL.md]

## Screenshots (to be captured in R-10)
| File | Shows |
|---|---|
| `screenshots/01-executive-overview.png` | Executive Overview dashboard |
| `screenshots/02-supplier-list.png` | Supplier list with risk levels |
| `screenshots/03-supplier-detail.png` | Supplier profile, KPIs, disruption history |
| `screenshots/04-risk-inbox.png` | Risk case inbox |
| `screenshots/05-risk-case-detail.png` | Risk case: affected POs, AI analysis with evidence |
| `screenshots/06-recommendations-approval.png` | Recovery options and approval decision |
| `screenshots/07-integration-center.png` | Integration status |
| `screenshots/08-audit-trail.png` | Audit trail by correlation id |
| `screenshots/09-boomi-process-canvas.png` | A Boomi process canvas (execution process) |
| `screenshots/10-flow-approval-app.png` | Boomi Flow approval app |
| `screenshots/11-agentstudio-agents.png` | Agentstudio agents |
| `screenshots/12-architecture.png` | Architecture diagram (render of `ARCHITECTURE.md`) |

[PLACEHOLDER: adjust the list to the screenshots actually captured in R-10.]

## Support
- Provided as a hackathon reference accelerator, **as is**, without a service level or warranty.
- Support contact: [PLACEHOLDER: team contact / repository issues URL]
- Report problems with the install guide through the repository issues, including the step number and the Boomi execution id.

## Licence
[PLACEHOLDER: licence not chosen yet - the repository has no LICENSE file. The team must decide (for example MIT or Apache-2.0) before submission and add the file.] Sample data is synthetic. Boomi, Event Streams, Agentstudio, Flow and API Management are Boomi products used under your own Boomi account terms.

## Version and compatibility
- Package version: [PLACEHOLDER: e.g. 1.0.0]
- Tested on: [PLACEHOLDER: Boomi release/date and runtime type, filled from the dry run]
