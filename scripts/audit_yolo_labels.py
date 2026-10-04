"""Draw existing YOLO labels on a reproducible sample without modifying the dataset."""

import argparse
import math
from pathlib import Path
import random

from PIL import Image, ImageDraw, ImageOps


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--split', type=Path, required=True, help='Folder containing images/ and labels/')
    parser.add_argument('--output', type=Path, required=True, help='New folder for annotated previews')
    parser.add_argument('--count', type=int, default=40)
    parser.add_argument('--seed', type=int, default=42)
    args = parser.parse_args()
    if args.count < 1:
        parser.error('--count must be positive')
    if args.output.exists():
        parser.error('Output already exists. Choose a new --output folder to preserve prior reviews.')
    image_dir, label_dir = args.split / 'images', args.split / 'labels'
    if not image_dir.is_dir() or not label_dir.is_dir():
        parser.error('The split must contain images/ and labels/ folders')
    files = sorted(p for p in image_dir.rglob('*') if p.suffix.lower() in {'.jpg', '.jpeg', '.png'})
    if not files:
        parser.error('No images found')
    rng = random.Random(args.seed)
    labeled, empty, missing = [], [], []
    for path in files:
        label = label_dir / path.relative_to(image_dir).with_suffix('.txt')
        if not label.is_file():
            missing.append(path)
        elif label.read_text(encoding='utf-8').strip():
            labeled.append(path)
        else:
            empty.append(path)
    # Include background examples deliberately; fill the rest from labeled images.
    selected = rng.sample(empty, min(len(empty), args.count // 4))
    selected += rng.sample(labeled, min(len(labeled), args.count - len(selected)))
    remaining = [p for p in files if p not in selected]
    selected += rng.sample(remaining, min(len(remaining), args.count - len(selected)))
    rng.shuffle(selected)
    args.output.mkdir(parents=True)
    report = [f'Images: {len(files)}; labeled: {len(labeled)}; empty: {len(empty)}; missing labels: {len(missing)}',
              'These boxes are dataset annotations, not model predictions.',
              'Empty labels can be intentional background or excluded ambiguous objects.']
    thumbs = []
    for index, path in enumerate(selected, 1):
        label = label_dir / path.relative_to(image_dir).with_suffix('.txt')
        with Image.open(path) as original:
            image = original.convert('RGB')
        width, height = image.size
        draw = ImageDraw.Draw(image)
        rows = label.read_text(encoding='utf-8').splitlines() if label.is_file() else []
        issues, boxes = [], 0
        if not label.is_file():
            issues.append('missing label')
        for line_number, row in enumerate(rows, 1):
            if not row.strip():
                continue
            try:
                values = list(map(float, row.split()))
                if len(values) != 5 or not all(math.isfinite(v) for v in values):
                    raise ValueError('expected five finite values')
                cls, cx, cy, bw, bh = values
                if cls != 0 or not (0 <= cx <= 1 and 0 <= cy <= 1 and 0 < bw <= 1 and 0 < bh <= 1):
                    raise ValueError('invalid class or normalized coordinates')
                x1, y1, x2, y2 = cx-bw/2, cy-bh/2, cx+bw/2, cy+bh/2
                if min(x1, y1) < -0.00001 or max(x2, y2) > 1.00001:
                    issues.append(f'line {line_number}: box crosses image edge')
                bounds = (x1*width, y1*height, x2*width, y2*height)
                draw.rectangle(bounds, outline='lime', width=max(2, width//400))
                draw.text((max(0, bounds[0]), max(0, bounds[1])), str(line_number), fill='yellow', stroke_width=1, stroke_fill='black')
                boxes += 1
            except ValueError as error:
                issues.append(f'line {line_number}: {error}')
        stem = f'{index:02d}'
        image.save(args.output / f'{stem}_annotated.png')
        caption = f'{stem}: {boxes} boxes' + (' | CHECK REPORT' if issues else '')
        thumb = Image.new('RGB', (480, 510), 'white')
        thumb.paste(ImageOps.contain(image, (480, 480)), (0, 30))
        ImageDraw.Draw(thumb).text((8, 8), caption, fill='black')
        thumbs.append(thumb)
        report.append(f'{stem}: {path}\n  {boxes} boxes; ' + ('; '.join(issues) if issues else 'format OK'))
    for start in range(0, len(thumbs), 6):
        page = Image.new('RGB', (960, 1530), '#dddddd')
        for offset, thumb in enumerate(thumbs[start:start+6]):
            page.paste(thumb, ((offset % 2)*480, (offset // 2)*510))
        page.save(args.output / f'sheet_{start//6+1:02d}.jpg', quality=95)
    (args.output / 'report.txt').write_text('\n'.join(report), encoding='utf-8')
    print(report[0])
    print(f'Annotated {len(selected)} samples in {args.output.resolve()}')
    print('Open sheet_*.jpg for an overview, individual PNGs for detail, and report.txt for filenames/issues.')


if __name__ == '__main__':
    main()
