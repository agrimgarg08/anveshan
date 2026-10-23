"""Remote image detection with validated boxes and qualitative confidence.

The caller owns the local YOLO fallback so it can reuse its model lock and
prediction settings. Detections use coordinates in the requested output space.
"""

import json
import math
import os
import re
from time import monotonic, sleep
from urllib.parse import quote

from PIL import Image

REMOTE_BUDGET_SECONDS = 45.0
DEFAULT_REMOTE_MODEL = 'gemini-3.5-flash-lite'


LABELS = (
    "shipwreck", "aircraft_wreck", "pipe_or_cable", "fishing_net",
    "debris", "unknown_manmade",
)

PROMPT = """Inspect this side-scan sonar image for distinct man-made objects
lying on the seafloor. Possible objects include shipwrecks, aircraft wrecks,
long pipes or cables, fishing nets, and discrete debris. Sonar shadows can help
locate an object, but do not box a shadow, bright patch, texture change, or
isolated speck by itself. Do not force a detection or infer a specific object
type when the visible evidence is ambiguous; use unknown_manmade only when a
distinct object is visible but its type is unclear. Ignore screen graphics.

Return every distinct visible object with a tight box. Confidence is a
qualitative visual judgment, not an accuracy percentage. Coordinates are
[ymin, xmin, ymax, xmax] normalized from 0 to 1000 relative to the full image.
Return an empty array when no distinct object is visible."""

RESPONSE_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "label": {"type": "string", "enum": list(LABELS)},
            "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
            "box_2d": {
                "type": "array", "items": {"type": "integer"},
                "minItems": 4, "maxItems": 4,
            },
        },
        "required": ["label", "confidence", "box_2d"],
    },
}


def detect_remote(image: Image.Image, output_size: tuple[int, int]) -> list[dict]:
    """Return boxes in output_size pixels; raise on API or response failure."""
    key = os.getenv('GEMINI_API_KEY', '').strip()
    if not key:
        raise RuntimeError('missing_api_key')

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=key)
    model = os.getenv('GEMINI_MODEL', DEFAULT_REMOTE_MODEL)
    # Lower reasoning effort reduces latency for the interactive request.
    # Detection quality still needs separate validation. Preserve older
    # models' configuration when selected explicitly by the operator.
    thinking = (types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW)
                if model.startswith(('gemini-3', 'gemini-4')) else None)
    deadline = monotonic() + REMOTE_BUDGET_SECONDS
    try:
        for attempt in range(2):
            remaining = deadline - monotonic()
            if remaining <= 0:
                raise TimeoutError('Remote inference time budget exhausted')
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=[PROMPT, image],
                    config=types.GenerateContentConfig(
                        thinking_config=thinking,
                        response_mime_type='application/json',
                        response_json_schema=RESPONSE_SCHEMA,
                        http_options=types.HttpOptions(
                            timeout=max(1, int(remaining * 1000)),
                            # Keep retries here so they share a time budget.
                            retry_options=types.HttpRetryOptions(attempts=1),
                        ),
                    ),
                )
                break
            except Exception as error:
                # Retry only explicit temporary overloads. Auth/quota errors
                # and requests with an unknown timeout outcome go to fallback.
                if (getattr(error, 'code', None) != 503 or attempt != 0
                        or deadline - monotonic() <= 1):
                    raise
                sleep(1)
    finally:
        client.close()
    items = json.loads(response.text or '')
    if not isinstance(items, list):
        raise ValueError('Detection response must be a JSON array')

    width, height = output_size
    detections = []
    for item in items:
        if not isinstance(item, dict):
            raise ValueError('Detection must be an object')
        label, confidence, box = item.get('label'), item.get('confidence'), item.get('box_2d')
        if label not in LABELS or confidence not in {'high', 'medium', 'low'}:
            raise ValueError('Detection has an invalid label or confidence')
        if not isinstance(box, list) or len(box) != 4 or any(
            isinstance(value, bool) or not isinstance(value, (int, float))
            or not math.isfinite(value) or value < 0 or value > 1000 for value in box
        ):
            raise ValueError('Detection has invalid coordinates')
        ymin, xmin, ymax, xmax = box
        if xmin >= xmax or ymin >= ymax:
            raise ValueError('Detection has an empty box')
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
    if isinstance(error, TimeoutError) or (
        type(error).__module__.split('.')[0] in {'httpx', 'httpx2'}
        and type(error).__name__ in {'ReadTimeout', 'ConnectTimeout', 'WriteTimeout', 'PoolTimeout'}
    ):
        return 'remote_timeout'
    status = getattr(error, 'code', None)
    if isinstance(status, int):
        return f'remote_http_{status}'
    if isinstance(error, (json.JSONDecodeError, ValueError)):
        return 'invalid_remote_response'
    return 'remote_inference_error'


def remote_error_summary(error: Exception) -> str:
    """Return bounded, redacted diagnostics for the local server log only."""
    message = getattr(error, 'message', None)
    if not isinstance(message, str):
        # Do not stringify SDK errors: their repr contains the entire response.
        message = str(error) if isinstance(error, ValueError) else type(error).__name__
    key = os.getenv('GEMINI_API_KEY', '').strip()
    if key:
        for value in {key, quote(key, safe='')}:
            message = message.replace(value, '[REDACTED]')
    message = re.sub(r'AIza[\w-]{20,}', '[REDACTED]', message)
    message = re.sub(r'(?i)([?&]key=)[^&\s\"\']+', r'\1[REDACTED]', message)
    message = re.sub(r'(?i)((?:x-goog-api-key|authorization)\s*[:=]\s*)[^\r\n,]+',
                     r'\1[REDACTED]', message)
    message = re.sub(r'[A-Za-z0-9+/=_-]{100,}', '[long value redacted]', message)
    details = getattr(error, 'details', {})
    body = details.get('error', details) if isinstance(details, dict) else {}
    reasons = body.get('details', []) if isinstance(body, dict) else []
    if not isinstance(reasons, list):
        reasons = []
    reason = next((item.get('reason') for item in reasons
                   if isinstance(item, dict) and isinstance(item.get('reason'), str)), None)
    status = getattr(error, 'status', None)
    code = getattr(error, 'code', None)
    summary = {
        'code': code if isinstance(code, int) else None,
        'status': status if isinstance(status, str) and re.fullmatch(r'[A-Z_]{1,64}', status) else None,
        'reason': reason if reason and re.fullmatch(r'[A-Z_]{1,64}', reason) else None,
        'message': message[:800],
    }
    return json.dumps(summary, ensure_ascii=True)
