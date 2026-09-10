"""Unit tests for normalized Roboflow Hosted API predictions."""

from __future__ import annotations

import unittest

import numpy as np
import requests

from src.inference.roboflow_client import RoboflowClient, RoboflowConfigurationError, RoboflowInferenceError


class FakeResponse:
    def __init__(self, payload=None, error=None):
        self.payload, self.error = payload, error

    def raise_for_status(self):
        if self.error:
            raise self.error

    def json(self):
        if isinstance(self.payload, Exception):
            raise self.payload
        return self.payload


class FakeSession:
    def __init__(self, response=None, error=None):
        self.response, self.error, self.last_request = response, error, None

    def post(self, *args, **kwargs):
        self.last_request = (args, kwargs)
        if self.error:
            raise self.error
        return self.response


class RoboflowClientTests(unittest.TestCase):
    def test_normalizes_successful_response(self):
        session = FakeSession(FakeResponse({"predictions": [{"class": "pipe_cylinder", "confidence": 0.83,
            "x": 100, "y": 200, "width": 40, "height": 20}]}))
        detections = RoboflowClient("test-key", "marine-sonar-debris/1", session=session).predict(
            np.zeros((64, 64), dtype=np.uint8))
        self.assertEqual(detections, [{"class": "pipe_cylinder", "confidence": 0.83,
            "bbox": (80.0, 190.0, 40.0, 20.0)}])
        self.assertEqual(session.last_request[0][0], "https://detect.roboflow.com/marine-sonar-debris/1")

    def test_accepts_empty_predictions(self):
        client = RoboflowClient("test-key", "marine-sonar-debris/1", session=FakeSession(FakeResponse({"predictions": []})))
        self.assertEqual(client.predict(np.zeros((64, 64), dtype=np.uint8)), [])

    def test_rejects_bad_configuration(self):
        with self.assertRaises(RoboflowConfigurationError):
            RoboflowClient("", "marine-sonar-debris/1")
        with self.assertRaises(RoboflowConfigurationError):
            RoboflowClient("test-key", "not-a-versioned-model")

    def test_wraps_network_failure(self):
        client = RoboflowClient("test-key", "marine-sonar-debris/1",
            session=FakeSession(error=requests.ConnectionError("offline")))
        with self.assertRaises(RoboflowInferenceError):
            client.predict(np.zeros((64, 64), dtype=np.uint8))

    def test_rejects_invalid_response(self):
        client = RoboflowClient("test-key", "marine-sonar-debris/1",
            session=FakeSession(FakeResponse({"unexpected": []})))
        with self.assertRaises(RoboflowInferenceError):
            client.predict(np.zeros((64, 64), dtype=np.uint8))


if __name__ == "__main__":
    unittest.main()
