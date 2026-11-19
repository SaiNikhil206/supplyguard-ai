"""Deterministic synthetic dataset for SupplyGuard AI (task N-02).

    python data/generate_seed.py                    # as-of 2026-12-02, writes data/seed + data/scenarios
    python data/generate_seed.py --as-of 2026-12-29 # re-anchor all dates for a live demo day

Same seed + same as-of date => byte-identical files. Read by the mock ERP (N-03) and Django
`manage.py load_seed` (U-03). Field names follow docs/CONTRACTS.md sections 1, 3 and 5.

Layout = random "background" data + hand-placed "anchor" records. The anchors make each
scenario (demo, TC-01..TC-09, tenant isolation) produce known numbers, listed in data/README.md
and in each scenario's `expected` block. Random generation never touches anchor suppliers/items.
"""

from __future__ import annotations

import argparse
import json
import random
import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

SEED = 20261119
DEFAULT_AS_OF = date(2026, 12, 2)
EVENT_CLOCK = time(10, 15)  # events happen at 10:15Z on the as-of day
LOCATIONS = ["DC-PUNE", "DC-CHENNAI", "DC-DELHI"]
DATA_DIR = Path(__file__).resolve().parent

TENANTS = [
    {"tenant_id": "TEN-ACME", "tenant_name": "Acme Manufacturing Pvt Ltd", "currency": "INR"},
    {"tenant_id": "TEN-GLOBEX", "tenant_name": "Globex Industrial Inc", "currency": "USD"},
]

# Supplier id ranges (100 total). ACME: 50 primary + 10 alternate-only. GLOBEX: 30 + 10.
ACME_PRIMARY = [f"SUP-{n}" for n in range(1001, 1051)]
ACME_ALTERNATE = [f"SUP-{n}" for n in range(2001, 2011)]
GLOBEX_PRIMARY = [f"SUP-{n}" for n in range(3001, 3031)]
GLOBEX_ALTERNATE = [f"SUP-{n}" for n in range(3031, 3041)]
ACME_ITEMS = [f"ITM-{n}" for n in range(501, 561)]
GLOBEX_ITEMS = [f"ITM-{n}" for n in range(701, 741)]
PO_COUNTS = {"TEN-ACME": 300, "TEN-GLOBEX": 200}
ACTIVE_SHIPMENTS = 20

# Deliberate duplicates for N-12 (Data Hub match on name + tax id): duplicate -> original.
DUPLICATES = {"SUP-1046": "SUP-1011", "SUP-1047": "SUP-1012", "SUP-1048": "SUP-1013"}

# Anchor suppliers / items used by scenarios; random generation skips them.
ANCHOR_SUPPLIERS = {"SUP-1008", "SUP-1015", "SUP-1020", "SUP-1030", "SUP-1040", "SUP-2001", "SUP-2002"}
ANCHOR_NAMES = {"Shakti Components", "Kaveri Polymers", "Trident Castings", "Lotus Packaging", "Zenith Electronics",
                "Apex Precision", "Orion Metals"}
ANCHOR_ITEMS = {"ITM-501", "ITM-502", "ITM-515", "ITM-520", "ITM-521", "ITM-522", "ITM-523", "ITM-530", "ITM-540"}

NAME_A = ["Shakti", "Vardhan", "Nova", "Sterling", "Apex", "Orion", "Kaveri", "Trident", "Zenith", "Bharat",
          "Pioneer", "Summit", "Indus", "Meridian", "Crest", "Atlas", "Sapphire", "Vertex", "Harbor", "Lotus"]
NAME_B = ["Components", "Polymers", "Castings", "Electronics", "Fasteners", "Packaging", "Metals",
          "Precision", "Forgings", "Chemicals", "Textiles", "Bearings"]
NAME_SUFFIX = {"INR": "Pvt Ltd", "USD": "Inc"}
CITIES = {"INR": [("Pune", "IN"), ("Chennai", "IN"), ("Coimbatore", "IN"), ("Ahmedabad", "IN"), ("Ludhiana", "IN")],
          "USD": [("Columbus", "US"), ("Monterrey", "MX"), ("Stuttgart", "DE"), ("Shenzhen", "CN"), ("Austin", "US")]}
ITEM_NOUNS = ["Bracket", "Gear", "Housing", "Valve", "Sensor", "Gasket", "Shaft", "Bearing", "PCB", "Seal",
              "Spring", "Coupling", "Flange", "Rotor", "Bushing"]
