"""Keep original coordinates and honest scores across the dashboard adapter."""

from io import BytesIO
import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image

from api.index import app


class DashboardProcessTests(unittest.TestCase):
    def upload(self):
        image = BytesIO()
        Image.new('RGB', (1200, 800), (10, 20, 30)).save(image, format='PNG')
        with TestClient(app) as client:
            return client.post('/api/process', files={
                'file': ('vessel-upload.png', image.getvalue(), 'image/png'),
            })

    def test_remote_boxes_use_original_dimensions_and_qualitative_confidence(self):
        with patch.dict(os.environ, {'DEMO_MODE': 'false', 'INFERENCE_API_URL': 'https://example.test/detect'}):
            with patch('api.index.predict', return_value={
                'source': 'remote_vision', 'fallback_reason': None,
                'request_id': '123abc456def',
                'detections': [{
                    'class': 'aircraft_wreck', 'confidence': None,
                    'confidence_label': 'high', 'bbox': [180, 70, 500, 600],
                }],
            }) as predict:
                response = self.upload()
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual((result['width'], result['height']), (1200, 800))
        self.assertFalse(result['demo_mode'])
        self.assertEqual(result['request_id'], '123abc456def')
        self.assertEqual(result['report'][0]['bbox_px'], [180, 70, 500, 600])
        self.assertIsNone(result['report'][0]['confidence'])
        self.assertEqual(result['report'][0]['confidence_label'], 'high')
        self.assertTrue(result['report'][0]['flagged_for_review'])
        original_bgr = predict.call_args.args[2]
        self.assertEqual(original_bgr.shape, (800, 1200, 3))
        self.assertEqual(original_bgr[0, 0].tolist(), [30, 20, 10])

    def test_local_score_is_preserved_without_contour_adjustment(self):
        with patch.dict(os.environ, {'DEMO_MODE': 'false', 'INFERENCE_API_URL': 'https://example.test/detect'}):
            with patch('api.index.predict', return_value={
                'source': 'local_yolo', 'fallback_reason': 'remote_timeout',
                'request_id': '123abc456def',
                'detections': [{'class': 'marine_anomaly', 'confidence': 0.42,
                                'bbox': [180, 70, 500, 600]}],
            }):
                response = self.upload()
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result['report'][0]['confidence'], 42.0)
        self.assertTrue(result['report'][0]['flagged_for_review'])
        self.assertEqual(result['fallback_reason'], 'remote_timeout')


if __name__ == '__main__':
    unittest.main()
