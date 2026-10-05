"""Contract tests without downloading model weights or requiring a GPU."""
from io import BytesIO
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
import numpy as np
from PIL import Image

from backend.src.api.main import CLASSES, MAX_BYTES, create_app
from backend.src.api.detection_with_fallback import detect_remote
from backend.src.inference.tunnel_client import predict as predict_tunnel


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        path = Path(self.tmp.name) / "best.pt"
        path.touch()
        env = patch.dict(os.environ, {"MODEL_PATH": str(path), "CORS_ORIGINS": "https://demo.vercel.app", "GEMINI_API_KEY": ""})
        env.start()
        self.addCleanup(env.stop)
        self.boxes = [SimpleNamespace(
            xyxy=np.array([[10, 20, 40, 60]]), conf=[0.82], cls=[0],
        )]
        self.model = SimpleNamespace(names=CLASSES, predict=self.predict)
        self.client = self.enterContext(TestClient(create_app(lambda _: self.model)))

    def predict(self, **kwargs):
        self.assertEqual(kwargs["source"].shape, (80, 100, 3))
        return [SimpleNamespace(boxes=self.boxes)]

    def upload(self, content=None):
        if content is None:
            buffer = BytesIO()
            Image.new("L", (100, 80)).save(buffer, format="PNG")
            content = buffer.getvalue()
        return self.client.post("/detect", files={"file": ("sonar.png", content, "image/png")})

    def test_detection_contract(self):
        response = self.upload()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "detections": [{"class": "marine_anomaly", "confidence": 0.82, "bbox": [10, 20, 30, 40]}],
            "image": {"width": 100, "height": 80},
            "source": "local_yolo", "fallback_reason": "missing_api_key",
        })

    def test_empty_results(self):
        self.boxes = []
        self.assertEqual(self.upload().json()["detections"], [])

    def test_invalid_and_missing_image(self):
        self.assertEqual(self.upload(b"invalid").status_code, 400)
        self.assertEqual(self.client.post("/detect").status_code, 422)

    def test_oversized_upload(self):
        self.assertEqual(self.upload(b"x" * (MAX_BYTES + 1)).status_code, 413)

    def test_pixel_limit_and_unsupported_format(self):
        buffer = BytesIO()
        Image.new("L", (4001, 4000)).save(buffer, format="PNG")
        self.assertEqual(self.upload(buffer.getvalue()).status_code, 413)
        buffer = BytesIO()
        Image.new("L", (10, 10)).save(buffer, format="GIF")
        self.assertEqual(self.upload(buffer.getvalue()).status_code, 415)

    def test_health_and_cors(self):
        self.assertEqual(self.client.get("/health").json()["classes"], list(CLASSES.values()))
        response = self.client.options("/detect", headers={
            "Origin": "https://demo.vercel.app", "Access-Control-Request-Method": "POST",
        })
        self.assertEqual(response.headers["access-control-allow-origin"], "https://demo.vercel.app")

    def test_wrong_classes_fail_on_fallback(self):
        model = SimpleNamespace(names={0: "0"})
        with TestClient(create_app(lambda _: model)) as client:
            buffer = BytesIO()
            Image.new("L", (100, 80)).save(buffer, format="PNG")
            response = client.post("/detect", files={"file": ("sonar.png", buffer.getvalue(), "image/png")})
            self.assertEqual(response.status_code, 503)

    def test_remote_response_does_not_load_yolo(self):
        with patch("backend.src.api.main.detect_remote", return_value=[{
            "class": "shipwreck", "confidence": None, "confidence_label": "high",
            "bbox": [10, 20, 30, 40],
        }]):
            response = self.upload()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["source"], "remote_vision")
        self.assertIsNone(response.json()["detections"][0]["confidence"])
        self.assertIsNone(self.client.app.state.model)

    def test_remote_coordinates_and_qualitative_confidence(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}):
            with patch("google.genai.Client") as client_class:
                client_class.return_value.models.generate_content.return_value.text = (
                    '[{"label":"shipwreck","confidence":"high","box_2d":[100,200,600,700]}]'
                )
                result = detect_remote(Image.new("RGB", (200, 100)), (640, 640))
        self.assertEqual(result, [{
            "class": "shipwreck", "confidence": None, "confidence_label": "high",
            "bbox": [128.0, 64.0, 320.0, 320.0],
        }])

    def test_invalid_remote_box_uses_local_model(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}):
            with patch("google.genai.Client") as client_class:
                client_class.return_value.models.generate_content.return_value.text = (
                    '[{"label":"shipwreck","confidence":"high","box_2d":[0,0,1200,100]}]'
                )
                result = self.upload().json()
        self.assertEqual(result["source"], "local_yolo")
        self.assertEqual(result["fallback_reason"], "invalid_remote_response")

    def test_missing_weights_fail_startup(self):
        with patch.dict(os.environ, {"MODEL_PATH": str(Path(self.tmp.name) / "missing.pt")}):
            with self.assertRaisesRegex(RuntimeError, "Missing trained weights"):
                with TestClient(create_app()):
                    pass


class TunnelAdapterTests(unittest.TestCase):
    def test_legacy_provider_labels_are_normalized(self):
        with patch('backend.src.inference.tunnel_client.requests.post') as post:
            post.return_value.json.return_value = {
                'detections': [], 'source': 'legacy_provider',
                'fallback_reason': None,
            }
            result = predict_tunnel(np.zeros((20, 20), dtype=np.uint8), 'https://example.test/detect')
        self.assertEqual(result['source'], 'remote_vision')
        self.assertIsNone(result['fallback_reason'])

    def test_legacy_fallback_reason_is_normalized(self):
        with patch('backend.src.inference.tunnel_client.requests.post') as post:
            post.return_value.json.return_value = {
                'detections': [], 'source': 'local_yolo',
                'fallback_reason': 'legacy_http_429',
            }
            result = predict_tunnel(np.zeros((20, 20), dtype=np.uint8), 'https://example.test/detect')
        self.assertEqual(result['source'], 'local_yolo')
        self.assertEqual(result['fallback_reason'], 'remote_http_429')


if __name__ == "__main__":
    unittest.main()
