"""Tunnel API adapter for Anveshan detections."""

import cv2
import requests
import numpy as np

def predict(image: np.ndarray, api_url: str, original_image: np.ndarray | None = None) -> dict:
    """Send processed and optional original sonar images to the inference API."""
    if not api_url:
        raise ValueError("INFERENCE_API_URL is required.")
    
    success, encoded = cv2.imencode(".jpg", image)
    if not success:
        raise RuntimeError("Could not encode image for tunnel inference.")
        
    files = {"file": ("image.jpg", encoded.tobytes(), "image/jpeg")}
    if original_image is not None:
        success, original_encoded = cv2.imencode('.png', original_image)
        if not success:
            raise RuntimeError('Could not encode original image for inference.')
        files['original'] = ('original.png', original_encoded.tobytes(), 'image/png')
    # Leave room for the remote call and a cold local-model fallback.
    response = requests.post(api_url, files=files, timeout=75.0)
    response.raise_for_status()

    payload = response.json()
    if not isinstance(payload, dict) or not isinstance(payload.get('detections'), list):
        raise ValueError('Inference API returned an invalid detection response.')
    # Normalize older server responses before they reach reports or exports.
    source = payload.get('source', 'local_yolo')
    source = source if source in {'local_yolo', 'demo'} else 'remote_vision'
    reason = payload.get('fallback_reason')
    if reason is not None:
        if isinstance(reason, str) and reason.startswith('invalid_'):
            reason = 'invalid_remote_response'
        elif isinstance(reason, str) and '_http_' in reason and reason.rsplit('_http_', 1)[1].isdigit():
            reason = 'remote_http_' + reason.rsplit('_http_', 1)[1]
        elif reason not in {'missing_api_key', 'remote_empty', 'remote_timeout'}:
            reason = 'remote_inference_error'
    return {
        'detections': payload['detections'],
        'source': source,
        'fallback_reason': reason,
        'request_id': payload.get('request_id'),
    }
