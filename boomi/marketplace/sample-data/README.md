# Sample data

The package does not copy data. The synthetic dataset is owned by Nikhil and lives in the repository:

| Location | Contents |
|---|---|
| `data/seed/` | ERP tables: tenants, suppliers, purchase orders, inventory, alternate suppliers, shipments, manifest |
| `data/scenarios/` | One canonical disruption event per test case (`tc01_valid_event.json` ... `tc09_duplicate_event.json`, `tenant_isolation.json`) and `demo.json` |
| `data/README.md` | Field descriptions and the impact rule behind the expected numbers |

All figures are synthetic and illustrative.

## Load it

1. Mock ERP (reads `data/seed/` on start; every restart or `POST /erp/_reset` returns to the seed state):
   ```
   docker compose up -d mock-erp
   ```
   or `cd mock-erp && uvicorn app.main:app --port 8081`. Check `http://localhost:8081/docs`.
2. Django database: run the seed loader named in `docs/INSTALL.md` (the planned command is `python manage.py load_seed`). [PLACEHOLDER: confirm the command with Uday, U-03]
3. Dates in the committed seed are anchored on 2026-12-02. To re-anchor for a live demo day:
   ```
   python data/generate_seed.py --as-of <YYYY-MM-DD> --out <output-dir>
   ```
   and point `MOCK_ERP_DATA_DIR` and the Django loader at that folder. Replay scenarios with their own `event_time`, otherwise the expected affected-PO sets do not hold.
4. Send a scenario: use `POST /api/v1/demo/simulate-disruption` as an ADMIN user (scenario name from `data/scenarios/`), or POST a scenario's `event` to `/api/v1/events/disruptions` with the system API key.
