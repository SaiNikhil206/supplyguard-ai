# Dry run checklist (R-12 acceptance)

Acceptance: **the package installs into a clean Boomi account following only `INSTALL_GUIDE.md`**. Performed by Nikhil or Uday (not Roop, who wrote the guide).

Rules for the tester: use a clean Boomi account/environment, only the zip contents and the guide. If you need to ask anyone or look elsewhere, that is a guide defect - write it down.

| Field | Value |
|---|---|
| Tester | |
| Date | |
| Boomi account / environment (name only, no secrets) | |
| Package version / commit | |
| Start time / end time | |

## Before starting
- [ ] Boomi account has no SupplyGuard components (clean)
- [ ] All `PLACEHOLDER` markers are gone from `INSTALL_GUIDE.md` and `COMPONENTS.md` has no `TODO` rows
- [ ] Only the zip and the guide are used

## Install steps (mark each with pass/fail and the guide section)
| Guide section | Pass | Notes / problem found |
|---|---|---|
| 1 Prerequisites | [ ] | |
| 2 Import components | [ ] | |
| 3 Environment extensions | [ ] | |
| 4 API Management | [ ] | |
| 5 Event Streams topics | [ ] | |
| 6 Agentstudio agents | [ ] | |
| 7 Flow app | [ ] | |
| 8 Connect the SaaS app | [ ] | |
| 9 Load sample data | [ ] | |
| 10 Verification (end-to-end scenario) | [ ] | |

## Verification results
- [ ] Call without API key is rejected by the gateway
- [ ] Scenario `tc01_valid_event` creates a RiskCase with affected POs
- [ ] AI analysis appears with evidence
- [ ] Approval recorded, ERP PO changed in mock ERP, `recovery.status` published
- [ ] Audit trail shows the full chain under one correlation id
- [ ] Duplicate event (`tc09`) creates no second case
- [ ] Boomi execution ids / TEST_LOG.md entry added (`boomi/TEST_LOG.md`)

## Result
- [ ] **PASS** - installed using only the guide
- [ ] **FAIL** - list guide defects below; Roop fixes and a second dry run is needed

Defects / unclear steps:
1.