CATEGORIES = ["Mechanical", "Electrical", "Packaging", "Raw Material", "Chemical"]
CARRIERS = ["BlueDart Freight", "Delhivery", "Maersk", "DHL Global", "FedEx Freight"]


def money(amount, currency: str) -> dict:
    return {"amount": str(Decimal(amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)), "currency": currency}


def iso_dt(d: date, t: time = EVENT_CLOCK) -> str:
    return datetime.combine(d, t, tzinfo=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class Builder:
    def __init__(self, as_of: date, seed: int = SEED):
        self.as_of = as_of
        self.rng = random.Random(seed)
        self.tenants, self.suppliers, self.pos, self.inventory, self.alternates, self.shipments = [], [], [], [], [], []
        self.items: dict[str, dict] = {}  # item_id -> {name, tenant, base_price}
        self.po_seq = {"TEN-ACME": 1001, "TEN-GLOBEX": 5001}
        self.name_pool: list[str] = []

    # ---------- helpers ----------
    def d(self, offset_days: int) -> str:
        return (self.as_of + timedelta(days=offset_days)).isoformat()

    def uuid4(self) -> str:
        return str(uuid.UUID(int=self.rng.getrandbits(128), version=4))

    def tax_id(self, currency: str) -> str:
        r = self.rng
        if currency == "INR":
            letters = "".join(r.choice("ABCDEFGHJKLMNPQRSTUVWXYZ") for _ in range(5))
            return f"27{letters}{r.randint(1000, 9999)}{r.choice('ABCDEFGH')}1Z{r.randint(1, 9)}"
        return f"{r.randint(10, 99)}-{r.randint(1000000, 9999999)}"

    def next_po_id(self, tenant_id: str) -> str:
        po_id = f"PO-{self.po_seq[tenant_id]}"
        self.po_seq[tenant_id] += 1
        return po_id

    # ---------- tenants ----------
    def build_tenants(self):
        for t in TENANTS:
            self.tenants.append({
                **t,
                "status": "ACTIVE",
                "created_at": "2026-11-01T00:00:00Z",
                "locations": LOCATIONS,
                "settings": {
                    "risk_thresholds": {"medium": 40, "high": 65, "critical": 85},
                    "max_cost_increase_pct": 15,
                    "require_qualified_alternates": True,
                },
            })

    # ---------- items ----------
    def build_items(self):
        for tenant_id, ids in (("TEN-ACME", ACME_ITEMS), ("TEN-GLOBEX", GLOBEX_ITEMS)):
            for item_id in ids:
                noun = self.rng.choice(ITEM_NOUNS)
                self.items[item_id] = {
                    "tenant_id": tenant_id,
                    "name": f"{noun} {item_id.split('-')[1]}",
                    "base_price": Decimal(self.rng.randint(2000, 50000)) / 100,
                }
        # Anchor prices (demo cost delta = (84.00 - 75.60) * 4000 = 33600.00, as in CONTRACTS s6)
        self.items["ITM-501"].update(name="Bracket 501", base_price=Decimal("75.60"))
        self.items["ITM-502"].update(name="Housing 502", base_price=Decimal("120.00"))

    # ---------- suppliers ----------
    def supplier(self, supplier_id, tenant_id, currency, *, name=None, tax_id=None, capacity="random", **extra):
        r = self.rng
        city, country = r.choice(CITIES[currency])
        on_time = round(r.uniform(78, 99), 1)
        quality = round(r.uniform(3.2, 5.0), 1)
        disruptions = r.choice([0, 0, 0, 1, 1, 2, 3])
        history = [
            {"date": self.d(-r.randint(20, 360)), "event_type": r.choice(["SHIPMENT_DELAY", "QUALITY_HOLD", "CAPACITY_REDUCTION"]),
             "delay_days": r.randint(1, 7)}
            for _ in range(disruptions)
        ]
        history.sort(key=lambda h: h["date"])
        score = (100 - on_time) * 2 + (5 - quality) * 10 + disruptions * 8
        rec = {
            "supplier_id": supplier_id,
            "tenant_id": tenant_id,
            "name": name or f"{self.name_pool.pop()} {NAME_SUFFIX[currency]}",
            "tax_id": tax_id or self.tax_id(currency),
            "category": r.choice(CATEGORIES),
            "city": city,
            "country": country,
            "status": "ACTIVE",
            "risk_level": "HIGH" if score >= 45 else "MEDIUM" if score >= 25 else "LOW",
            "on_time_delivery_pct": on_time,
            "quality_score": quality,
            "capacity_per_week": r.choice([None, r.randint(1000, 20000)]) if capacity == "random" else capacity,
            "contact_email": f"orders@{supplier_id.lower()}.example.com",
            "disruption_history": history,
        }
        rec.update(extra)
        self.suppliers.append(rec)
        return rec

    def build_suppliers(self):
        # Unique base names (no accidental duplicates besides the 3 deliberate ones in DUPLICATES).
        self.name_pool = sorted(f"{a} {b}" for a in NAME_A for b in NAME_B if f"{a} {b}" not in ANCHOR_NAMES)
        self.rng.shuffle(self.name_pool)
        anchors = {
            "SUP-1008": dict(name="Shakti Components Pvt Ltd", capacity=None, city="Pune", country="IN", risk_level="MEDIUM"),
            "SUP-1015": dict(name="Kaveri Polymers Pvt Ltd", capacity=8000),
            "SUP-1020": dict(name="Trident Castings Pvt Ltd", capacity=12000),
            "SUP-1030": dict(name="Lotus Packaging Pvt Ltd", capacity=15000),
            "SUP-1040": dict(name="Zenith Electronics Pvt Ltd", capacity=None),
            "SUP-2001": dict(name="Apex Precision Pvt Ltd", capacity=5000, risk_level="LOW"),
            "SUP-2002": dict(name="Orion Metals Pvt Ltd", capacity=None, risk_level="LOW"),
        }
        for tenant_id, currency, ids in (("TEN-ACME", "INR", ACME_PRIMARY + ACME_ALTERNATE),
                                         ("TEN-GLOBEX", "USD", GLOBEX_PRIMARY + GLOBEX_ALTERNATE)):
            for sid in ids:
                if sid in DUPLICATES:
                    continue
                self.supplier(sid, tenant_id, currency, **anchors.get(sid, {}))
        by_id = {s["supplier_id"]: s for s in self.suppliers}
        variants = [lambda n: n.replace("Pvt Ltd", "Private Limited"), lambda n: n.upper(), lambda n: n.replace(" ", "  ", 1) + "."]
        for (dup_id, orig_id), variant in zip(DUPLICATES.items(), variants):
            orig = by_id[orig_id]
            self.suppliers.append({**json.loads(json.dumps(orig)), "supplier_id": dup_id, "name": variant(orig["name"]),
                                   "contact_email": f"orders@{dup_id.lower()}.example.com", "disruption_history": []})
        self.suppliers.sort(key=lambda s: s["supplier_id"])

    # ---------- purchase orders ----------
    def po(self, tenant_id, supplier_id, currency, lines, *, status="OPEN", order_offset=-30, po_id=None):
        po_lines = []
        for n, (item_id, qty, due_offset, unit_price) in enumerate(lines, start=1):
            po_lines.append({
                "line_no": n,
                "item_id": item_id,
                "item_name": self.items[item_id]["name"],
                "qty": qty,
                "due_date": self.d(due_offset),
                "unit_price": money(unit_price, currency),
            })
        total = sum(Decimal(l["unit_price"]["amount"]) * l["qty"] for l in po_lines)
        rec = {
            "po_id": po_id or self.next_po_id(tenant_id),
            "tenant_id": tenant_id,
            "supplier_id": supplier_id,
            "order_date": self.d(order_offset),
            "expected_date": max(l["due_date"] for l in po_lines),
            "status": status,
            "amount": money(total, currency),
            "lines": po_lines,
        }
        self.pos.append(rec)
        return rec

    def build_anchor_pos(self):
        A, INR = "TEN-ACME", "INR"
        p = lambda i: self.items[i]["base_price"]
        # Demo: SUP-1008 factory outage 48 h. 3 OPEN POs evaluated, 2 due before the outage ends.
        self.po(A, "SUP-1008", INR, [("ITM-501", 4000, 1, p("ITM-501"))])                       # PO-1001 affected
        self.po(A, "SUP-1008", INR, [("ITM-501", 2500, 2, p("ITM-501"))])                       # PO-1002 affected
        self.po(A, "SUP-1008", INR, [("ITM-502", 1500, 18, p("ITM-502"))])                      # PO-1003 not affected
        self.po(A, "SUP-1008", INR, [("ITM-501", 3000, -10, p("ITM-501"))], status="RECEIVED", order_offset=-45)  # PO-1004
        # TC-01: SUP-1015 quality hold 24 h, one open PO due tomorrow.
        self.po(A, "SUP-1015", INR, [("ITM-515", 800, 1, p("ITM-515"))])                        # PO-1005
        self.po(A, "SUP-1015", INR, [("ITM-515", 600, -20, p("ITM-515"))], status="RECEIVED", order_offset=-50)  # PO-1006
        # TC-03: SUP-1020 outage 72 h, 6 OPEN POs (5 due within 3 days, 1 later).
        for item, qty, due in (("ITM-520", 500, 1), ("ITM-521", 300, 1), ("ITM-522", 700, 2), ("ITM-523", 450, 2), ("ITM-520", 250, 3)):
            self.po(A, "SUP-1020", INR, [(item, qty, due, p(item))])                             # PO-1007..PO-1011
        self.po(A, "SUP-1020", INR, [("ITM-521", 900, 25, p("ITM-521"))])                       # PO-1012 not affected
        # TC-04: SUP-1030 outage 72 h, 2 OPEN POs; ITM-530 stock covers ~45 days -> no shortage.
        self.po(A, "SUP-1030", INR, [("ITM-530", 2000, 1, p("ITM-530"))])                       # PO-1013
        self.po(A, "SUP-1030", INR, [("ITM-530", 1500, 2, p("ITM-530"))])                       # PO-1014
        # TC-05: SUP-1040 outage 96 h, ITM-540 has no alternates and no stock elsewhere.
        self.po(A, "SUP-1040", INR, [("ITM-540", 1200, 1, p("ITM-540"))])                       # PO-1015

    def build_random_pos(self):
        r = self.rng
        for tenant_id, currency, suppliers, items in (
            ("TEN-ACME", "INR", ACME_PRIMARY, ACME_ITEMS),
            ("TEN-GLOBEX", "USD", GLOBEX_PRIMARY, GLOBEX_ITEMS),
        ):
            sups = [s for s in suppliers if s not in ANCHOR_SUPPLIERS and s not in DUPLICATES]
            free_items = [i for i in items if i not in ANCHOR_ITEMS]
            catalog = {s: r.sample(free_items, 3) for s in sups}  # each supplier sells 3 items
            while sum(1 for p in self.pos if p["tenant_id"] == tenant_id) < PO_COUNTS[tenant_id]:
                sid = r.choice(sups)
                due = r.randint(-60, 60)
                lines = []
                for item in r.sample(catalog[sid], r.choice([1, 1, 1, 2, 2, 3])):
                    price = self.items[item]["base_price"] * Decimal(str(round(r.uniform(0.92, 1.08), 3)))
                    lines.append((item, r.randrange(50, 5000, 50), due + r.randint(0, 5), price))
                if due < 0:
                    status = r.choices(["RECEIVED", "OPEN", "CANCELLED"], weights=[80, 15, 5])[0]
                else:
                    status = r.choices(["OPEN", "CANCELLED"], weights=[95, 5])[0]
                self.po(tenant_id, sid, currency, lines, status=status, order_offset=due - r.randint(20, 60))
        self.pos.sort(key=lambda p: int(p["po_id"].split("-")[1]))

    # ---------- inventory ----------
    def inv(self, tenant_id, item_id, location_id, on_hand, reserved, safety_stock, daily_demand):
        self.inventory.append({
            "tenant_id": tenant_id,
            "item_id": item_id,
            "item_name": self.items[item_id]["name"],
            "location_id": location_id,
            "on_hand": on_hand,
            "reserved": reserved,
            "safety_stock": safety_stock,
            "daily_demand": daily_demand,
        })

    def build_inventory(self):
        A = "TEN-ACME"
        # Demo ITM-501: Pune available (on_hand - reserved) = 900 / 600 per day = 1.5 days < 2-day outage.
        self.inv(A, "ITM-501", "DC-PUNE", 1100, 200, 300, 600)
        self.inv(A, "ITM-501", "DC-CHENNAI", 800, 100, 200, 150)  # transfer candidate
        self.inv(A, "ITM-502", "DC-PUNE", 2000, 300, 400, 100)
        self.inv(A, "ITM-515", "DC-PUNE", 250, 50, 50, 250)        # 0.8 days < 1-day hold
        for item in ("ITM-520", "ITM-521", "ITM-522", "ITM-523"):
            self.inv(A, item, "DC-DELHI", 400, 100, 100, 150)
        self.inv(A, "ITM-530", "DC-PUNE", 20000, 1000, 2000, 400)  # 19000 / 400 = 47.5 days
        self.inv(A, "ITM-540", "DC-PUNE", 150, 100, 0, 100)        # 0.5 days, only location
        r = self.rng
        for item_id, item in self.items.items():
            if item_id in ANCHOR_ITEMS:
                continue
            for loc in sorted(r.sample(LOCATIONS, r.randint(1, 3))):
                demand = r.randint(20, 500)
                on_hand = demand * r.randint(2, 40)
                self.inv(item["tenant_id"], item_id, loc, on_hand, r.randint(0, on_hand // 4), demand * r.randint(1, 5), demand)
        self.inventory.sort(key=lambda i: (i["tenant_id"], i["item_id"], i["location_id"]))

    # ---------- alternate suppliers ----------
    def alt(self, tenant_id, item_id, supplier_id, lead, price, capacity, qualified=True):
        currency = "INR" if tenant_id == "TEN-ACME" else "USD"
        self.alternates.append({
            "tenant_id": tenant_id,
            "item_id": item_id,
            "supplier_id": supplier_id,
            "qualified": qualified,
            "lead_time_days": lead,
            "unit_price": money(price, currency),
            "capacity": capacity,  # units per week; null = unknown (agents must report as missing data)
        })

    def build_alternates(self):
        A = "TEN-ACME"
        self.alt(A, "ITM-501", "SUP-2001", 2, "84.00", 5000)
        self.alt(A, "ITM-501", "SUP-2002", 5, "79.50", None)
        self.alt(A, "ITM-515", "SUP-2003", 3, self.items["ITM-515"]["base_price"] * Decimal("1.06"), 2000)
        for item in ("ITM-520", "ITM-521", "ITM-522", "ITM-523"):
            self.alt(A, item, "SUP-2004", 4, self.items[item]["base_price"] * Decimal("1.10"), 4000)
        self.alt(A, "ITM-530", "SUP-2005", 6, self.items["ITM-530"]["base_price"] * Decimal("1.04"), 6000)
        # ITM-540: intentionally none (TC-05).
        r = self.rng
        pools = {"TEN-ACME": [s for s in ACME_ALTERNATE if s not in ANCHOR_SUPPLIERS], "TEN-GLOBEX": GLOBEX_ALTERNATE}
        for item_id, item in self.items.items():
            if item_id in ANCHOR_ITEMS:
                continue
            for sid in r.sample(pools[item["tenant_id"]], r.choice([0, 1, 1, 2])):
                self.alt(item["tenant_id"], item_id, sid, r.randint(2, 14),
                         item["base_price"] * Decimal(str(round(r.uniform(0.95, 1.25), 3))),
                         r.choice([None, r.randint(500, 10000)]), qualified=r.random() > 0.15)
        self.alternates.sort(key=lambda a: (a["tenant_id"], a["item_id"], a["supplier_id"]))

    # ---------- shipments ----------
    def build_shipments(self):
        r = self.rng
        candidates = [p for p in self.pos if p["status"] == "OPEN" and p["supplier_id"] not in ANCHOR_SUPPLIERS
                      and p["expected_date"] > self.as_of.isoformat()]
        for n, po in enumerate(sorted(r.sample(candidates, ACTIVE_SHIPMENTS), key=lambda p: p["po_id"]), start=1):
            sup = next(s for s in self.suppliers if s["supplier_id"] == po["supplier_id"])
            self.shipments.append({
                "shipment_id": f"SHP-{n:05d}",
                "tenant_id": po["tenant_id"],
                "po_id": po["po_id"],
                "supplier_id": po["supplier_id"],
                "carrier": r.choice(CARRIERS),
                "status": "IN_TRANSIT",
                "origin": sup["city"],
                "destination_location_id": r.choice(LOCATIONS),
                "departed_at": iso_dt(self.as_of - timedelta(days=r.randint(1, 6)), time(r.randint(0, 23), 0)),
                "eta": po["expected_date"],
            })

    # ---------- scenarios ----------
    def event(self, event_id, supplier_id, event_type, severity, hours, description, tenant_id="TEN-ACME", **extra):
        return {
            "event_id": event_id,
            "tenant_id": tenant_id,
            "supplier_id": supplier_id,
            "event_type": event_type,
            "severity": severity,
            "event_time": iso_dt(self.as_of),
            "expected_duration_hours": hours,
            "description": description,
            "source_system": "supplier-portal",
            "correlation_id": self.uuid4(),
            **extra,
        }

    def impact(self, ev):
        """Reference numbers for the scenario `expected` block.

        Rule (N-04 must reproduce): a PO is evaluated if it is OPEN and from the event supplier; it is
        affected if any line's due_date is on or before the date the disruption ends
        (event_time + expected_duration_hours). Exposure = sum(qty * unit_price) of affected lines.
        """
        end = datetime.strptime(ev["event_time"], "%Y-%m-%dT%H:%M:%SZ") + timedelta(hours=ev["expected_duration_hours"])
        open_pos = [p for p in self.pos if p["tenant_id"] == ev["tenant_id"] and p["supplier_id"] == ev["supplier_id"]
                    and p["status"] == "OPEN"]
        affected, exposure, items = [], Decimal("0"), set()
        for p in open_pos:
            lines = [l for l in p["lines"] if l["due_date"] <= end.date().isoformat()]
            if lines:
                affected.append(p["po_id"])
                for l in lines:
                    exposure += Decimal(l["unit_price"]["amount"]) * l["qty"]
                    items.add(l["item_id"])
        currency = next(t["currency"] for t in TENANTS if t["tenant_id"] == ev["tenant_id"])
        alts = sorted({a["supplier_id"] for a in self.alternates
                       if a["tenant_id"] == ev["tenant_id"] and a["item_id"] in items and a["qualified"]})
        return {
            "supplier_found": any(s["supplier_id"] == ev["supplier_id"] and s["tenant_id"] == ev["tenant_id"] for s in self.suppliers),
            "evaluated_po_ids": sorted(p["po_id"] for p in open_pos),
            "affected_po_ids": sorted(affected),
            "exposure": money(exposure, currency),
            "affected_item_ids": sorted(items),
            "qualified_alternate_supplier_ids": alts,
        }

    def scenarios(self) -> dict[str, dict]:
        out = {}

        def add(name, test_case, description, ev, expected_extra, **runner):
            exp = self.impact(ev)
            exp.update(expected_extra)
            out[name] = {"scenario": name, "test_case": test_case, "description": description,
                         "as_of": self.as_of.isoformat(), "event": ev, **runner, "expected": exp}

        demo_desc = "Line 2 fire, production halted"
        add("demo", "DEMO", "Live demo: SUP-1008 factory outage for 48 h hits 2 open ITM-501 POs; 2 qualified alternates.",
            self.event("EVT-000123", "SUP-1008", "FACTORY_OUTAGE", "HIGH", 48, demo_desc),
            {"shortage_expected": True, "viable_option_expected": True})
        add("tc01_valid_event", "TC-01", "Valid event is accepted, correlated to SUP-1015 and a risk case is created.",
            self.event("EVT-000901", "SUP-1015", "QUALITY_HOLD", "MEDIUM", 24, "Batch failed incoming QC, shipments on hold"),
            {"risk_case_expected": True, "shortage_expected": True})
        add("tc02_unknown_supplier", "TC-02", "Unknown supplier: flagged for data correction, no impact generated.",
            self.event("EVT-000902", "SUP-9999", "FACTORY_OUTAGE", "HIGH", 48, "Supplier not in master data"),
            {"risk_case_expected": False, "data_correction_flag_expected": True})
        add("tc03_multiple_open_pos", "TC-03", "SUP-1020 has 6 open POs; all evaluated, 5 affected.",
            self.event("EVT-000903", "SUP-1020", "FACTORY_OUTAGE", "CRITICAL", 72, "Furnace failure, casting line down"),
            {"risk_case_expected": True})
        add("tc04_inventory_sufficient", "TC-04", "ITM-530 stock covers ~47 days, longer than the 3-day outage: no shortage.",
            self.event("EVT-000904", "SUP-1030", "FACTORY_OUTAGE", "HIGH", 72, "Power outage at plant"),
            {"shortage_expected": False})
        add("tc05_no_alternates", "TC-05",
            "ITM-540 has no alternate supplier, no stock at other locations and SUP-1040 capacity is unknown: "
            "the agent must state that no validated alternative can be recommended.",
            self.event("EVT-000905", "SUP-1040", "FACTORY_OUTAGE", "HIGH", 96, "Clean-room contamination, production halted"),
            {"shortage_expected": True, "no_validated_alternative_expected": True,
             "unsupported_option_types": ["ALTERNATE_SUPPLIER", "INVENTORY_TRANSFER", "SPLIT_ORDER"]})
        add("tc06_reject", "TC-06", "Demo data; approver REJECTS: no ERP write, comments audited.",
            self.event("EVT-000906", "SUP-1008", "FACTORY_OUTAGE", "HIGH", 48, demo_desc),
            {"erp_write_expected": False}, decision={"decision": "REJECT", "comments": "Cost too high, wait for supplier update"})
        add("tc07_approve", "TC-07", "Demo data; approver APPROVES rank 1: Boomi executes, ERP response captured.",
            self.event("EVT-000907", "SUP-1008", "FACTORY_OUTAGE", "HIGH", 48, demo_desc),
            {"erp_write_expected": True}, decision={"decision": "APPROVE", "comments": "Go with alternate supplier"})
        add("tc08_erp_timeout", "TC-08", "Approve while mock ERP PATCH times out: execution failed/pending, retry is idempotent.",
            self.event("EVT-000908", "SUP-1008", "FACTORY_OUTAGE", "HIGH", 48, demo_desc),
            {"erp_write_expected": False, "execution_status_expected": "EXECUTION_FAILED"},
            decision={"decision": "APPROVE", "comments": "Approve"}, chaos_mode="timeout")
        add("tc09_duplicate_event", "TC-09", "Same event sent twice: one risk case, no repeated execution.",
            self.event("EVT-000909", "SUP-1015", "QUALITY_HOLD", "MEDIUM", 24, "Duplicate delivery of the same feed message"),
            {"risk_cases_created": 1}, send_times=2)
        add("tenant_isolation", "AC-08", "ACME credential sends an event naming a GLOBEX supplier: rejected, nothing created.",
            self.event("EVT-000910", "SUP-3005", "FACTORY_OUTAGE", "HIGH", 48, "Cross-tenant probe"),
            {"risk_case_expected": False})
        return out

    def build(self):
        self.build_tenants()
        self.build_items()
        self.build_suppliers()
        self.build_anchor_pos()
        self.build_random_pos()
        self.build_inventory()
        self.build_alternates()
        self.build_shipments()
        return self


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def generate(out_dir: Path = DATA_DIR, as_of: date = DEFAULT_AS_OF, seed: int = SEED) -> Builder:
    b = Builder(as_of, seed).build()
    seed_dir = out_dir / "seed"
    for name, rows in (("tenants", b.tenants), ("suppliers", b.suppliers), ("purchase_orders", b.pos),
                       ("inventory", b.inventory), ("alternate_suppliers", b.alternates), ("shipments", b.shipments)):
        write_json(seed_dir / f"{name}.json", rows)
    write_json(seed_dir / "manifest.json", {
        "as_of": as_of.isoformat(), "seed": seed, "generator": "data/generate_seed.py",
        "counts": {"tenants": len(b.tenants), "suppliers": len(b.suppliers), "purchase_orders": len(b.pos),
                   "inventory": len(b.inventory), "alternate_suppliers": len(b.alternates), "shipments": len(b.shipments)},
        "duplicate_suppliers": DUPLICATES,
    })
    for name, sc in b.scenarios().items():
        write_json(out_dir / "scenarios" / f"{name}.json", sc)
    return b


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--as-of", type=date.fromisoformat, default=DEFAULT_AS_OF, help="anchor date (YYYY-MM-DD)")
    ap.add_argument("--out", type=Path, default=DATA_DIR, help="output dir (seed/ and scenarios/ are created inside)")
    args = ap.parse_args()
    if args.as_of != DEFAULT_AS_OF and args.out == DATA_DIR:
        ap.error("--as-of other than the default needs --out <dir>; the committed data/ stays anchored on "
                 f"{DEFAULT_AS_OF} (tests compare against it)")
    b = generate(args.out, args.as_of)
    print(f"as_of={args.as_of} suppliers={len(b.suppliers)} pos={len(b.pos)} inventory={len(b.inventory)} "
          f"alternates={len(b.alternates)} shipments={len(b.shipments)} -> {args.out}")


if __name__ == "__main__":
    main()
