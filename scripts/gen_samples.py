#!/usr/bin/env python3
"""Generate the committed sample datasets under data/samples.

Deterministic (fixed seed). The observations are SYNTHETIC but anchored to price
levels reported publicly in August/September 2026 (founder notes):
  H100 neo-cloud ~$2.6-2.9/GPU-h, marketplaces ~$1.4-2.3, AWS p5 on-demand $1.376,
  other hyperscalers list ~$6-11, B200 ~$4.0-4.5, H200 ~$3.2-3.6, A100-80 ~$1.1-1.5,
  RTX 5090 ~$0.5-0.8. Power hubs: PJM Dominion ~$110/MWh, ERCOT West ~$45, ERCOT North
  ~$60, MISO North ~$38. Re-run with `python3 scripts/gen_samples.py`.
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
import random
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "data" / "samples"
SEED = 20260925
START = date(2026, 9, 1)
DAYS = 25

PROVIDERS = [
    # name, tier, regions, gpus, level multiplier vs neo-cloud base, listing kind, interconnect
    ("aws", "hyperscaler", ["us_east", "us_west", "eu_west"], ["h100", "h200", "a100_80"], 0.53, "list", "sxm"),
    ("azure", "hyperscaler", ["us_east", "eu_west", "apac"], ["h100", "h200", "b200"], 2.6, "list", "sxm"),
    ("gcp", "hyperscaler", ["us_central", "eu_west", "apac"], ["h100", "b200", "a100_80"], 3.1, "list", "sxm"),
    ("oci", "hyperscaler", ["us_east", "eu_central"], ["h100", "h200"], 1.9, "list", "sxm"),
    ("coreweave", "neo_cloud", ["us_east", "us_central"], ["h100", "h200", "b200"], 1.10, "list", "sxm"),
    ("lambda", "neo_cloud", ["us_west", "us_east"], ["h100", "b200", "a100_80"], 1.05, "list", "sxm"),
    ("crusoe", "neo_cloud", ["us_central", "us_west"], ["h100", "b200"], 1.02, "list", "sxm"),
    ("nebius", "neo_cloud", ["eu_west", "eu_central", "us_east"], ["h100", "h200", "b200"], 1.00, "list", "sxm"),
    ("together", "neo_cloud", ["us_east"], ["h100", "b200"], 1.08, "list", "sxm"),
    ("fluidstack", "neo_cloud", ["us_east", "eu_west"], ["h100", "h200"], 0.98, "transaction", "sxm"),
    ("voltage_park", "neo_cloud", ["us_west", "us_central"], ["h100"], 0.92, "transaction", "sxm"),
    ("sfcompute", "marketplace", ["us_east", "us_west"], ["h100", "b200"], 0.78, "transaction", "sxm"),
    ("vast", "marketplace", ["us_east", "us_west", "eu_central", "apac", "other"], ["h100", "a100_80", "rtx5090"], 0.70, "list", "pcie"),
    ("runpod", "marketplace", ["us_east", "eu_west", "apac"], ["h100", "a100_80", "rtx5090"], 0.80, "list", "sxm"),
    ("akash", "marketplace", ["other", "us_west"], ["h100", "a100_80", "rtx5090"], 0.55, "list", "pcie"),
    ("compute_exchange", "marketplace", ["us_east"], ["h100", "b200"], 0.85, "transaction", "sxm"),
    ("shadeform", "marketplace", ["us_east", "eu_west"], ["h100", "b200", "h200"], 0.95, "list", "sxm"),
    ("equinix_colo", "colo", ["us_east", "eu_west"], ["h100"], 1.06, "transaction", "sxm"),
    ("digital_realty", "colo", ["us_east", "us_central"], ["h100", "h200"], 1.04, "transaction", "sxm"),
    ("applied_digital", "colo", ["us_central"], ["h100", "b200"], 0.97, "transaction", "sxm"),
    ("private_broker_a", "private", ["us_east"], ["h100", "b200"], 0.93, "transaction", "sxm"),
    ("private_broker_b", "private", ["eu_central", "us_west"], ["h100", "h200"], 0.96, "transaction", "sxm"),
    ("private_broker_c", "private", ["apac"], ["h100"], 1.01, "transaction", "sxm"),
    ("nscale", "neo_cloud", ["eu_west"], ["h100", "b200"], 1.03, "list", "sxm"),
]

BASE = {"h100": 2.70, "h200": 3.40, "b200": 4.25, "a100_80": 1.30, "rtx5090": 0.65}
TERM_RATIO = {"1": 0.92, "3": 0.87, "6": 0.82, "12": 0.75, "36": 0.65}
REGION_ADJ = {"us_east": 0.0, "us_central": -0.02, "us_west": 0.02, "eu_west": 0.06, "eu_central": 0.05, "apac": 0.08, "other": 0.05}
HUBS = {"pjm_dominion": (110.0, 333.44), "ercot_west": (45.0, 0.0), "ercot_north": (60.0, 0.0), "miso_north": (38.0, 30.0)}
INDICES = [("sdh100rt", "h100", "cme"), ("sdb200rt", "b200", "cme"), ("ocpi_h100", "h100", "ice"), ("ocpi_b200", "b200", "ice")]
TENORS = ["2026-10", "2026-11", "2026-12", "2027-01"]


def obs_id(source: str, provider: str, raw_ref: str, ts: datetime) -> str:
    h = hashlib.sha256()
    h.update(f"{source}|{provider}|{raw_ref}|{int(ts.timestamp())}".encode())
    return h.hexdigest()[:16]


def latent(rng: random.Random) -> dict[str, list[float]]:
    """Daily latent log-price paths per GPU class (mild mean reversion + noise)."""
    out: dict[str, list[float]] = {}
    for gpu, base in BASE.items():
        x = math.log(base)
        path = []
        for _ in range(DAYS):
            x += 0.05 * (math.log(base) - x) + rng.gauss(0, 0.012)
            path.append(x)
        out[gpu] = path
    return out


def write_csv(path: Path, header: list[str], rows: list[list]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)


def main() -> None:
    rng = random.Random(SEED)
    lat = latent(rng)

    obs_rows: list[list] = []
    for d in range(DAYS):
        day = START + timedelta(days=d)
        for name, tier, regions, gpus, mult, kind, ic in PROVIDERS:
            # hyperscalers quote every day; others most days
            if tier != "hyperscaler" and rng.random() < 0.35:
                continue
            for gpu in gpus:
                if rng.random() < 0.3:
                    continue
                region = rng.choice(regions)
                term, months = "on_demand", ""
                r = rng.random()
                if r < 0.15:
                    term, months = "reserved", rng.choice(["1", "3", "6", "12"])
                elif r < 0.22 and tier == "marketplace":
                    term = "spot"
                base_price = math.exp(lat[gpu][d]) * mult
                if ic == "pcie":
                    base_price /= 1.12
                base_price *= math.exp(REGION_ADJ[region])
                if term == "reserved":
                    base_price *= TERM_RATIO[months]
                elif term == "spot":
                    base_price /= 1.25
                if name == "aws" and gpu == "h100":
                    base_price = 1.376 * math.exp(rng.gauss(0, 0.005))  # anchored to the live price list
                price = base_price * math.exp(rng.gauss(0, 0.04))
                if rng.random() < 0.02:
                    price *= rng.uniform(0.3, 6.0)  # planted outliers
                hour = rng.randint(0, 23)
                ts = datetime(day.year, day.month, day.day, hour, 0, tzinfo=timezone.utc)
                qty = "" if rng.random() < 0.3 else str(int(math.exp(rng.gauss(3, 1))))
                raw_ref = f"{name}-{gpu}-{region}-{term}{months}-{d}"
                obs_rows.append([
                    obs_id("sample", name, raw_ref, ts),
                    ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "sample", name, tier, gpu, "", 1, ic, region, "", term, months, qty,
                    f"{price:.4f}", "USD", "gpu_hour", kind, raw_ref,
                ])
    write_csv(
        ROOT / "observations" / "obs_2026-09.csv",
        ["obs_id", "observed_at", "source", "provider", "tier", "gpu", "gpu_sku", "gpu_count", "interconnect", "region", "country", "term", "term_months", "quantity_gpus", "price", "currency", "unit", "listing_kind", "raw_ref"],
        obs_rows,
    )

    # Published index stand-ins: SD blends more tiers (slightly higher), OCPI transaction-only.
    print_rows = []
    for d in range(DAYS):
        day = START + timedelta(days=d)
        for idx, gpu, ex in INDICES:
            level = math.exp(lat[gpu][d]) * (1.03 if ex == "cme" else 0.97) * math.exp(rng.gauss(0, 0.008))
            print_rows.append([day.isoformat(), idx, gpu, f"{level:.4f}", "sample"])
    write_csv(ROOT / "index_prints" / "prints.csv", ["date", "index_id", "gpu", "value", "source"], print_rows)

    power_rows = []
    for d in range(DAYS):
        day = START + timedelta(days=d)
        for hub, (mean, cap) in HUBS.items():
            weekly = 1.0 + 0.06 * math.sin(2 * math.pi * d / 7)
            p = mean * weekly * math.exp(rng.gauss(0, 0.10))
            if rng.random() < 0.03:
                p *= 3.0
            power_rows.append([day.isoformat(), hub, f"{p:.2f}", f"{cap:.2f}" if cap > 0 else ""])
    write_csv(ROOT / "power" / "hub_prices.csv", ["date", "hub", "price_usd_mwh", "capacity_usd_mw_day"], power_rows)

    fut_rows = []
    for d in range(DAYS):
        day = START + timedelta(days=d)
        for idx, gpu, ex in INDICES:
            spot = math.exp(lat[gpu][d]) * (1.03 if ex == "cme" else 0.97)
            for k, tenor in enumerate(TENORS):
                settle = spot * math.exp(-0.01 * (k + 1)) * math.exp(rng.gauss(0, 0.01))
                spread = settle * 0.004
                fut_rows.append([
                    day.isoformat(), ex, f"{ex}:{idx}:{tenor}", idx, gpu, tenor, f"{settle:.4f}",
                    f"{settle - spread:.4f}", f"{settle + spread:.4f}", rng.randint(5, 80), rng.randint(50, 400),
                ])
    write_csv(ROOT / "futures" / "curve.csv", ["date", "exchange", "contract_id", "index_id", "gpu", "tenor", "settle", "bid", "ask", "volume", "open_interest"], fut_rows)

    # Assumptions (founder-supplied priors, see docs/05_model_methodology.md).
    fleet = []
    for i in range(36):  # H100 cohorts 2023-01 .. 2025-12
        y, m = 2023 + i // 12, i % 12 + 1
        units = 60000 + 4500 * i
        for region, share in [("us_east", 0.40), ("us_central", 0.20), ("us_west", 0.15), ("eu_west", 0.15), ("apac", 0.10)]:
            fleet.append(["h100", region, f"{y:04d}-{m:02d}", int(units * share), 0.35])
    for i in range(16):  # B200 cohorts 2025-06 .. 2026-09
        total = 5 + i  # months from 2025-06
        y, m = 2025 + (5 + i) // 12, (5 + i) % 12 + 1
        units = 40000 + 9000 * i
        for region, share in [("us_east", 0.45), ("us_central", 0.25), ("us_west", 0.10), ("eu_west", 0.12), ("apac", 0.08)]:
            fleet.append(["b200", region, f"{y:04d}-{m:02d}", int(units * share), 0.25])
    write_csv(ROOT / "assumptions" / "fleet_cohorts.csv", ["gpu", "region", "ship_month", "units", "sellable_share"], fleet)

    pipeline = [
        ["tx_abilene_phase2", "b200", "us_central", "ercot_west", 600, "2026-12", 2.0, 3.0, 0.85],
        ["tx_amarillo_campus", "b200", "us_central", "ercot_north", 400, "2027-02", 3.0, 4.0, 0.75],
        ["va_ashburn_expansion", "b200", "us_east", "pjm_dominion", 300, "2027-01", 4.0, 4.0, 0.70],
        ["va_loudoun_b", "h100", "us_east", "pjm_dominion", 120, "2026-11", 1.0, 2.0, 0.90],
        ["nd_ellendale", "b200", "us_central", "miso_north", 250, "2027-03", 3.0, 5.0, 0.65],
        ["oh_new_albany", "b200", "us_east", "pjm_dominion", 350, "2027-06", 5.0, 6.0, 0.60],
        ["tx_west_solar_coloc", "h100", "us_central", "ercot_west", 150, "2026-12", 2.0, 3.0, 0.80],
        ["eu_nordics_hydro", "b200", "eu_west", "miso_north", 200, "2027-04", 4.0, 5.0, 0.60],
        ["ga_atlanta_campus", "b200", "us_east", "pjm_dominion", 220, "2027-05", 4.0, 5.0, 0.55],
        ["az_phoenix_b", "b200", "us_west", "ercot_north", 180, "2027-02", 3.0, 4.0, 0.70],
        ["tx_secondary_h100", "h100", "us_central", "ercot_north", 90, "2026-10", 1.0, 1.5, 0.95],
        ["apac_sg_campus", "b200", "apac", "miso_north", 120, "2027-06", 5.0, 6.0, 0.50],
    ]
    write_csv(ROOT / "assumptions" / "pipeline.csv", ["project", "gpu", "region", "hub", "mw", "online_month", "delay_mean_months", "delay_sd_months", "prob_complete"], pipeline)

    demand = [
        ["h100", 34000000, 2.64, 0.30, 0.8],
        ["b200", 9000000, 4.08, 0.80, 0.8],
    ]
    write_csv(ROOT / "assumptions" / "demand.csv", ["gpu", "d0_gpu_hours_per_day", "ref_price", "growth_per_year", "elasticity"], demand)

    perf = [
        ["a100_80", 0.45, 0.50],
        ["h100", 1.00, 1.00],
        ["h200", 1.40, 1.25],
        ["b200", 2.25, 1.80],
        ["b300", 2.80, 2.20],
    ]
    write_csv(ROOT / "assumptions" / "perf.csv", ["gpu", "inference_vs_h100", "training_vs_h100"], perf)

    manifest = {}
    for p in sorted(ROOT.rglob("*.csv")):
        rel = p.relative_to(ROOT).as_posix()
        manifest[rel] = {"sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "rows": sum(1 for _ in p.open()) - 1}
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote {len(obs_rows)} observations, {len(print_rows)} prints, {len(power_rows)} power, {len(fut_rows)} futures")


if __name__ == "__main__":
    main()
