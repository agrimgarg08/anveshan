"""
report_generator.py

Maps pixel-space detections to real-world lat/lon using simulated (or real,
if you have it) tow-path metadata, and outputs structured reports.
"""

import math
from dataclasses import dataclass, asdict

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

def generate_simulated_metadata(
    num_pings: int = 50,
    start_lat: float = 13.0827,
    start_lon: float = 80.2707,
    heading_deg: float = 45.0,
    ping_spacing_m: float = 2.0,
) -> list[dict]:
    """Generate a plausible straight-line tow path for demo purposes."""
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
    return rows

def pixel_to_latlon(
    bbox_center_x: float,
    bbox_center_y: float,
    image_width_px: int,
    image_height_px: int,
    swath_width_m: float,
    ping_meta_row: dict,
) -> tuple:
    """Convert a detection's pixel center to an approximate lat/lon."""
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
    ping_metadata: list[dict],
    image_width_px: int = 640,
    image_height_px: int = 640,
    swath_width_m: float = 50.0,
) -> list[ReportEntry]:
    """Build a list of ReportEntry from filtered detections + tow-path metadata."""
    entries = []
    for idx, det in enumerate(detections):
        ping_row = ping_metadata[idx % len(ping_metadata)]

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

    return entries

if __name__ == "__main__":
    meta = generate_simulated_metadata(num_pings=10)
    dummy_detections = [
        {"class": "pipe_cylinder", "final_confidence": 82.4, "flagged_for_review": False, "bbox": (100, 100, 60, 40)},
        {"class": "unknown_anomaly", "final_confidence": 35.1, "flagged_for_review": True, "bbox": (300, 300, 30, 30)},
    ]
    report = build_report(dummy_detections, meta)
    for e in report:
        print(e)
