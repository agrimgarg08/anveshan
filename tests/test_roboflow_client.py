"""Unit tests for the function-based Roboflow Hosted API adapter."""

import unittest
from unittest.mock import patch

import numpy as np
import requests

from src.inference.roboflow_client import predict


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class RoboflowPredictTests(unittest.TestCase):
    def test_normalizes_successful_response(self):
        response = FakeResponse({"predictions": [{"class": "pipe_cylinder", "confidence": 0.83,
            "x": 100, "y": 200, "width": 40, "height": 20}]})
        with patch("src.inference.roboflow_client.requests.post", return_value=response) as post:
            detections = predict(np.zeros((64, 64), dtype=np.uint8), "test-key", "marine-sonar-debris/1")
        self.assertEqual(detections, [{"class": "pipe_cylinder", "confidence": 0.83,
            "bbox": (80.0, 190.0, 40.0, 20.0)}])
        self.assertEqual(post.call_args.args[0], "https://detect.roboflow.com/marine-sonar-debris/1")

    def test_accepts_empty_predictions(self):
        with patch("src.inference.roboflow_client.requests.post", return_value=FakeResponse({"predictions": []})):
            self.assertEqual(predict(np.zeros((64, 64), dtype=np.uint8), "test-key", "marine-sonar-debris/1"), [])

    def test_rejects_missing_configuration(self):
        with self.assertRaises(ValueError):
            predict(np.zeros((64, 64), dtype=np.uint8), "", "marine-sonar-debris/1")

    def test_propagates_network_failure(self):
        with patch("src.inference.roboflow_client.requests.post", side_effect=requests.ConnectionError("offline")):
            with self.assertRaises(requests.ConnectionError):
                predict(np.zeros((64, 64), dtype=np.uint8), "test-key", "marine-sonar-debris/1")


if __name__ == "__main__":
    unittest.main()
