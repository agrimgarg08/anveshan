"""Preview a Darknet YOLOv4 checkpoint using its supplied configuration."""

import argparse
import json
from pathlib import Path
import time
import zipfile

import cv2
import numpy as np


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--weights', type=Path, required=True)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--conf', type=float, default=0.25)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Choose a new output directory to preserve previous results')
    args.output.mkdir(parents=True)
    # Read only the two known data files; do not execute the bundled notebook.
    with zipfile.ZipFile(args.bundle) as archive:
        config = archive.read('yolov4-custom.txt')
        names = archive.read('obj.names.txt').decode('utf-8-sig').splitlines()
    cfg = args.output / 'yolov4-custom.cfg'
    cfg.write_bytes(config)
    names = [name.strip() for name in names if name.strip()]
    net = cv2.dnn.readNetFromDarknet(str(cfg), str(args.weights))
    net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
    net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
    net_config = config.decode('utf-8').split('[net]', 1)[1].split('[', 1)[0]
    settings = {}
    for row in net_config.splitlines():
        row = row.split('#', 1)[0].strip()
        if '=' in row:
            key, value = row.split('=', 1)
            settings[key.strip()] = value.strip()
    input_size = (int(settings['width']), int(settings['height']))
    sources = sorted(p for p in args.source.iterdir() if p.suffix.lower() in {'.png', '.jpg', '.jpeg'}) if args.source.is_dir() else [args.source]
    summary = []
    for path in sources:
        image = cv2.imread(str(path))
        if image is None:
            raise RuntimeError(f'Cannot read {path}')
        h, w = image.shape[:2]
        blob = cv2.dnn.blobFromImage(image, 1 / 255.0, input_size, swapRB=True, crop=False)
        net.setInput(blob)
        start = time.perf_counter()
        outputs = net.forward(net.getUnconnectedOutLayersNames())
        seconds = time.perf_counter() - start
        boxes, scores, classes = [], [], []
        max_score = 0.0
        for output in outputs:
            for prediction in output:
                # OpenCV's Darknet Region layer already incorporates objectness
                # in its class scores; do not multiply by objectness again.
                if len(prediction[5:]) != len(names):
                    raise RuntimeError('Output classes do not match the supplied class-name file')
                cls = int(np.argmax(prediction[5:]))
                score = float(prediction[5 + cls])
                max_score = max(max_score, score)
                if score < args.conf:
                    continue
                cx, cy, bw, bh = prediction[:4] * np.array([w, h, w, h])
                boxes.append([float(cx - bw/2), float(cy - bh/2), float(bw), float(bh)])
                scores.append(score)
                classes.append(cls)
        kept = []
        for cls in range(len(names)):
            group = [i for i, value in enumerate(classes) if value == cls]
            indices = cv2.dnn.NMSBoxes([boxes[i] for i in group], [scores[i] for i in group], args.conf, 0.45)
            kept.extend(group[int(i)] for i in np.asarray(indices).reshape(-1))
        detections = []
        for i in kept:
            x, y, bw, bh = boxes[i]
            caption = f'{names[classes[i]]} {scores[i]:.2f}'
            color = (0, 255, 0) if classes[i] == 0 else (0, 165, 255)
            cv2.rectangle(image, (round(x), round(y)), (round(x+bw), round(y+bh)), color, 2)
            cv2.putText(image, caption, (max(0, round(x)), max(20, round(y)-5)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)
            detections.append({'class': names[classes[i]], 'confidence': scores[i], 'bbox_xywh': boxes[i]})
        if not cv2.imwrite(str(args.output / f'{path.stem}_annotated.jpg'), image):
            raise RuntimeError('Could not save annotated image')
        summary.append({'source': str(path.resolve()), 'detections': detections, 'max_score': max_score, 'seconds': seconds})
        print(f'{path.name}: {len(detections)} detections at conf={args.conf}; max score={max_score:.4f}; {seconds:.2f}s', flush=True)
    report = {'classes': names, 'input_size': input_size, 'confidence_threshold': args.conf, 'nms_iou': 0.45, 'backend': 'OpenCV CPU', 'weights': str(args.weights.resolve()), 'images': summary}
    (args.output / 'results.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(f'Results: {args.output.resolve()}')


if __name__ == '__main__':
    main()
