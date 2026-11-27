# Architecture

Names of Boomi processes are indicative; see `COMPONENTS.md` for the final component names.

## Components

```mermaid
flowchart LR
  subgraph SaaS["SupplyGuard SaaS (multi-tenant)"]
    FE["React + Vite UI"]
    BE["Django REST API"]
    DB[("PostgreSQL 16")]
    FE -->|JWT, /api/v1| BE
    BE --> DB
  end

  subgraph Boomi["Boomi platform"]
    APIM["API Management\n(API key, rate limit)"]
    ES[["Event Streams\nsupplier.disruption\nshipment.delay\nrecovery.status"]]
    INT["Integration processes\n(subscriber, ERP read,\ncorrelation, execution)"]
    AG["Agentstudio agents\nRisk Analyst, Recovery Planning"]
    FLOW["Flow approval app"]
    APIM --> INT
    ES --> INT
    INT --> AG
    INT --> ES
    FLOW -.->|approval| INT
  end

  ERP["Mock ERP (FastAPI)\n/erp/*"]

  BE -->|events, execution requests| APIM
  INT -->|callbacks /internal/*| BE
  INT -->|reads, PATCH with Idempotency-Key| ERP
```

## Data flow for one disruption

```mermaid
sequenceDiagram
  autonumber
  participant U as User / Simulator
  participant D as Django API
  participant G as Boomi API Management
  participant E as Event Streams
  participant P as Boomi processes
  participant R as Mock ERP
  participant A as Agentstudio agents
  participant H as Procurement manager

  U->>D: POST /events/disruptions (or /demo/simulate-disruption)
  D->>D: validate, dedupe on event_id, audit "RECEIVED"
  D->>G: publish event (API key)
  G->>E: topic supplier.disruption
  E->>P: subscriber receives event
  P->>R: GET supplier, open POs, inventory, alternates
  P->>D: POST /internal/risk-cases (ERP snapshot)
  D->>D: impact engine creates RiskCase + affected POs
  P->>A: analyse risk, then plan recovery
  A-->>P: JSON output (schema-validated by Django before storing)
  P->>D: POST /internal/risk-cases/{id}/analysis
  H->>D: review evidence, POST /recommendations/{id}/decision
  D->>G: approved action (only after recorded approval)
  G->>P: execution process
  P->>R: PATCH /erp/purchase-orders/{id} (Idempotency-Key)
  P->>E: topic recovery.status
  P->>D: POST /internal/executions/{id}/result
  D->>D: audit trail entry, RiskCase state via transition()
```

Notes:
- Tenant is taken from the JWT / API key, never from the request body.
- No ERP write happens without a recorded approval.
- RiskCase state changes only through the workflow `transition()` service.
- If Event Streams, Agentstudio, Flow or API Management is unavailable, use the fallbacks in `docs/CONTRACTS.md` section 8.
- The exact hop between Django and the Boomi gateway (publish vs. direct call) follows the U-08/U-09 implementation; confirm this diagram against the final processes. [PLACEHOLDER: verify with Uday]
