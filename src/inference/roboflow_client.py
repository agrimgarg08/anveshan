"""Roboflow Hosted API adapter for Anveshan detections."""

import base64
import cv2
import requests
import numpy as np

def predict(image: np.ndarray, api_key: str, model_id: str, confidence: int = 25, overlap: int = 30) -> list[dict]:
    """Send a grayscale/BGR sonar image and return normalized API predictions."""
    if not api_key or not model_id:
        raise ValueError("ROBOFLOW_API_KEY and ROBOFLOW_MODEL_ID are required.")
    
    endpoint_model = "/".join(model_id.strip("/").split("/")[-2:])
    endpoint = f"https://detect.roboflow.com/{endpoint_model}"
    
    success, encoded = cv2.imencode(".jpg", image)
    if not success:
        raise RuntimeError("Could not encode image for Roboflow inference.")
        
    response = requests.post(
        endpoint,
        params={"api_key": api_key, "confidence": confidence, "overlap": overlap},
        data=base64.b64encode(encoded.tobytes()),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=20.0,
    )
    response.raise_for_status()
    
    out = []
    for p in response.json().get("predictions", []):
        x, y, w, h = float(p["x"]), float(p["y"]), float(p["width"]), float(p["height"])
        out.append({
            "class": str(p["class"]), 
            "confidence": float(p["confidence"]),
            "bbox": (x - w / 2, y - h / 2, w, h)
        })
    return out
