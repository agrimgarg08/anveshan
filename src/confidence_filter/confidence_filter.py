"""
confidence_filter.py

Second-pass filtering layer on top of raw YOLO detections. Combines the
model's raw confidence with a shape-regularity heuristic to down-weight
false positives on natural clutter (rock, sand ripples) — directly
answering the problem statement's "false positives from natural acoustic
shadows or rock clusters" requirement.

Usage:
    from confidence_filter import refine_detections
    refined = refine_detections(image, yolo_results)
"""

import cv2
import numpy as np


def shape_regularity_score(image: np.ndarray, bbox: tuple) -> float:
    """Score how 'man-made' a detected region's shape looks, 0.0-1.0.

    Man-made objects (pipes, cylinders, net frames) tend to have straighter
    edges and more consistent contour shape than rock clusters, which are
    typically irregular/fractal-like.

    bbox: (x, y, w, h) in pixel coordinates.
    """
    x, y, w, h = [int(v) for v in bbox]
    x, y = max(0, x), max(0, y)
    crop = image[y:y + h, x:x + w]
    if crop.size == 0:
        return 0.5  # neutral fallback if bbox is degenerate

    if len(crop.shape) == 3:
        crop = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

    edges = cv2.Canny(crop, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return 0.3  # low regularity if no clear contour found

    largest = max(contours, key=cv2.contourArea)
    perimeter = cv2.arcLength(largest, True)
    if perimeter == 0:
        return 0.3

    # approxPolyDP: fewer vertices for the same contour = straighter/more regular shape
    approx = cv2.approxPolyDP(largest, 0.02 * perimeter, True)
    num_vertices = len(approx)

    # Heuristic: 4-8 vertices -> regular/geometric (pipe, box, cylinder outline)
    # Many more vertices -> irregular/organic (rock, natural clutter)
    if num_vertices <= 8:
        score = 1.0 - (num_vertices - 4) / 8.0
    else:
        score = max(0.1, 1.0 - (num_vertices - 8) / 20.0)

    return float(np.clip(score, 0.0, 1.0))


def refine_detections(
    image: np.ndarray,
    detections: list,
    yolo_weight: float = 0.7,
    shape_weight: float = 0.3,
    review_threshold: float = 40.0,
) -> list:
    """Combine YOLO confidence with shape-regularity into a final score.

    detections: list of dicts, each with at least:
        {"class": str, "confidence": float (0-1), "bbox": (x, y, w, h)}
    (this matches Ultralytics' typical per-box output shape once you pull
    class name, conf, and xywh out of a Results object)

    Returns the same list with two fields added:
        "final_confidence": float (0-100)
        "flagged_for_review": bool
    """
    refined = []
    for det in detections:
        shape_score = shape_regularity_score(image, det["bbox"])
        yolo_conf_pct = det["confidence"] * 100.0
        shape_score_pct = shape_score * 100.0

        final_conf = yolo_weight * yolo_conf_pct + shape_weight * shape_score_pct

        out = dict(det)
        out["shape_regularity_score"] = round(shape_score_pct, 2)
        out["final_confidence"] = round(final_conf, 2)
        out["flagged_for_review"] = final_conf < review_threshold
        refined.append(out)

    return refined


if __name__ == "__main__":
    # Quick smoke test with a fake image + fake detection
    dummy_image = np.random.randint(0, 255, (640, 640), dtype=np.uint8)
    dummy_detections = [
        {"class": "pipe_cylinder", "confidence": 0.82, "bbox": (100, 100, 60, 40)},
        {"class": "shipwreck", "confidence": 0.45, "bbox": (300, 300, 30, 30)},
    ]
    result = refine_detections(dummy_image, dummy_detections)
    for r in result:
        print(r)
