"""
report_generator.py

Maps pixel-space detections to real-world lat/lon using simulated (or real,
if you have it) tow-path metadata, and outputs structured JSON/CSV reports.

If you don't have real navigation data tied to your sonar images, use
`generate_simulated_metadata()` to create a plausible tow path for demo
purposes — and say so explicitly in your slides. Judges respect an honest
"this is simulated for the prototype" far more than an unexplained number.

Usage:
    from report_generator import generate_simulated_metadata, build_report

    meta = generate_simulated_metadata(num_pings=50, start_lat=13.0827, start_lon=80.2707)
    report = build_report(detections, meta, image_width_px=640, swath_width_m=50)
    report.to_json("reports/sample_report.json")
    report.to_csv("reports/sample_report.csv")
"""

import json
import math
from io import StringIO
from dataclasses import dataclass, field, asdict

import pandas as pd


@dataclass
class ReportEntry:
    detection_id: str
    ping_number: int
    image_class: str
    confidence: float
    flagged_for_review: bool
    bbox_px: tuple
    latitude: float
    longitude: float
    timestamp: str


class Report:
    def __init__(self, entries: list):
        self.entries = entries

    def to_json(self, path: str):
        with open(path, "w") as f:
            f.write(self.to_json_text())
        print(f"Wrote {len(self.entries)} detections to {path}")

    def to_csv(self, path: str):
        with open(path, "w", newline="") as f:
            f.write(self.to_csv_text())
        print(f"Wrote {len(self.entries)} detections to {path}")

    def to_json_text(self) -> str:
        """Return report JSON for dashboard downloads without writing a file."""
        return json.dumps([asdict(e) for e in self.entries], indent=2)

    def to_csv_text(self) -> str:
        """Return report CSV for dashboard downloads without writing a file."""
        buffer = StringIO()
        pd.DataFrame([asdict(e) for e in self.entries]).to_csv(buffer, index=False)
        return buffer.getvalue()


def generate_simulated_metadata(
    num_pings: int = 50,
    start_lat: float = 13.0827,
    start_lon: float = 80.2707,
    heading_deg: float = 45.0,
    ping_spacing_m: float = 2.0,
) -> pd.DataFrame:
    """Generate a plausible straight-line tow path for demo purposes.

    Moves in a fixed heading from a start point, one row per ping.
    NOTE: this is simulated data — say so explicitly in your demo/slides
    unless you've substituted real navigation metadata from your dataset.
    """
    earth_radius_m = 6371000
    rows = []
    for i in range(num_pings):
        dist_m = i * ping_spacing_m
        d_lat = (dist_m * math.cos(math.radians(heading_deg))) / earth_radius_m
        d_lon = (dist_m * math.sin(math.radians(heading_deg))) / (
            earth_radius_m * math.cos(math.radians(start_lat))
        )
        rows.append({
            "ping_number": i,
            "latitude": start_lat + math.degrees(d_lat),
            "longitude": start_lon + math.degrees(d_lon),
            "heading": heading_deg,
            "timestamp": f"2026-09-05T10:{(22 + i) % 60:02d}:00Z",
        })
    return pd.DataFrame(rows)


def pixel_to_latlon(
    bbox_center_x: float,
    bbox_center_y: float,
    image_width_px: int,
    image_height_px: int,
    swath_width_m: float,
    ping_meta_row: pd.Series,
) -> tuple:
    """Convert a detection's pixel center to an approximate lat/lon.

    Simplified model: column position -> across-track offset from the tow
    path (using swath width), applied perpendicular to heading. Good enough
    for a hackathon demo; a real system would use per-ping slant-range data.
    """
    across_track_m = ((bbox_center_x / image_width_px) - 0.5) * swath_width_m

    heading_rad = math.radians(ping_meta_row["heading"])
    perp_rad = heading_rad + math.pi / 2

    earth_radius_m = 6371000
    d_lat = (across_track_m * math.cos(perp_rad)) / earth_radius_m
    d_lon = (across_track_m * math.sin(perp_rad)) / (
        earth_radius_m * math.cos(math.radians(ping_meta_row["latitude"]))
    )

    lat = ping_meta_row["latitude"] + math.degrees(d_lat)
    lon = ping_meta_row["longitude"] + math.degrees(d_lon)
    return lat, lon


def build_report(
    detections: list,
    ping_metadata: pd.DataFrame,
    image_width_px: int = 640,
    image_height_px: int = 640,
    swath_width_m: float = 50.0,
) -> Report:
    """Build a full Report from filtered detections + tow-path metadata.

    detections: output of confidence_filter.refine_detections(), i.e. dicts with
        class, final_confidence, flagged_for_review, bbox (x, y, w, h)
    ping_metadata: DataFrame from generate_simulated_metadata() (or real data
        in the same shape: ping_number, latitude, longitude, heading, timestamp)
    """
    entries = []
    for idx, det in enumerate(detections):
        # naive: assign each detection to a ping row round-robin for the demo;
        # replace with a real row-index -> ping mapping once you have real logs
        ping_row = ping_metadata.iloc[idx % len(ping_metadata)]

        x, y, w, h = det["bbox"]
        cx, cy = x + w / 2, y + h / 2
        lat, lon = pixel_to_latlon(cx, cy, image_width_px, image_height_px, swath_width_m, ping_row)

        entries.append(ReportEntry(
            detection_id=f"D{idx:03d}",
            ping_number=int(ping_row["ping_number"]),
            image_class=det["class"],
            confidence=det.get("final_confidence", det.get("confidence", 0.0)),
            flagged_for_review=det.get("flagged_for_review", False),
            bbox_px=(x, y, w, h),
            latitude=round(lat, 6),
            longitude=round(lon, 6),
            timestamp=str(ping_row["timestamp"]),
        ))

    return Report(entries)


if __name__ == "__main__":
    # Smoke test
    meta = generate_simulated_metadata(num_pings=10)
    dummy_detections = [
        {"class": "pipe_cylinder", "final_confidence": 82.4, "flagged_for_review": False, "bbox": (100, 100, 60, 40)},
        {"class": "unknown_anomaly", "final_confidence": 35.1, "flagged_for_review": True, "bbox": (300, 300, 30, 30)},
    ]
    report = build_report(dummy_detections, meta)
    for e in report.entries:
        print(e)
