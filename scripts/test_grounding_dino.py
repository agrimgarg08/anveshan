"""Compare raw sonar screenshots and explicit HUD-free crops with Grounding DINO.

Run from any folder with the project's inference Python. Generated previews and
JSON go under runs/. No dataset labels or source images are modified.
"""

import argparse
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
DEPS = ROOT / '.tools' / 'grounding-dino-deps'
if DEPS.is_dir():
    sys.path.insert(0, str(DEPS))
os.environ.setdefault('HF_HOME', str(ROOT / '.tools' / 'grounding-dino-cache'))

MODEL = 'IDEA-Research/grounding-dino-tiny'
PROMPTS = ['shipwreck', 'pipe', 'fishing net', 'debris']
# Hand-selected margins remove HUD text but also discard some sonar content.
# Boxes in the JSON include both crop-relative and original-image coordinates.
CROPS = {
    'sonar_scan_1.png': (170, 110, 1650, 1000),
    'sonar_scan_2.png': (4, 30, 636, 590),
}


def box_iou(a, b):
    intersection = max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))
    area_a = max(0, a[2] - a[0]) * max(0, a[3] - a[1])
    area_b = max(0, b[2] - b[0]) * max(0, b[3] - b[1])
    union = area_a + area_b - intersection
    return intersection / union if union > 0 else 0.0


def filter_detections(detections, width, height, max_area, min_score, overlap_iou):
    kept, rejected = [], []
    for detection in sorted(detections, key=lambda item: item['score'], reverse=True):
        box = detection['bbox_xyxy']
        area_fraction = max(0, box[2] - box[0]) * max(0, box[3] - box[1]) / (width * height)
        reason = None
        if area_fraction > max_area:
            reason = 'area_exceeds_limit'
        elif detection['score'] < min_score:
            reason = 'score_below_floor'
        elif any(other['label'] != detection['label'] and box_iou(box, other['bbox_xyxy']) > overlap_iou for other in kept):
            reason = 'overlaps_higher_scoring_different_label'
        if reason:
            rejected.append({**detection, 'area_fraction': area_fraction, 'reason': reason})
        else:
            kept.append(detection)
    return kept, rejected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'runs' / 'grounding_dino_preview_01')
    parser.add_argument('--box-threshold', type=float, default=0.25)
    parser.add_argument('--text-threshold', type=float, default=0.25)
    parser.add_argument('--max-area-fraction', type=float, default=0.65)
    parser.add_argument('--confidence-floor', type=float, default=0.5)
    parser.add_argument('--cross-label-iou', type=float, default=0.5)
    parser.add_argument('--device', choices=['auto', 'cpu', 'cuda'], default='auto')
    args = parser.parse_args()
    if not all(0 <= v <= 1 for v in (args.box_threshold, args.text_threshold, args.max_area_fraction, args.confidence_floor, args.cross_label_iou)):
        parser.error('Thresholds must lie between 0 and 1')
    if args.output.exists():
        parser.error('Choose a new --output directory to preserve existing results')
    from PIL import Image, ImageDraw
    import torch
    import transformers
    from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection

    device = ('cuda' if torch.cuda.is_available() else 'cpu') if args.device == 'auto' else args.device
    if device == 'cuda' and not torch.cuda.is_available():
        parser.error('CUDA is unavailable; use --device cpu')
    paths = [ROOT / 'assets' / 'test_images' / name for name in CROPS]
    for path in paths:
        if not path.is_file():
            parser.error(f'Missing source image: {path}')
    print(f'Loading {MODEL} on {device} ...', flush=True)
    processor = AutoProcessor.from_pretrained(MODEL)
    model = AutoModelForZeroShotObjectDetection.from_pretrained(MODEL).to(device).eval()
    prompt = '. '.join(PROMPTS) + '.'
    args.output.mkdir(parents=True)
    report = {
        'model': MODEL, 'revision': getattr(model.config, '_commit_hash', None),
        'transformers': transformers.__version__, 'device': device,
        'prompt': prompt, 'box_threshold': args.box_threshold,
        'text_threshold': args.text_threshold,
        'filters': {'max_area_fraction': args.max_area_fraction, 'confidence_floor': args.confidence_floor, 'cross_label_iou': args.cross_label_iou},
        'note': 'Scores are grounding scores, not accuracy. Crops discard image margins; compare shared content.',
        'images': [],
    }
    for path in paths:
        with Image.open(path) as opened:
            original = opened.convert('RGB')
        crop = CROPS[path.name]
        if not (0 <= crop[0] < crop[2] <= original.width and 0 <= crop[1] < crop[3] <= original.height):
            raise ValueError(f'Crop out of bounds for {path.name}: {crop}, image size={original.size}')
        for variant, bounds in [('raw', (0, 0, original.width, original.height)), ('cropped', crop)]:
            image = original.crop(bounds)
            image.save(args.output / f'{path.stem}_{variant}_input.png')
            inputs = processor(images=image, text=prompt, return_tensors='pt').to(device)
            if device == 'cuda':
                torch.cuda.synchronize()
            start = time.perf_counter()
            with torch.inference_mode():
                outputs = model(**inputs)
            if device == 'cuda':
                torch.cuda.synchronize()
            seconds = time.perf_counter() - start
            results = processor.post_process_grounded_object_detection(
                outputs, inputs.input_ids, threshold=args.box_threshold,
                text_threshold=args.text_threshold, target_sizes=[(image.height, image.width)],
            )[0]
            # Transformers 4.57 uses text_labels for decoded phrases.
            labels = results.get('text_labels', results.get('labels'))
            detections = []
            annotated = image.copy()
            draw = ImageDraw.Draw(annotated)
            for box, score, label in zip(results['boxes'], results['scores'], labels):
                xyxy = [float(value) for value in box.tolist()]
                full_box = [xyxy[0]+bounds[0], xyxy[1]+bounds[1], xyxy[2]+bounds[0], xyxy[3]+bounds[1]]
                detections.append({'label': str(label), 'score': float(score.item()), 'bbox_xyxy': xyxy, 'original_bbox_xyxy': full_box})
            raw_detections = detections
            detections, rejected = filter_detections(raw_detections, image.width, image.height, args.max_area_fraction, args.confidence_floor, args.cross_label_iou)
            for detection in detections:
                xyxy = detection['bbox_xyxy']
                # Clamp only drawing coordinates; retain model output in JSON.
                display_box = [max(0, min(image.width, xyxy[0])), max(0, min(image.height, xyxy[1])), max(0, min(image.width, xyxy[2])), max(0, min(image.height, xyxy[3]))]
                draw.rectangle(display_box, outline='lime', width=3)
                draw.text((display_box[0], display_box[1]), f"{detection['label']} {detection['score']:.2f}", fill='yellow', stroke_width=1, stroke_fill='black')
            annotated.save(args.output / f'{path.stem}_{variant}_annotated.jpg', quality=95)
            max_score = float(outputs.logits.sigmoid().amax().item())
            report['images'].append({'source': str(path), 'variant': variant, 'crop_xyxy': list(bounds), 'input_size': list(image.size), 'max_query_token_score': max_score, 'seconds': seconds, 'raw_detections': raw_detections, 'rejected_detections': rejected, 'detections': detections})
            (args.output / 'results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
            print(f'{path.name} [{variant}]: {len(raw_detections)} raw -> {len(detections)} filtered detections; {seconds:.2f}s', flush=True)
            for detection in detections:
                print(f"  {detection['label']}: {detection['score']:.3f} {detection['bbox_xyxy']}", flush=True)
    print(f'Results saved to {args.output.resolve()}', flush=True)


if __name__ == '__main__':
    main()
