"""Load fixed detection results for named demo uploads."""

from __future__ import annotations

import csv
from pathlib import Path


DEMO_DIR = Path(__file__).resolve().parents[2] / "data" / "demo"


def load_demo_results(filename: str) -> tuple[str, list[dict]] | None:
    """Return the matching CSV scenario, or None for a non-demo filename."""
    stem = Path(filename or "").stem.lower()
    csv_path = next(
        (path for path in DEMO_DIR.glob("*.csv") if path.stem.lower() == stem),
        None,
    )
    if csv_path is None:
        return None

    detections: list[dict] = []
    scenario_name = csv_path.stem.replace("_", " ").title()
    with csv_path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            scenario_name = row.get("scenario", scenario_name).strip() or scenario_name
            detections.append({
                "class": row["class"].strip(),
                "final_confidence": float(row["final_confidence"]),
                "flagged_for_review": row["flagged_for_review"].strip().lower() == "true",
                "bbox": (
                    float(row["x"]),
                    float(row["y"]),
                    float(row["width"]),
                    float(row["height"]),
                ),
                "ping_number": int(row["ping_number"]),
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "timestamp": row["timestamp"].strip(),
            })

    return scenario_name, detections


def expected_demo_filenames() -> list[str]:
    return sorted(path.stem for path in DEMO_DIR.glob("*.csv"))
