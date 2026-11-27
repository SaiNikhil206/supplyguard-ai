"""Offline demo path: no Boomi configured -> build the ERP snapshot from the seed files and create
the case here, exactly as Boomi's `POST /internal/risk-cases` callback would (N-09).

Opt-in: OFFLINE_CORRELATION=1 (off by default, so Boomi's own callback test flows keep working).
Needs AGENT_BACKEND=mock or claude (a Boomi agent backend implies Boomi is reachable). With a
configured Boomi the event is published and Boomi calls back, so this never runs.
"""

import json
import logging
from datetime import UTC, datetime
from pathlib import Path

from django.conf import settings

from .config import conf_bool

logger = logging.getLogger(__name__)


def _seed(name: str) -> list:
    folder = Path(getattr(settings, "SEED_DATA_DIR", ""))
    return json.loads((folder / f"{name}.json").read_text(encoding="utf-8"))


def build_snapshot(tenant_id: str, supplier_id: str) -> dict | None:
    """The snapshot Boomi would send (CONTRACTS s5), read from the seed; None = unknown supplier."""
    supplier = next(
        (
            s
            for s in _seed("suppliers")
            if s["tenant_id"] == tenant_id and s["supplier_id"] == supplier_id
        ),
        None,
    )
    if supplier is None:
        return None
    pos = [
        p
        for p in _seed("purchase_orders")
        if p["tenant_id"] == tenant_id and p["supplier_id"] == supplier_id and p["status"] == "OPEN"
    ]
    items = {line["item_id"] for p in pos for line in p["lines"]}
    return {
        "captured_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "supplier": supplier,
        "purchase_orders": pos,
        "inventory": [
            i for i in _seed("inventory") if i["tenant_id"] == tenant_id and i["item_id"] in items
        ],
        "alternate_suppliers": [
            a
            for a in _seed("alternate_suppliers")
            if a["tenant_id"] == tenant_id and a["item_id"] in items
        ],
    }


def enabled() -> bool:
    return conf_bool("OFFLINE_CORRELATION", False)


def correlate_offline(tenant, actor, event) -> None:
    """Never raises: a failure is logged and the event simply stays RECEIVED."""
    if not enabled() or event.supplier_id is None:
        return
    try:
        from apps.integrations.risk_cases import create_risk_case_from_snapshot

        snapshot = build_snapshot(tenant.id, event.supplier_erp_id)
        if snapshot is not None:
            create_risk_case_from_snapshot(tenant, event.event_id, snapshot, actor="SYSTEM")
    except Exception:
        logger.exception("offline correlation failed for %s", event.event_id)
