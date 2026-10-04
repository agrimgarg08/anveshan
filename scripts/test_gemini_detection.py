"""Compare Gemini bounding boxes on the same sonar images as Grounding DINO.

Install: .\.venv-inference\Scripts\python.exe -m pip install google-genai
Set GEMINI_API_KEY in the environment, then run:
  .\.venv-inference\Scripts\python.exe scripts\test_gemini_detection.py

Each raw image and HUD-free crop is sent to the Gemini API separately. This
uses API quota. Results and previews are written under runs/.
"""

import argparse
import json
import math
import os
from pathlib import Path
import sys

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
IMAGES = ('sonar_scan_1.png', 'sonar_scan_2.png')
# These crops remove HUD text and some sonar content. Compare shared regions.
CROPS = {
    'sonar_scan_1.png': (170, 110, 1650, 1000),
    'sonar_scan_2.png': (4, 30, 636, 590),
}
PROMPT = """This is a side-scan sonar image. Find visible man-made objects on
the seafloor, such as shipwrecks, pipes, fishing nets or debris. Ignore display
text, menus, sonar nadir, natural texture, shadows by themselves and screen
edges. Include an object only when there is a distinct visible structure.
Return a JSON array of objects, each with keys "label", "confidence" and
"box_2d". Confidence is one of "high", "medium", "low" and is your qualitative
judgment, not a calibrated probability. box_2d is [ymin, xmin, ymax, xmax],
normalized to integers from 0 to 1000 relative to THIS input image. Bound each
object tightly. Return [] when no object is visible. Do not invent objects."""


def convert_detection(item, width, height, offset):
    if not isinstance(item, dict):
        raise ValueError('detection must be an object')
    label = item.get('label')
    confidence = item.get('confidence')
    box = item.get('box_2d')
    if not isinstance(label, str) or not label.strip():
        raise ValueError('missing label')
    if confidence not in ('high', 'medium', 'low'):
        raise ValueError('confidence must be high, medium or low')
    if not isinstance(box, list) or len(box) != 4 or any(
        isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v)
        or not 0 <= v <= 1000 for v in box
    ):
        raise ValueError('invalid normalized box')
    ymin, xmin, ymax, xmax = box
    if ymin >= ymax or xmin >= xmax:
        raise ValueError('empty or reversed box')
    x, y, right, bottom = (xmin * width / 1000, ymin * height / 1000,
                           xmax * width / 1000, ymax * height / 1000)
    return {
        'label': label.strip(), 'confidence': confidence, 'box_2d': box,
        'bbox_xywh': [x, y, right - x, bottom - y],
        'original_bbox_xywh': [x + offset[0], y + offset[1], right - x, bottom - y],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', default='gemini-3.8-flash')
    parser.add_argument('--output', type=Path, default=ROOT / 'runs' / 'gemini_preview_01')
    args = parser.parse_args()

    api_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
    if not api_key:
        parser.error('Set GEMINI_API_KEY in this terminal first. Do not put it in the script.')
    if args.output.exists():
        parser.error('Choose a new --output directory to preserve existing results.')
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        parser.error('Install the current SDK: .\\.venv-inference\\Scripts\\python.exe -m pip install google-genai')

    client = genai.Client(api_key=api_key)
    report = {
        'model': args.model, 'prompt': PROMPT,
        'note': 'Gemini qualitative confidence is not calibrated accuracy. Crops discard margins.',
        'images': [],
    }
    args.output.mkdir(parents=True)
    for name in IMAGES:
        source = ROOT / 'assets' / 'test_images' / name
        if not source.is_file():
            print(f'Missing image: {source}', file=sys.stderr)
            continue
        with Image.open(source) as opened:
            original = opened.convert('RGB')
        crop = CROPS[name]
        if not (0 <= crop[0] < crop[2] <= original.width and 0 <= crop[1] < crop[3] <= original.height):
            raise ValueError(f'Crop out of bounds for {name}: {crop}')
        variants = (('raw', (0, 0, original.width, original.height)), ('cropped', crop))
        for variant, bounds in variants:
            image = original.crop(bounds)
            entry = {'source': str(source), 'variant': variant, 'crop_xyxy': bounds,
                     'input_size': image.size, 'detections': [], 'rejected': []}
            report['images'].append(entry)
            print(f'Calling {args.model}: {name} [{variant}]', flush=True)
            try:
                response = client.models.generate_content(
                    model=args.model,
                    contents=[image, PROMPT],
                    config=types.GenerateContentConfig(response_mime_type='application/json'),
                )
                raw_text = response.text or ''
                entry['raw_response'] = raw_text
                items = json.loads(raw_text)
                if not isinstance(items, list):
                    raise ValueError('response must be a JSON array')
                for index, item in enumerate(items):
                    try:
                        entry['detections'].append(convert_detection(item, image.width, image.height, bounds))
                    except ValueError as error:
                        entry['rejected'].append({'index': index, 'reason': str(error), 'value': item})
                annotated = image.copy()
                draw = ImageDraw.Draw(annotated)
                for detection in entry['detections']:
                    x, y, w, h = detection['bbox_xywh']
                    draw.rectangle((x, y, x + w, y + h), outline='lime', width=3)
                    draw.text((x, max(y - 15, 0)),
                              f"{detection['label']} ({detection['confidence']})",
                              fill='yellow', stroke_width=1, stroke_fill='black')
                annotated.save(args.output / f'{source.stem}_{variant}_annotated.jpg', quality=95)
                print(f"  {len(entry['detections'])} valid boxes, {len(entry['rejected'])} rejected")
            except Exception as error:
                entry['error'] = f'{type(error).__name__}: {error}'
                print(f"  Failed: {entry['error']}", file=sys.stderr)
            (args.output / 'results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(f'Results saved to {args.output.resolve()}')


if __name__ == '__main__':
    main()
