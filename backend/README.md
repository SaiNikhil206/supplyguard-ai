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
- `apps.core.handlers` gives `/api/` paths the JSON 400/403/404/500 error body. With `DEBUG=True` Django's own technical 404/500 pages win, so the frontend sees HTML there in development.
- Redaction is by key name (separators ignored: `X-Api-Key`, `api_key` and `apiKey` all match password/secret/token/authorization/cookie/credential/apikey/privatekey/jwt/bearer/signature/session, plus the exact keys access/refresh/key) and by values starting with `Bearer ` or `Basic `. Numbers, booleans and null stay visible (`prompt_tokens: 12`). Callers must never put raw credentials in values under other keys.
- `record()` raises `ValueError` when the explicit tenant, the entity's tenant and the actor's tenant disagree, or when a field exceeds its column length.
- Log lines carry the id, including Django's 4xx/5xx `django.request` lines (taken from the request, since they are logged after the middleware ends). The dev server's own access lines (`django.server`) cannot carry it; gunicorn access logs get it from the response header in U-12.

## Authentication
- `POST /api/v1/auth/token` `{username, password}` -> `{access, refresh}`. Access-token claims: `user_id`, `tenant_id`, `role`. Inactive users, users without a tenant (superusers included) and users of a non-ACTIVE tenant get the same generic 401 as a wrong password.
- `POST /api/v1/auth/refresh` `{refresh}` -> `{access}` (no rotation, no blacklist). The user, tenant and role are re-read from the database, so a role change shows in the next access token and a deactivated user cannot refresh.
- The database is the source of truth: `TenantJWTAuthentication` returns 401 when the token's `tenant_id`/`role` differ from the user's current values. `request.tenant` is set only from the credential (user's tenant or the API key's tenant); use `getattr(request, "tenant", None)`.
- `GET /api/v1/me` -> `{id, email, name, role, tenant: {id, name}}` for real users of an active tenant (403 for SYSTEM and tenant-less superusers).
- SYSTEM callers (Boomi): `python manage.py create_api_key --tenant TEN-ACME --label boomi` prints the key ONCE (`sgk_` + 40 chars); only its sha256 hash and 8-char prefix are stored. Send it as `X-Api-Key`. Rejected keys write `security.api_key_rejected` audit rows (prefix only). Disable a key with `is_active` in the admin.
- Login and refresh are throttled per client IP with `AUTH_THROTTLE_RATE` (default `10/min`). The counter lives in each process's local cache, so every gunicorn worker counts separately (effective limit is rate x workers).
