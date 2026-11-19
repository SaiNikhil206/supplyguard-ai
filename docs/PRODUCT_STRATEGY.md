# SupplyGuard AI - Product Strategy (summary)

Summary of the strategy discussion that selected this product. Full requirements are in `docs/BRD_HLD_LLD.md`.

## Target
- Boomi World 2027 hackathon winner **and** a Boomi Marketplace submission candidate.
- Format: full SaaS product (React + Django + PostgreSQL) with a Boomi backend, plus a reusable Boomi Accelerator package.
- Marketplace publishing requires approved-partner status (Technology Partner Program). Our 31 Dec deliverable is a *tested, packaged, documented submission candidate*; partner approval and review are separate gates.

## Why this product
Existing Marketplace listings already cover parts of supply chain integration:

| Existing listing | What it does | Our gap to fill |
|---|---|---|
| SAP Supply Chain Planning Agent | Predicts delays from SAP POs | Go beyond prediction into recovery orchestration |
| B2B360 Accelerator | EDI visibility and troubleshooting | Add predictive supplier risk + business impact |
| ERP Data Sync for Coupa | Syncs supplier/PO data | Add supplier intelligence and governed decisions |
| OSI EDI Dashboard & Error Hospital | EDI monitoring and reprocessing | Add proactive prevention + recovery recommendations |

Differentiator: **Predict -> Understand -> Recover -> Verify.** Not another connector, not a chatbot - a supplier continuity and recovery platform.

## Boomi services and their visible role
| Service | Role | Priority |
|---|---|---|
| Integration | Read ERP suppliers/POs/inventory, canonical mapping, write approved PO changes | Core |
| Event Streams | `supplier.disruption`, `shipment.delay`, `recovery.status` topics | Core |
| Agentstudio | Supplier Risk Analyst + Recovery Planning Agent | Core |
| Flow | Procurement approval, reject, request change, escalation | Core |
| API Management | Governs SaaS <-> Boomi APIs, keys, rate limits | Core |
| Data Hub | Supplier golden records / dedupe | Optional (only if licensed) |

Every service must have a visible moment in the demo. Six services is not automatically better than five.

## SaaS screens
Executive Overview, Supplier Intelligence, Risk Command Center, AI Recommendations, Approval Center, Integration Center, Audit Center, Tenant Settings - plus the **What-if Recovery Simulator** ("What happens if Supplier A cannot deliver for 7 days?").

## Live demo (7-8 min)
1. Normal operations - dashboard: 100 suppliers, 500 POs, 20 active shipments.
2. Click **Simulate Supplier Disruption** - factory outage, 48 h delay; show Event Streams receiving it.
3. Supplier Risk Analyst - reads history, finds affected POs, explains risk with evidence (not just chat text).
4. Recovery Planning Agent - alternatives, inventory, cost/lead-time, ranked options.
5. Procurement manager approves in Flow.
6. Boomi updates the (mock) ERP PO; response verified.
7. Back to dashboard - detected, identified, approved, updated, audited.

Closing line: *"SupplyGuard AI doesn't just tell enterprises that their supply chain is at risk. It helps them recover before the disruption becomes a business crisis."*

All figures in the demo are illustrative synthetic data and must be labelled so.

## Do NOT build (for this POC)
10 ERP connectors, ML forecasting models, mobile app, blockchain tracking, autonomous PO changes without approval, multi-region deployment.

## Marketplace package contents (S6)
Integration processes, event processing, both agents, approval workflow, API definitions + config templates, sample data + test instructions, architecture diagram, deployment guide, SaaS onboarding guide, demo video.

Commercial model idea: free Marketplace starter accelerator -> paid SaaS subscription -> enterprise customization.
