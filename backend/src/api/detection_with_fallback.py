"""Gemini image detection with validated boxes and qualitative confidence.

The caller owns the local YOLO fallback so it can reuse its model lock and
prediction settings. Gemini returns coordinates in the processed image space.
"""

import json
import math
import os

from PIL import Image


PROMPT = """This is a side-scan sonar image. Find visible man-made objects on
the seafloor, such as shipwrecks, pipes, fishing nets or debris. Ignore display
text, menus, sonar nadir, natural texture, shadows by themselves and screen
edges. Include an object only when there is a distinct visible structure.
Return a JSON array of objects, each with keys \"label\", \"confidence\" and
\"box_2d\". Confidence is one of \"high\", \"medium\", \"low\" and is a
qualitative judgment, not a calibrated probability. box_2d is
[ymin, xmin, ymax, xmax], normalized to 0-1000 relative to this image.
Bound each object tightly. Return [] when no object is visible."""


def detect_gemini(image: Image.Image, output_size: tuple[int, int]) -> list[dict]:
    """Return boxes in output_size pixels; raise on API or response failure."""
    key = os.getenv('GEMINI_API_KEY', '').strip()
    if not key:
        raise RuntimeError('missing_api_key')

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=key)
    try:
        response = client.models.generate_content(
            model=os.getenv('GEMINI_MODEL', 'gemini-3.8-flash'),
            contents=[image, PROMPT],
            config=types.GenerateContentConfig(
                response_mime_type='application/json',
                http_options=types.HttpOptions(timeout=15_000),
            ),
        )
    finally:
        client.close()
    items = json.loads(response.text or '')
    if not isinstance(items, list):
        raise ValueError('Gemini response must be a JSON array')

    width, height = output_size
    detections = []
    for item in items:
        if not isinstance(item, dict):
            raise ValueError('Gemini detection must be an object')
        label, confidence, box = item.get('label'), item.get('confidence'), item.get('box_2d')
        if not isinstance(label, str) or not label.strip() or confidence not in {'high', 'medium', 'low'}:
            raise ValueError('Gemini detection has an invalid label or confidence')
        if not isinstance(box, list) or len(box) != 4 or any(
            isinstance(value, bool) or not isinstance(value, (int, float))
            or not math.isfinite(value) or value < 0 or value > 1000 for value in box
        ):
            raise ValueError('Gemini detection has invalid coordinates')
        ymin, xmin, ymax, xmax = box
        if xmin >= xmax or ymin >= ymax:
            raise ValueError('Gemini detection has an empty box')
        detections.append({
            'class': label.strip(), 'confidence': None,
            'confidence_label': confidence,
            'bbox': [xmin * width / 1000, ymin * height / 1000,
                     (xmax - xmin) * width / 1000, (ymax - ymin) * height / 1000],
        })
    return detections


def fallback_reason(error: Exception) -> str:
    """Expose a useful reason without reflecting raw provider text or secrets."""
    if isinstance(error, RuntimeError) and str(error) == 'missing_api_key':
        return 'missing_api_key'
    status = getattr(error, 'code', None)
    if isinstance(status, int):
        return f'gemini_http_{status}'
    if isinstance(error, (json.JSONDecodeError, ValueError)):
        return 'invalid_gemini_response'
    return type(error).__name__
