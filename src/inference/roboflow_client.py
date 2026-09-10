"""Roboflow Hosted API adapter for Anveshan detections."""

from __future__ import annotations

import base64
from typing import Any

import cv2
import numpy as np
import requests


class RoboflowConfigurationError(ValueError):
    """Raised when the hosted-inference configuration is incomplete."""


class RoboflowInferenceError(RuntimeError):
    """Raised when Roboflow cannot return a usable inference response."""


class RoboflowClient:
    """Call a deployed Roboflow object-detection model.

    The public ``predict`` contract matches the confidence-filter input: each
    detection has a class, 0-1 confidence, and ``(x, y, width, height)`` bbox.
    """

    def __init__(self, api_key: str, model_id: str, *, confidence: int = 25,
                 overlap: int = 30, timeout_seconds: float = 20.0,
                 session: requests.Session | None = None) -> None:
        if not api_key or not api_key.strip():
            raise RoboflowConfigurationError("ROBOFLOW_API_KEY is required.")
        parts = [part for part in model_id.strip("/").split("/") if part]
        if len(parts) not in (2, 3):
            raise RoboflowConfigurationError(
                "ROBOFLOW_MODEL_ID must be '<project>/<version>' or '<workspace>/<project>/<version>'."
            )
        self.api_key = api_key.strip()
        self.model_id = model_id.strip("/")
        self.confidence = int(confidence)
        self.overlap = int(overlap)
        self.timeout_seconds = timeout_seconds
        self.session = session or requests.Session()

    @property
    def endpoint(self) -> str:
        # Dashboard links include workspace/project/version, while the hosted
        # detect endpoint addresses the project slug and version.
        parts = self.model_id.split("/")
        endpoint_model = "/".join(parts[-2:])
        return f"https://detect.roboflow.com/{endpoint_model}"

    def predict(self, image: np.ndarray) -> list[dict[str, Any]]:
        """Send a grayscale/BGR sonar image and normalize API predictions."""
        if image is None or not isinstance(image, np.ndarray) or image.size == 0:
            raise ValueError("image must be a non-empty NumPy array")
        success, encoded = cv2.imencode(".jpg", image)
        if not success:
            raise RoboflowInferenceError("Could not encode image for Roboflow inference.")
        try:
            response = self.session.post(
                self.endpoint,
                params={"api_key": self.api_key, "confidence": self.confidence, "overlap": self.overlap},
                data=base64.b64encode(encoded.tobytes()),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
        except requests.RequestException as exc:
            raise RoboflowInferenceError(f"Roboflow inference request failed: {exc}") from exc
        except ValueError as exc:
            raise RoboflowInferenceError("Roboflow returned invalid JSON.") from exc
        predictions = payload.get("predictions") if isinstance(payload, dict) else None
        if not isinstance(predictions, list):
            raise RoboflowInferenceError("Roboflow response did not contain a predictions list.")
        return [self._normalize_prediction(prediction) for prediction in predictions]

    @staticmethod
    def _normalize_prediction(prediction: dict[str, Any]) -> dict[str, Any]:
        required = ("class", "confidence", "x", "y", "width", "height")
        if not isinstance(prediction, dict) or any(field not in prediction for field in required):
            raise RoboflowInferenceError("Roboflow returned a prediction with missing bounding-box fields.")
        try:
            confidence = float(prediction["confidence"])
            x_center, y_center = float(prediction["x"]), float(prediction["y"])
            width, height = float(prediction["width"]), float(prediction["height"])
        except (TypeError, ValueError) as exc:
            raise RoboflowInferenceError("Roboflow returned non-numeric prediction values.") from exc
        if not 0.0 <= confidence <= 1.0 or width <= 0 or height <= 0:
            raise RoboflowInferenceError("Roboflow returned an invalid confidence or bounding-box size.")
        return {"class": str(prediction["class"]), "confidence": confidence,
                "bbox": (x_center - width / 2, y_center - height / 2, width, height)}
