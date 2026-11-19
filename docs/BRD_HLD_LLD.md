# SupplyGuard AI - BRD / HLD / LLD (text version)

> Auto-converted from `docs/source/SupplyGuard_AI_BRD_HLD_LLD.docx`. The .docx is the signed-off original; this file exists so Claude and humans can grep it. If they disagree, the .docx wins.

BUSINESS REQUIREMENTS
DOCUMENT
SupplyGuard AI
AI-Powered Supplier Risk Intelligence & Supply Chain Recovery
| Document Type | Business Requirements Document (BRD) |
| Initiative | Boomi World 2027 Hackathon POC |
| Target Submission | 31 December 2026 |
| Version / Status | Version 1.0 – For Business Review |
# 1. Purpose
This document defines the business requirements for SupplyGuard AI, a proposed SaaS platform that helps organizations identify supplier disruptions, understand their impact on procurement and operations, and coordinate approved recovery actions. It establishes the scope, business objectives, key requirements and acceptance criteria for the Boomi World 2027 proof of concept.
# 2. Business Background and Problem Statement
Organizations depend on multiple suppliers, purchase orders, inventory locations and logistics partners. When a supplier experiences a disruption or delivery delay, the information is often spread across emails, ERP, warehouse and logistics systems. Procurement teams may discover the impact late and manually investigate affected orders, inventory shortages and alternative supply options.
The business need is for a consolidated, timely and traceable way to identify supplier risk, quantify its operational impact and coordinate recovery actions while retaining human approval for material business decisions.
# 3. Business Objectives
Provide a consolidated view of supplier health, disruption events and related business exposure.
Identify purchase orders, inventory positions and operational commitments potentially affected by a disruption.
Use AI-assisted analysis to explain risk and recommend practical recovery options based on available data.
Route proposed actions through configurable human approval before execution.
Orchestrate approved updates across connected enterprise systems using Boomi.
Maintain an auditable record of alerts, recommendations, approvals, execution outcomes and exceptions.
# 4. Scope
## 4.1 In Scope
A multi-tenant SaaS user interface for supplier risk and recovery operations.
Integration with a demo ERP and/or representative source systems for supplier, purchase order and inventory data.
Ingestion of supplier disruption and shipment-delay events.
Supplier risk assessment and identification of potentially affected purchase orders.
AI-generated explanations and recovery recommendations, supported by available source data.
A what-if scenario capability to estimate the impact of a selected supplier disruption.
Human approval or rejection of recommended recovery actions.
Execution of approved actions against the demo ERP or controlled test endpoint.
Status tracking, exception handling and audit history.
## 4.2 Out of Scope for the Initial POC
A production-grade global supplier marketplace or supplier onboarding network.
Autonomous purchasing, supplier contracting or financial commitments without human approval.
Guaranteed prediction of all supplier failures or external events.
Full integration with every ERP, WMS, TMS or supplier platform.
Production deployment certification, enterprise-wide rollout and commercial service-level commitments.
# 5. Stakeholders and User Roles
| Stakeholder / Role | Primary Responsibility |
| Business Sponsor | Confirms business priorities, scope and success measures. |
| Procurement Manager | Reviews supplier risk and approves or rejects recovery actions. |
| Supply Chain / Operations Manager | Assesses inventory, production and delivery impact. |
| Platform Administrator | Configures users, tenant settings, integrations and risk thresholds. |
| Boomi / Technical Team | Builds integrations, event orchestration, AI workflows and operational controls. |
# 6. High-Level Business Process
Supplier, shipment or internal operational data is received from connected systems or a configured event source.
The platform correlates the event with supplier records, purchase orders and inventory data.
The risk analysis identifies affected orders and estimates the potential business impact.
AI-assisted analysis provides an explanation and proposes one or more recovery options where sufficient data exists.
The authorized business user reviews the evidence and approves, rejects or requests changes to a recommendation.
Boomi orchestrates the approved update in the relevant connected system.
The platform records the execution result and displays the updated recovery status and audit trail.
# 7. Functional Business Requirements
| ID | Requirement | Business Requirement |
| BR-01 | Supplier visibility | The system shall display supplier profiles and available performance indicators, including delivery status and disruption history. |
| BR-02 | Event intake | The system shall accept supplier disruption and shipment-delay events from configured integration or event sources. |
| BR-03 | Risk identification | The system shall assess an incoming event against available supplier, purchase order and inventory data. |
| BR-04 | Impact analysis | The system shall identify potentially affected purchase orders and show the available operational and financial impact indicators. |
| BR-05 | Risk explanation | The system shall provide an understandable explanation of the identified risk and show the data or event evidence used. |
| BR-06 | Recovery recommendations | The system shall present feasible recovery options when sufficient supplier, inventory, lead-time and cost data is available. |
| BR-07 | What-if analysis | The system shall allow an authorized user to evaluate a hypothetical disruption scenario and view estimated impact. |
| BR-08 | Approval workflow | The system shall require authorized human approval before a proposed material business action is executed. |
| BR-09 | Action execution | The system shall initiate approved updates through Boomi and capture the response from the target system. |
| BR-10 | Exception handling | The system shall display failed, incomplete or rejected actions and support controlled retry or reassignment. |
| BR-11 | Audit history | The system shall record event details, recommendations, user decisions, execution status and timestamps. |
| BR-12 | Tenant and user administration | The system shall support tenant-scoped users, roles and configuration so one customer's data is not exposed to another customer. |
# 8. AI and Decision Governance Requirements
AI outputs must be grounded in the data available to the platform and must distinguish confirmed facts from estimates or assumptions.
The system must show the key evidence supporting a risk assessment or recommendation.
If required data is missing or unreliable, the system must state that limitation rather than inventing supplier capacity, pricing or delivery dates.
AI recommendations are advisory. The designated business user retains decision authority.
The system must not execute a material procurement or ERP change until the required approval is recorded.
AI-generated outputs and the corresponding approval and execution outcomes must be available in the audit history.
# 9. Non-Functional Requirements
| Area | Requirement |
| Security | Authenticate users and protect integration credentials; apply role-based access and tenant-level data isolation. |
| Privacy | Limit access to customer and supplier information to authorized users and configured integrations. |
| Reliability | Handle transient integration failures through controlled retries, error queues or equivalent exception handling. |
| Traceability | Provide correlation identifiers to trace an event through analysis, approval and execution. |
| Performance | For the controlled POC dataset, target event-to-risk visibility within 10 seconds under the agreed demo conditions. |
| Usability | Present risk, impact, evidence and approval actions in a clear interface for procurement and operations users. |
| Configurability | Allow key risk thresholds and integration settings to be configured without changing core business logic. |
| Extensibility | Use modular integrations and APIs so additional enterprise systems can be added in later phases. |
# 10. Proposed Solution Components
| Component | Business Purpose |
| SaaS application (React) | User experience for dashboards, supplier intelligence, risk review, approvals and audit. |
| Application backend (Django / REST APIs) | User and tenant management, application data, configuration and API coordination. |
| Boomi Integration | Connect enterprise systems and orchestrate data retrieval and approved business updates. |
| Boomi Event Streams | Receive and distribute disruption and shipment events for timely processing. |
| Boomi Agentstudio | Support AI-assisted supplier risk analysis and recovery planning. |
| Boomi Flow | Manage human review, approval, rejection and escalation. |
| Boomi API Management | Govern and secure APIs exposed between the SaaS application and integration layer. |
| Boomi Data Hub (optional) | Support consistent supplier and product master data where available and justified for the POC. |
The final Boomi service selection is subject to the organization's available licenses, environment access and technical validation. The POC may use representative or simulated enterprise endpoints.
# 11. Assumptions and Dependencies
The project will have access to the required Boomi environment, services and development permissions.
A representative ERP dataset or mock API will be available for suppliers, purchase orders and inventory.
Supplier disruption events will be supplied through test events, sample feeds or a controlled event generator.
The quality of impact analysis and recovery recommendations depends on the completeness and accuracy of source data.
External AI model access, usage limits and associated costs will be confirmed before implementation.
The initial POC will demonstrate a controlled workflow and will not be represented as a production-ready deployment.
# 12. Success Measures and Acceptance Criteria
| ID | Acceptance Criterion |
| AC-01 | A configured supplier disruption event is received and correlated to the relevant supplier. |
| AC-02 | The system identifies the affected purchase orders in the agreed test dataset and displays the supporting data. |
| AC-03 | The system explains the risk and clearly labels estimates, assumptions and missing data. |
| AC-04 | At least one recovery option is presented when the test data supports a viable option. |
| AC-05 | A user can approve or reject the proposed action through the approval workflow. |
| AC-06 | Only an approved action is sent for execution, and the target-system response is captured. |
| AC-07 | The end-to-end event, recommendation, decision and execution result can be reviewed in the audit history. |
| AC-08 | Tenant isolation and role permissions pass the agreed POC test cases. |
| AC-09 | The controlled demonstration meets the agreed event-processing response target under the defined test conditions. |
# 13. Key Risks and Considerations
| Risk | Mitigation / Consideration |
| Incomplete or inaccurate source data | Use clearly defined demo data, data validation and visible confidence/limitations. |
| AI-generated unsupported recommendations | Ground outputs in retrieved records, require evidence and retain human approval. |
| Integration or API instability | Use retries, idempotency controls, correlation IDs and visible exception status. |
| Limited development time | Prioritize the end-to-end disruption-to-approved-recovery workflow over broad connector coverage. |
| Marketplace acceptance uncertainty | Treat Marketplace submission as a separate review process; confirm eligibility and packaging requirements before submission. |
# 15. High-Level Design (HLD)
This section describes the logical solution architecture and the responsibilities of the major application and Boomi components. It extends the business requirements above into a proposed technical structure for the proof of concept. Final connector choices and deployment topology will be confirmed during technical design.
## 15.1 Architecture Overview
SupplyGuard AI is structured as a SaaS application with a Django REST backend and a Boomi-led integration and orchestration layer. The web application is the user-facing control plane. Boomi connects enterprise data sources, processes disruption events, invokes AI-assisted analysis and coordinates approved recovery actions.
Note: The diagram is a logical view. Boomi Event Streams, Agentstudio, Flow and API Management are used where available in the selected Boomi subscription and environment. Data Hub remains optional.
## 15.2 Component Responsibilities
| Component | Key Responsibilities | Primary Interaction |
| React SaaS UI | Supplier dashboard, disruption inbox, impact view, what-if simulation, recommendations, approvals and audit screens. | Calls Django REST APIs over HTTPS. |
| Django REST backend | Authentication, tenant resolution, role checks, configuration, persistence, UI-facing APIs and audit records. | Calls governed Boomi APIs; reads/writes application PostgreSQL. |
| PostgreSQL | Stores tenant configuration, users/roles, risk cases, affected PO snapshots, recommendations, approval references and audit events. | Accessed by Django backend; no direct browser access. |
| Boomi API Management | Publishes and governs APIs used by the SaaS backend; applies configured access and traffic policies. | Fronts the Boomi integration API endpoints. |
| Boomi Integration | Reads ERP/supplier/inventory data, maps canonical payloads, correlates records, executes approved ERP changes and handles integration errors. | Connects to ERP/WMS/TMS, Event Streams, Flow and application APIs. |
| Boomi Event Streams | Carries disruption, shipment and recovery-status events for decoupled event processing. | Receives events from integrations or test event publisher; consumers process event messages. |
| Boomi Agentstudio | Provides Supplier Risk Analyst and Recovery Planning agent capabilities using retrieved business context. | Receives normalized event and impact context; returns structured analysis and recommendations. |
| Boomi Flow | Manages approval, rejection, request-for-change and escalation tasks. | Receives recommendation context and invokes approved-action integration. |
| Boomi Data Hub (optional) | Maintains consistent supplier/product master records if the POC environment supports it. | Supplies mastered identifiers and attributes to integration processes. |
## 15.3 Logical Data Flow
Data acquisition: Boomi Integration retrieves supplier, purchase order and inventory records from the demo ERP or mock endpoints. A disruption event is received from a supplier feed, test publisher or shipment source.
Normalization: Boomi maps source-specific records into canonical supplier, purchase order, inventory and disruption-event structures.
Correlation and impact: the event is matched to a supplier and related open purchase orders. Available inventory and due-date information is used to identify possible shortages and exposure.
AI analysis: the Supplier Risk Analyst explains the risk and evidence. The Recovery Planning Agent evaluates available alternatives and returns structured options with assumptions and missing-data flags.
Approval: Boomi Flow routes the recommendation to an authorized Procurement Manager. The user approves, rejects or requests changes.
Execution: only an approved action is sent through Boomi Integration to the target ERP/mock API. The response is correlated to the original risk case.
Verification and audit: the application updates case status and records the event, analysis, approval decision, execution response and timestamps.
## 15.4 Deployment and Environment View
Frontend: React application hosted on an approved web hosting platform and accessed over HTTPS.
Backend: Django REST service hosted in an approved application environment; it is the only application component permitted to access the application database.
Database: PostgreSQL hosted in a managed or approved development environment with backups appropriate to the POC.
Boomi: development processes, APIs, event resources and Flow workflows deployed to the designated Boomi development environment.
Enterprise endpoints: use a demo ERP, mock REST service or approved sandbox. Production credentials and production write access are not required for the POC.
## 15.5 Security and Tenant Isolation Design
Authenticate each user and derive the tenant context from the validated server-side identity/session claims.
Do not trust a tenant identifier supplied only in a browser request body or query parameter.
Apply tenant filters to every tenant-owned database query and verify tenant ownership before reading or updating a risk case.
Use role-based authorization for administrative configuration, risk review, approval and execution actions.
Store integration credentials in an approved secrets store or encrypted configuration; never expose credentials to the browser or logs.
Pass a validated tenant context and correlation identifier to Boomi APIs; enforce the tenant context again in the integration layer.
Use TLS for service-to-service communication and maintain audit records for privileged actions.
# 16. Low-Level Design (LLD)
The following LLD defines the proposed POC-level interfaces, data structures, process steps and control points. It is intended to guide implementation; exact endpoint paths, connector operations and field mappings may be adjusted to match the selected demo ERP and Boomi environment.
## 16.1 Core Business Entities
| Entity | Key Attributes (illustrative) | Purpose |
| Tenant | tenant_id, tenant_name, status, created_at | Separates customer configuration and records. |
| User | user_id, tenant_id, name, email, role, status | Identifies a user and their tenant-scoped permissions. |
| Supplier | supplier_id, tenant_id, name, location, status, risk indicators | Represents a supplier and available performance context. |
| PurchaseOrder | po_id, tenant_id, supplier_id, order_date, expected_date, status, amount, currency | Represents supply commitments potentially affected by an event. |
| Inventory | item_id, location_id, tenant_id, on_hand_qty, reserved_qty, safety_stock | Provides stock context for shortage and recovery analysis. |
| DisruptionEvent | event_id, tenant_id, supplier_id, event_type, severity, start_time, expected_duration, source | Captures supplier or shipment disruption information. |
| RiskCase | risk_case_id, tenant_id, event_id, risk_level, impact_summary, status, correlation_id | Tracks analysis and recovery lifecycle. |
| AffectedPO | risk_case_id, po_id, affected_qty, estimated_delay, exposure_amount | Links a risk case to impacted purchase orders. |
| Recommendation | recommendation_id, risk_case_id, option_type, proposed_action, assumptions, estimated_cost, lead_time, status | Stores AI-assisted recovery options and evidence. |
| Approval | approval_id, recommendation_id, approver_id, decision, comments, decision_time | Records human approval outcome. |
| Execution | execution_id, approval_id, target_system, request_reference, response_status, response_payload, executed_at | Tracks the result of an approved action. |
| AuditEvent | audit_id, tenant_id, actor, action, entity_type, entity_id, timestamp, correlation_id | Provides traceability across the workflow. |
## 16.2 Proposed API Contracts
The Django REST API is the application-facing interface. Boomi endpoints should be exposed through the configured API governance layer. The paths below are proposed logical routes, not existing deployed endpoints.
| Method / Route | Purpose | Key Request / Response |
| GET /api/v1/suppliers | List suppliers for the authenticated tenant. | Filters: status, risk_level; returns supplier summary and risk indicators. |
| GET /api/v1/risk-cases | List risk cases. | Filters: status, severity, date range; returns case summary and impact. |
| GET /api/v1/risk-cases/{id} | Retrieve case details. | Returns event, affected POs, evidence, recommendations and workflow status. |
| POST /api/v1/events/disruptions | Accept a disruption event from an authorized source. | Request: supplier reference, event type, severity, timestamps, source; response: accepted event ID and correlation ID. |
| POST /api/v1/risk-cases/{id}/what-if | Run a hypothetical disruption scenario. | Request: duration, supplier/event parameters; response: estimated affected POs, inventory gaps and assumptions. |
| POST /api/v1/recommendations/{id}/decision | Record approval or rejection. | Request: decision, comments; response: decision status and workflow reference. |
| POST /api/v1/executions/{id}/retry | Request controlled retry for an eligible failed action. | Requires authorized role and retry eligibility; returns retry reference. |
| GET /api/v1/audit | Retrieve tenant-scoped audit history. | Filters: entity, action, date range, correlation ID. |
## 16.3 Canonical Event and Message Structure
A normalized disruption event should contain, at minimum, the following logical fields:
| Field | Type / Example | Description |
| event_id | String / EVT-000123 | Unique event identifier. |
| tenant_id | String | Validated tenant context; set or verified by trusted integration boundary. |
| supplier_id | String | Supplier reference used for correlation. |
| event_type | Enum / FACTORY_OUTAGE, SHIPMENT_DELAY | Type of disruption. |
| severity | Enum / LOW, MEDIUM, HIGH, CRITICAL | Source severity or normalized severity. |
| event_time | ISO-8601 timestamp | Time the event occurred or was reported. |
| expected_duration_hours | Number / 48 | Estimated disruption duration when supplied. |
| description | String | Source description or event summary. |
| source_system | String | Originating system or feed. |
| correlation_id | String / UUID | End-to-end trace identifier. |
## 16.4 Detailed Processing Logic
Validate the incoming event schema, source authentication, required fields and timestamp format. Reject invalid messages with a structured error.
Resolve tenant context from the trusted API credential or integration configuration; verify that the supplier belongs to that tenant.
Check event_id or source event reference for duplicates. If already processed, return the existing correlation/result rather than creating a duplicate risk case.
Retrieve supplier profile, open purchase orders and inventory balances through Boomi Integration.
Correlate open purchase orders by supplier_id and evaluate requested quantities, due dates and available inventory.
Create or update the RiskCase and AffectedPO records. Record the calculation inputs and identify unavailable data.
Invoke the Supplier Risk Analyst with normalized facts and request an evidence-based risk explanation in a defined structured response.
Invoke the Recovery Planning Agent to compare supported options such as alternate supplier sourcing, inventory transfer or revised delivery schedule.
Validate agent output against the known schema and source facts. Flag unsupported or incomplete options for user review.
Create a Flow approval task. Do not call the ERP write operation at this stage.
On approval, verify approver authorization and recommendation status, then invoke the approved-action integration process.
Use an idempotency key for the write request. Capture target-system response and update Execution, RiskCase and AuditEvent records.
On rejection, record the decision and close or return the recommendation to analysis according to configured workflow rules.
On execution failure, mark the action as failed or pending retry; do not report recovery as completed until the target response is verified.
## 16.5 AI Agent Input and Output Contracts
| Agent | Input Context | Expected Structured Output |
| Supplier Risk Analyst | Disruption event, supplier profile, supplier performance history, open POs, inventory context and data-quality flags. | Risk level, concise explanation, affected entities, evidence references, assumptions, missing data and confidence/limitations. |
| Recovery Planning Agent | Validated impact summary, available alternate suppliers, inventory at other locations, lead times, cost data and business constraints. | Ranked recovery options, action steps, estimated lead time/cost where supported, trade-offs, assumptions and data gaps. |
Agent responses should be machine-readable and schema-validated before being persisted or shown as actionable recommendations. The agents must not invent supplier capacity, prices, inventory quantities or delivery commitments.
## 16.6 Approval and Execution State Model
| State | Meaning / Allowed Transition |
| RECEIVED | Event accepted and awaiting correlation. |
| ANALYZING | Source data retrieval and impact analysis in progress. |
| RECOMMENDATION_READY | Risk analysis and one or more supported options are available. |
| PENDING_APPROVAL | Awaiting authorized business decision. |
| APPROVED | Authorized approver approved the selected option; execution may begin. |
| REJECTED | Approver rejected the option; no target-system write is permitted. |
| EXECUTING | Approved action is being sent to the target system. |
| RECOVERED | Target system confirmed the approved action. |
| EXECUTION_FAILED | Target system rejected or failed the action; controlled retry or manual resolution required. |
| CLOSED | Case completed or closed by an authorized user. |
## 16.7 Error Handling, Retry and Idempotency
Use a correlation_id across event ingestion, Boomi process execution, agent invocation, Flow approval and target-system update.
Use event_id for inbound duplicate detection and an idempotency key for every target-system write operation.
Classify errors as validation, authorization, business-rule, transient connectivity or downstream-system errors.
Retry only transient errors, using bounded retry attempts and an appropriate delay strategy. Do not automatically retry validation or authorization failures.
Persist failed message metadata and a sanitized error summary for operational review; avoid logging secrets or unnecessary personal data.
Expose failed and pending actions in the application so an authorized user can investigate and request a controlled retry.
Update the case to RECOVERED only after a successful response or subsequent verification from the target system.
## 16.8 Minimum POC Test Scenarios
| Test ID | Scenario | Expected Result |
| TC-01 | Valid supplier disruption event | Event accepted, supplier correlated and risk case created. |
| TC-02 | Event references unknown supplier | Event flagged for data correction; no unsupported impact is generated. |
| TC-03 | Supplier has multiple open POs | All matching open POs are evaluated and affected records are displayed. |
| TC-04 | Inventory is sufficient to cover delay | Impact analysis reflects available inventory and does not claim an unsupported shortage. |
| TC-05 | Insufficient alternate supplier data | Agent states that no validated alternative can be recommended. |
| TC-06 | Approver rejects recommendation | No ERP write occurs; rejection and comments are audited. |
| TC-07 | Approver approves recommendation | Boomi executes the approved action and captures target response. |
| TC-08 | Target API times out | Execution is marked failed/pending; retry is controlled and duplicate update is prevented. |
| TC-09 | Duplicate disruption event | Duplicate event does not create duplicate risk cases or repeated execution. |
| TC-10 | Cross-tenant record access attempt | Request is denied and the access attempt is logged. |
# 17. Open Design Decisions
| Decision | To Be Confirmed |
| ERP / source system | Select the demo ERP, sandbox or mock API and confirm available data fields. |
| Boomi service availability | Confirm access and licensing for Event Streams, Agentstudio, Flow, API Management and optional Data Hub. |
| AI model and runtime | Confirm the approved model, connectivity, usage limits and data-handling requirements. |
| Tenant topology | Confirm the POC tenant-routing model and whether separate Boomi environments are required. |
| Recovery action | Select the demonstrable write-back action, such as PO date update or alternate supplier assignment. |
| Performance test conditions | Agree dataset size, event volume and measurement method for the POC response-time target. |
Document note: Sections 1–14 retain the original BRD content. Sections 15–17 add the proposed HLD, LLD and open technical decisions. The HLD/LLD are design proposals for the POC and should be baselined with the technical team after confirming Boomi environment capabilities and source-system interfaces.