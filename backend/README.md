# backend/ - Django REST API

Scaffolded by **U-02** (Uday). Ownership inside this folder:
| Path | Owner |
|---|---|
| project settings, `apps/tenants`, `apps/accounts`, `apps/core`, `apps/audit`, `apps/integrations` | Uday |
| `apps/intelligence`, `apps/workflow` | Nikhil |
| `apps/portal` (read APIs for the UI screens) | Roop |

Contracts: `docs/CONTRACTS.md` section 4. Run (after U-01): `docker compose up backend db`.

## Seed data
`python manage.py load_seed [--data-dir PATH] [--demo-users]` loads `data/seed/` (tenants, suppliers,
purchase orders + lines, inventory, shipments) in one transaction. It is idempotent: run it again and
it reports 0 created / 0 updated. In Docker the compose file mounts `./data` read-only at `/data`, so the default seed folder resolves; run `docker compose exec backend python manage.py load_seed`. Any validation failure aborts everything with a `CommandError`
naming the file, the record id and the rule.
- `--data-dir PATH` loads another seed folder (e.g. one made with `data/generate_seed.py --as-of ... --out ...`);
  records are updated in place. Default comes from `SEED_DATA_DIR` (settings), else `<repo>/data/seed`.
- `--demo-users` also creates `<tenant>.admin`, `<tenant>.procurement`, `<tenant>.viewer` per tenant
  (e.g. `acme.admin`). The password comes only from the env var `DEMO_USER_PASSWORD` (must pass Django
  password validation, is never printed, existing users keep their password). Without the flag no users are created.

## Correlation id and audit
- `CorrelationIdMiddleware` (first in `MIDDLEWARE`) reads `X-Correlation-ID`; a valid UUID is kept (lowercased), anything else is replaced by a new v4. The id is on `request.correlation_id`, in a ContextVar (`apps.audit.context.get_correlation_id()`), in every log line (`[%(correlation_id)s]`) and on every response, errors included.
- `from apps.audit import record`; `record(actor, action, entity=None, correlation_id=None, data=None, tenant=None)` appends an `AuditEvent`. `actor` is a `User` (stored as `USR-<n>`), `'SYSTEM'` or a string; `entity` is a model instance or a `(type, id)` tuple; tenant defaults to the entity's, then the actor's; the correlation id defaults to the current request's. `data` must be JSON-safe; keys such as password/token/secret/api_key/authorization/cookie are stored as `[REDACTED]`.
- `GET /api/v1/audit?entity_type=&action=&correlation_id=&from=&to=` is read-only and scoped to the authenticated user's tenant (never taken from the query).
- `apps.core.handlers` gives `/api/` paths the JSON 404/500 error body.
