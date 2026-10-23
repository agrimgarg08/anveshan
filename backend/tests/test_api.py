"""Contract tests without downloading model weights or requiring a GPU."""
from io import BytesIO
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
import numpy as np
import httpx
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
        self.diagnostic_path = Path(self.tmp.name) / 'inference-errors.log'
        env = patch.dict(os.environ, {"MODEL_PATH": str(path), "CORS_ORIGINS": "https://demo.vercel.app", "GEMINI_API_KEY": "", 'INFERENCE_ERROR_LOG': str(self.diagnostic_path)})
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
        payload = response.json()
        self.assertRegex(payload.pop('request_id'), r'^[a-f0-9]{12}$')
        self.assertEqual(payload, {
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

    def test_empty_remote_result_uses_original_pixels_for_fallback(self):
        original = BytesIO()
        Image.new('RGB', (200, 160), (10, 20, 30)).save(original, format='PNG')
        processed = BytesIO()
        Image.new('L', (100, 80)).save(processed, format='PNG')
        with patch('backend.src.api.main.detect_remote', return_value=[]) as remote:
            with patch.object(self.model, 'predict', return_value=[SimpleNamespace(boxes=self.boxes)]) as local:
                response = self.client.post('/detect', files={
                    'file': ('processed.png', processed.getvalue(), 'image/png'),
                    'original': ('original.png', original.getvalue(), 'image/png'),
                })
        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(remote.call_args.args[1], (200, 160))
        self.assertEqual(payload['image'], {'width': 200, 'height': 160})
        self.assertEqual(payload['fallback_reason'], 'remote_empty')
        self.assertEqual(payload['source'], 'local_yolo')
        pixels = local.call_args.kwargs['source']
        self.assertEqual(pixels.shape, (160, 200, 3))
        np.testing.assert_array_equal(pixels[0, 0], [30, 20, 10])

    def test_remote_http_error_is_diagnosed_only_in_redacted_local_log(self):
        from google.genai.errors import ClientError
        key = 'AIza' + 'a' * 35
        error = ClientError(400, {'error': {
            'code': 400, 'status': 'INVALID_ARGUMENT',
            'message': f'API key not valid. URL https://example.test/?key={key}',
            'details': [{'reason': 'API_KEY_INVALID'}],
        }})
        with patch.dict(os.environ, {'GEMINI_API_KEY': key}):
            with patch('backend.src.api.main.detect_remote', side_effect=error):
                with self.assertLogs('uvicorn.error', level='WARNING') as logs:
                    response = self.upload()
        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload['fallback_reason'], 'remote_http_400')
        self.assertNotIn('API_KEY_INVALID', response.text)
        self.assertNotIn(key, response.text)
        diagnostic = '\n'.join(logs.output)
        self.assertIn(payload['request_id'], diagnostic)
        self.assertIn('API_KEY_INVALID', diagnostic)
        self.assertIn('[REDACTED]', diagnostic)
        self.assertNotIn(key, diagnostic)
        file_diagnostic = self.diagnostic_path.read_text(encoding='utf-8')
        self.assertIn(payload['request_id'], file_diagnostic)
        self.assertIn('API_KEY_INVALID', file_diagnostic)
        self.assertNotIn(key, file_diagnostic)

    def test_actual_sdk_serializes_image_and_detection_schema_without_network(self):
        from google import genai
        from google.genai import types
        captured = {}

        def respond(request):
            captured.update(json.loads(request.content))
            return httpx.Response(200, json={'candidates': [{
                'content': {'role': 'model', 'parts': [{'text': '[]'}]},
                'finishReason': 'STOP',
            }]})

        client = genai.Client(api_key='test-only', http_options=types.HttpOptions(
            client_args={'transport': httpx.MockTransport(respond)},
        ))
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test-only', 'GEMINI_MODEL': 'gemini-3.8-flash'}):
            with patch('google.genai.Client', return_value=client):
                detections = detect_remote(Image.new('RGB', (200, 100)), (200, 100))
        self.assertEqual(detections, [])
        schema = captured['generationConfig']['responseJsonSchema']
        self.assertEqual(schema['type'].upper(), 'ARRAY')
        self.assertIn('aircraft_wreck', schema['items']['properties']['label']['enum'])
        self.assertEqual(schema['items']['properties']['box_2d']['minItems'], 4)
        thinking = captured['generationConfig']['thinkingConfig']
        self.assertEqual(thinking.get('thinkingLevel', thinking.get('thinking_level')), 'LOW')
        parts = captured['contents'][0]['parts']
        self.assertIn('side-scan sonar', parts[0]['text'])
        self.assertTrue(any(part.get('inlineData', {}).get('data') for part in parts))

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

    def test_remote_model_configuration_preserves_explicit_override(self):
        from backend.src.api.detection_with_fallback import DEFAULT_REMOTE_MODEL
        for model in (DEFAULT_REMOTE_MODEL, 'gemini-2.5-flash'):
            with self.subTest(model=model):
                with patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key', 'GEMINI_MODEL': model}):
                    with patch('google.genai.Client') as client_class:
                        generate = client_class.return_value.models.generate_content
                        generate.return_value.text = '[]'
                        detect_remote(Image.new('RGB', (100, 80)), (100, 80))
                self.assertEqual(generate.call_args.kwargs['model'], model)
                thinking = generate.call_args.kwargs['config'].thinking_config
                if model == DEFAULT_REMOTE_MODEL:
                    self.assertEqual(thinking.thinking_level.value, 'LOW')
                else:
                    self.assertIsNone(thinking)

    def test_remote_overload_retries_once_with_remaining_budget(self):
        from google.genai.errors import ClientError
        overload = ClientError(503, {'error': {'message': 'High demand', 'status': 'UNAVAILABLE'}})
        response = SimpleNamespace(text='[{"label":"aircraft_wreck","confidence":"medium","box_2d":[100,200,600,700]}]')
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key'}):
            with patch('google.genai.Client') as client_class:
                generate = client_class.return_value.models.generate_content
                generate.side_effect = [overload, response]
                with patch('backend.src.api.detection_with_fallback.sleep') as pause:
                    result = detect_remote(Image.new('RGB', (200, 100)), (200, 100))
        self.assertEqual(result[0]['class'], 'aircraft_wreck')
        self.assertEqual(generate.call_count, 2)
        pause.assert_called_once_with(1)
        first, second = [call.kwargs['config'].http_options for call in generate.call_args_list]
        self.assertGreater(first.timeout, 15_000)
        self.assertLessEqual(second.timeout, first.timeout)
        self.assertEqual(first.retry_options.attempts, 1)
        self.assertEqual(second.retry_options.attempts, 1)

    def test_remote_auth_quota_and_timeouts_are_not_retried(self):
        from google.genai.errors import ClientError
        for error in (ClientError(400, {'message': 'Invalid request'}),
                      ClientError(429, {'message': 'Quota exceeded'}),
                      httpx.ReadTimeout('Read timed out')):
            with self.subTest(error=type(error).__name__, code=getattr(error, 'code', None)):
                with patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key'}):
                    with patch('google.genai.Client') as client_class:
                        generate = client_class.return_value.models.generate_content
                        generate.side_effect = error
                        with self.assertRaises(type(error)):
                            detect_remote(Image.new('RGB', (100, 80)), (100, 80))
                self.assertEqual(generate.call_count, 1)

    def test_remote_overload_does_not_retry_after_budget_expiry(self):
        from google.genai.errors import ClientError
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key'}):
            with patch('google.genai.Client') as client_class:
                generate = client_class.return_value.models.generate_content
                generate.side_effect = ClientError(503, {'message': 'High demand'})
                with patch('backend.src.api.detection_with_fallback.monotonic', side_effect=[0, 0, 45]):
                    with self.assertRaises(ClientError):
                        detect_remote(Image.new('RGB', (100, 80)), (100, 80))
        self.assertEqual(generate.call_count, 1)

    def test_timeout_is_distinguished_in_fallback_response(self):
        with patch('backend.src.api.main.detect_remote', side_effect=httpx.ReadTimeout('Timed out')):
            result = self.upload().json()
        self.assertEqual(result['source'], 'local_yolo')
        self.assertEqual(result['fallback_reason'], 'remote_timeout')

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
    def test_timeout_reason_survives_tunnel_adapter(self):
        from backend.src.api.detection_with_fallback import REMOTE_BUDGET_SECONDS
        with patch('backend.src.inference.tunnel_client.requests.post') as post:
            post.return_value.json.return_value = {
                'detections': [], 'source': 'local_yolo', 'fallback_reason': 'remote_timeout',
            }
            result = predict_tunnel(np.zeros((20, 20), dtype=np.uint8), 'https://example.test/detect')
        self.assertEqual(result['fallback_reason'], 'remote_timeout')
        self.assertGreater(post.call_args.kwargs['timeout'], REMOTE_BUDGET_SECONDS)

    def test_empty_remote_reason_and_request_id_are_preserved(self):
        with patch('backend.src.inference.tunnel_client.requests.post') as post:
            post.return_value.json.return_value = {
                'detections': [], 'source': 'local_yolo',
                'fallback_reason': 'remote_empty', 'request_id': '123abc456def',
            }
            result = predict_tunnel(np.zeros((20, 20), dtype=np.uint8), 'https://example.test/detect')
        self.assertEqual(result['fallback_reason'], 'remote_empty')
        self.assertEqual(result['request_id'], '123abc456def')

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
