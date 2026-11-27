# Boomi packaged components

Owners package their own components and hand the export to Roop, who assembles (R-12). Names are the intended names; replace `PLACEHOLDER` when exports exist. Status values: `TODO`, `EXPORTED`, `VERIFIED` (installed in a clean account in the dry run).

| # | Component | Type | Owner | Source task | Export file | Status |
|---|---|---|---|---|---|---|
| 1 | ERP read processes (supplier, open POs, inventory, alternates) | Integration processes | Uday | U-07 | `exports/uday/PLACEHOLDER` | TODO |
| 2 | Canonical JSON profiles (disruption event, ERP snapshot) | Profiles | Uday | U-07 | `exports/uday/PLACEHOLDER` | TODO |
| 3 | Mock ERP HTTP connection + operations | Connection / operations | Uday | U-07 | `exports/uday/PLACEHOLDER` | TODO |
| 4 | Event Streams topics `supplier.disruption`, `shipment.delay`, `recovery.status` | Event Streams | Uday | U-08 | `exports/uday/PLACEHOLDER` | TODO |
| 5 | Disruption subscriber process | Integration process | Uday | U-08 | `exports/uday/PLACEHOLDER` | TODO |
| 6 | API Management API (definition + API-key policy + rate limit) | API Management | Uday | U-09 | `exports/uday/PLACEHOLDER` (OpenAPI in `boomi/api/`) | TODO |
| 7 | Approved-action execution process (ERP PATCH, idempotency) | Integration process | Uday | U-10 | `exports/uday/PLACEHOLDER` | TODO |
| 8 | Error handling, retry, dead-letter processes | Integration processes | Uday | U-11 | `exports/uday/PLACEHOLDER` | TODO |
| 9 | Correlation + impact orchestration process | Integration process | Nikhil | N-08 | `exports/nikhil/PLACEHOLDER` | TODO |
| 10 | Supplier Risk Analyst agent (instructions, tools, guardrails) | Agentstudio agent | Nikhil | N-05 | `exports/nikhil/PLACEHOLDER` | TODO |
| 11 | Recovery Planning agent (instructions, tools, guardrails) | Agentstudio agent | Nikhil | N-06 | `exports/nikhil/PLACEHOLDER` | TODO |
| 12 | Agent invocation wiring + offline fallback | Integration process | Nikhil | N-09 | `exports/nikhil/PLACEHOLDER` | TODO |
| 13 | Approval workflow app | Flow app | Roop | R-06 | `exports/roop/PLACEHOLDER` (docs in `boomi/flow/`) | TODO |
| 14 | Environment extensions template | Config | Roop | R-12 | `config/environment-extensions.example.json` | TODO (draft written, keys to match real extensions) |
| 15 | Install guide, listing, architecture, dry-run checklist | Docs | Roop | R-12 | this folder | TODO (draft written) |

The mock ERP (`mock-erp/`) and the seed data (`data/`) are not Boomi components; they ship with the repository and are referenced by the install guide and `sample-data/README.md`.

When a row changes status, update it in the same commit as the export.
