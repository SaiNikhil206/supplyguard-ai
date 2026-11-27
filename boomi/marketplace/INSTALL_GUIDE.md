# Install guide - SupplyGuard AI accelerator

Goal: install the accelerator into a clean Boomi account and run one disruption end to end. Allow about half a day.

Text marked `PLACEHOLDER` is filled once Uday (U-10) and Nikhil (N-09) provide their exports and names. Do not start a dry run until none remain.

## 1. Prerequisites

- Boomi account with Integration, Event Streams, Agentstudio, Flow and API Management enabled. If one is missing see the fallbacks in `docs/CONTRACTS.md` section 8 (source repository).
- An Atom (or Runtime Cluster) attached to an environment, online, able to reach the mock ERP URL and the SaaS app URL.
- A Boomi API token with rights to import and deploy. Keep it out of git.
- Docker and Docker Compose (to run the SaaS app, PostgreSQL and mock ERP) and a public or tunnelled URL for the SaaS app and mock ERP if your Atom is not on the same network.
- The package zip unpacked locally (this folder).
- A SaaS system API key and mock ERP API key you generate yourself (any long random strings). Record them in a password manager.

## 2. Import the packaged components

Import in this order. Each export is in `exports/` (see `COMPONENTS.md` for the final file names).

| Step | Component | Export file | Where in Boomi |
|---|---|---|---|
| 2.1 | Canonical profiles | `exports/PLACEHOLDER` | Build > import |
| 2.2 | Mock ERP connection + operations | `exports/PLACEHOLDER` | Build > import |
| 2.3 | ERP read processes | `exports/PLACEHOLDER` | Build > import |
| 2.4 | Correlation + impact orchestration process | `exports/PLACEHOLDER` | Build > import |
| 2.5 | Agent invocation wiring + fallback | `exports/PLACEHOLDER` | Build > import |
| 2.6 | Approved-action execution process | `exports/PLACEHOLDER` | Build > import |
| 2.7 | Error handling, retry, dead-letter | `exports/PLACEHOLDER` | Build > import |
| 2.8 | Disruption subscriber process | `exports/PLACEHOLDER` | Build > import |

Then deploy all processes to your environment (Deploy > create package > deploy). [PLACEHOLDER: exact import method (package import / component XML / API) agreed with Uday]

## 3. Environment extensions

1. Open Manage > Environment Extensions for your environment.
2. Use `config/environment-extensions.example.json` as the list of values to fill: SaaS base URL and system API key, mock ERP URL and key, gateway URL, Event Streams token, agent ids, Flow URL.
3. Fill the values in the Boomi UI. Do not save real values in the JSON file or in git.
4. Save and redeploy if Boomi asks.

## 4. API Management setup

1. Import the API definition from `boomi/api/` (OpenAPI) / `exports/PLACEHOLDER`.
2. Link the API proxy to the listener processes deployed in step 2.
3. Create an API-key authentication policy and a rate limit policy. [PLACEHOLDER: policy names and limits from U-09]
4. Deploy the API to your environment's gateway and create a consumer key for the SaaS app. Put the gateway URL and that key in the SaaS `.env` (step 8).
5. Check: a request without the key returns 401/403.

## 5. Event Streams topics

Create these topics in the Event Streams service (names exact; payloads in CONTRACTS section 3):

| Topic | Payload |
|---|---|
| `supplier.disruption` | canonical disruption event |
| `shipment.delay` | same shape with `event_type=SHIPMENT_DELAY`, plus `shipment_id`, `po_id` |
| `recovery.status` | `{risk_case_id, execution_id, status, correlation_id, time}` |

Then create the token used by the processes and put it in the environment extension (step 3). Confirm the subscriber process is subscribed to `supplier.disruption`. [PLACEHOLDER: subscription / consumer-group name from U-08]

## 6. Agentstudio agents

Create two agents in Agent Garden from `exports/PLACEHOLDER` (or from the instruction files in `boomi/agents/`):

1. **Supplier Risk Analyst** - output follows `ai/schemas/risk_analysis.schema.json`.
2. **Recovery Planning** - output follows the recovery schema in `ai/schemas/`.

For each: paste instructions, add the tools and guardrails from the export, deploy the agent, and copy its id into the environment extension (step 3). [PLACEHOLDER: tool wiring details from N-05/N-06/N-09]

## 7. Flow app

1. Import or build the approval flow as described in `boomi/flow/` (R-06). [PLACEHOLDER: link to the final README once R-06 is merged]
2. Publish it and copy the flow URL / id into the environment extension.
3. If Flow is not available, the SaaS Approval Center page performs the approval instead; skip this step.

## 8. Connect the SaaS app

1. Copy the repo `.env.example` to `.env` and add the lines from `config/saas.env.example` (gateway URL, gateway key, system API key, secrets).
2. Start the stack: `docker compose up -d --build` from the repository root. Follow `docs/INSTALL.md` for the exact commands. [PLACEHOLDER: align with Uday's INSTALL.md]
3. Open the UI, sign in with a seeded demo user (listed in `docs/INSTALL.md`).
4. In Integration Center confirm Boomi shows healthy.

## 9. Load the sample data

Follow `sample-data/README.md`: start the mock ERP, load the Django seed, and (for a live demo) re-anchor the dates.

## 10. Verify end to end

1. As an ADMIN, run `POST /api/v1/demo/simulate-disruption` with scenario `tc01_valid_event` (or use the UI simulator).
2. In Boomi > Process Reporting, see the subscriber and orchestration executions complete.
3. In the UI a new risk case appears with affected purchase orders and an AI analysis with evidence.
4. Approve a recommendation as a procurement manager.
5. In the mock ERP (`GET /erp/purchase-orders/...`) the PO changed; topic `recovery.status` carries the result.
6. Open the Audit page: events, analysis, decision and ERP write share one correlation id.
7. Send `tc09_duplicate_event`: no second case is created.
8. Call the gateway without an API key: rejected.
9. Add the run to `boomi/TEST_LOG.md`.

## 11. Troubleshooting

| Symptom | Check |
|---|---|
| Gateway returns 401/403 for the SaaS app | Consumer key not set in `.env`, or API not deployed to the right environment |
| No Boomi execution after the event | Subscriber not deployed/running; Atom offline; topic name typo; Event Streams token wrong |
| Boomi cannot reach the ERP | Atom network cannot reach `MOCK_ERP` URL; use a tunnel; `X-Api-Key` mismatch |
| Callbacks to Django fail with 401/403 | System API key differs between Boomi extension and SaaS `.env`; tenant in payload differs from the key's tenant (403) |
| Risk case created but no AI analysis | Agent id missing/undeployed; check the offline fallback in the wiring process; agent output rejected by schema validation (check the audit trail) |
| ERP write not applied | No recorded approval; ERP chaos mode on (`POST /erp/_chaos {"mode":"off"}`); see retry/dead-letter process |
| Expected affected POs do not match scenario | Seed dates not anchored on the scenario `event_time` (re-run `generate_seed.py --as-of`) |
| Duplicate case created | `event_id` not unique in the replayed event |

If a step fails and the table does not help, note the step number and Boomi execution id and open an issue in the repository.
