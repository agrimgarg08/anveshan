"""Create simple, labelled synthetic side-scan-sonar training examples.

The compositor deliberately adds two sonar-specific cues: an elongated dark
acoustic shadow on the side opposite the sonar source and multiplicative
speckle. It is an augmentation tool, not a substitute for real annotated SSS
data. Review generated images before uploading them to Roboflow.

Example:
    python -m src.synthetic.compose_sonar \
        --background-dir data/raw/backgrounds \
        --object-dir data/raw/object_crops \
        --output-dir data/synthetic/generated \
        --class-id 0 --count 100 --sonar-source left
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, Tuple

import cv2
import numpy as np


IMAGE_EXTENSIONS = {".bmp", ".jpeg", ".jpg", ".png", ".tif", ".tiff"}


def _as_grayscale(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        return image
    if image.shape[2] == 4:
        return cv2.cvtColor(image, cv2.COLOR_BGRA2GRAY)
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def _default_mask(object_crop: np.ndarray) -> np.ndarray:
    """Use transparency when available, otherwise infer a conservative mask."""
    if object_crop.ndim == 3 and object_crop.shape[2] == 4:
        return object_crop[:, :, 3]
    gray = _as_grayscale(object_crop)
    # Object crops are expected to have a relatively uniform background. If
    # they do not, provide a transparent PNG/mask rather than relying on this.
    _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if np.count_nonzero(mask) > mask.size * 0.85:
        mask = cv2.bitwise_not(mask)
    return mask


def _transform_object(
    object_crop: np.ndarray,
    mask: np.ndarray,
    scale: float,
    angle_deg: float,
) -> Tuple[np.ndarray, np.ndarray]:
    """Scale and rotate an object and its mask without cropping the result."""
    gray = _as_grayscale(object_crop)
    height, width = gray.shape[:2]
    scaled_size = (max(1, round(width * scale)), max(1, round(height * scale)))
    gray = cv2.resize(gray, scaled_size, interpolation=cv2.INTER_AREA)
    mask = cv2.resize(mask, scaled_size, interpolation=cv2.INTER_NEAREST)

    height, width = gray.shape[:2]
    center = (width / 2, height / 2)
    matrix = cv2.getRotationMatrix2D(center, angle_deg, 1.0)
    cosine, sine = abs(matrix[0, 0]), abs(matrix[0, 1])
    out_width = max(1, int(height * sine + width * cosine))
    out_height = max(1, int(height * cosine + width * sine))
    matrix[0, 2] += out_width / 2 - center[0]
    matrix[1, 2] += out_height / 2 - center[1]
    return (
        cv2.warpAffine(gray, matrix, (out_width, out_height), flags=cv2.INTER_LINEAR),
        cv2.warpAffine(mask, matrix, (out_width, out_height), flags=cv2.INTER_NEAREST),
    )


def _add_shadow(
    image: np.ndarray,
    mask: np.ndarray,
    top_left: Tuple[int, int],
    sonar_source: str,
    shadow_scale: float,
) -> np.ndarray:
    """Darken an elongated blurred silhouette on the far side of an object."""
    x, y = top_left
    height, width = mask.shape
    direction = 1 if sonar_source == "left" else -1
    shadow_length = max(8, round(width * shadow_scale))
    shift = direction * max(3, round(width * 0.25))

    canvas = np.zeros_like(image, dtype=np.uint8)
    elongated = cv2.resize(mask, (shadow_length, height), interpolation=cv2.INTER_LINEAR)
    shadow_x = x + shift if direction > 0 else x + width - shadow_length + shift
    shadow_y = y + max(0, (height - elongated.shape[0]) // 2)

    x1, y1 = max(0, shadow_x), max(0, shadow_y)
    x2, y2 = min(image.shape[1], shadow_x + elongated.shape[1]), min(image.shape[0], shadow_y + elongated.shape[0])
    if x1 >= x2 or y1 >= y2:
        return image
    sx1, sy1 = x1 - shadow_x, y1 - shadow_y
    canvas[y1:y2, x1:x2] = elongated[sy1:sy1 + (y2 - y1), sx1:sx1 + (x2 - x1)]
    canvas = cv2.GaussianBlur(canvas, (0, 0), sigmaX=5, sigmaY=3)
    result = image.astype(np.float32)
    result -= (canvas.astype(np.float32) / 255.0) * 55.0
    return np.clip(result, 0, 255).astype(np.uint8)


def add_multiplicative_speckle(image: np.ndarray, sigma: float, rng: np.random.Generator) -> np.ndarray:
    """Apply multiplicative Gaussian speckle while retaining an 8-bit image."""
    noise = rng.normal(loc=1.0, scale=sigma, size=image.shape)
    return np.clip(image.astype(np.float32) * noise, 0, 255).astype(np.uint8)


def compose_example(
    background: np.ndarray,
    object_crop: np.ndarray,
    class_id: int,
    *,
    object_mask: np.ndarray | None = None,
    sonar_source: str = "left",
    rng: np.random.Generator | None = None,
) -> Tuple[np.ndarray, str]:
    """Return a composite and one normalized YOLO label line.

    `sonar_source` is either ``left`` or ``right``. The acoustic shadow is
    placed on the opposite side. Object crop alpha is used as its mask when
    available; otherwise a threshold-derived mask is used.
    """
    if sonar_source not in {"left", "right"}:
        raise ValueError("sonar_source must be 'left' or 'right'")
    if class_id < 0:
        raise ValueError("class_id must be non-negative")

    rng = rng or np.random.default_rng()
    base = _as_grayscale(background).copy()
    source_mask = object_mask if object_mask is not None else _default_mask(object_crop)
    scale = float(rng.uniform(0.35, 0.85))
    angle = float(rng.uniform(-25, 25))
    obj, mask = _transform_object(object_crop, source_mask, scale, angle)
    obj_height, obj_width = obj.shape
    height, width = base.shape
    if obj_width >= width - 2 or obj_height >= height - 2:
        raise ValueError("Object crop is too large for this background after transformation")

    x = int(rng.integers(1, width - obj_width))
    y = int(rng.integers(1, height - obj_height))
    base = _add_shadow(base, mask, (x, y), sonar_source, shadow_scale=float(rng.uniform(1.4, 2.5)))

    region = base[y:y + obj_height, x:x + obj_width]
    # Blend targets gently to avoid an unnaturally sharp pasted boundary.
    alpha = (cv2.GaussianBlur(mask, (0, 0), sigmaX=0.8).astype(np.float32) / 255.0)
    contrast_object = cv2.normalize(obj, None, 70, 220, cv2.NORM_MINMAX)
    base[y:y + obj_height, x:x + obj_width] = (
        region * (1.0 - alpha) + contrast_object * alpha
    ).astype(np.uint8)
    composite = add_multiplicative_speckle(base, sigma=float(rng.uniform(0.05, 0.13)), rng=rng)

    x_center = (x + obj_width / 2) / width
    y_center = (y + obj_height / 2) / height
    label = f"{class_id} {x_center:.6f} {y_center:.6f} {obj_width / width:.6f} {obj_height / height:.6f}"
    return composite, label


def _image_paths(directory: Path) -> Iterable[Path]:
    return sorted(path for path in directory.iterdir() if path.suffix.lower() in IMAGE_EXTENSIONS)


def create_dataset(
    background_dir: Path,
    object_dir: Path,
    output_dir: Path,
    class_id: int,
    count: int,
    sonar_source: str,
    seed: int | None,
) -> None:
    """Write matching image/YOLO-label files to `output_dir`."""
    backgrounds, objects = list(_image_paths(background_dir)), list(_image_paths(object_dir))
    if not backgrounds or not objects:
        raise ValueError("Both input directories must contain at least one supported image")
    images_dir, labels_dir = output_dir / "images", output_dir / "labels"
    images_dir.mkdir(parents=True, exist_ok=True)
    labels_dir.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(seed)
    for index in range(count):
        background_path = backgrounds[int(rng.integers(len(backgrounds)))]
        object_path = objects[int(rng.integers(len(objects)))]
        background = cv2.imread(str(background_path), cv2.IMREAD_UNCHANGED)
        obj = cv2.imread(str(object_path), cv2.IMREAD_UNCHANGED)
        if background is None or obj is None:
            raise ValueError(f"Unable to read source image: {background_path} or {object_path}")
        composite, label = compose_example(background, obj, class_id, sonar_source=sonar_source, rng=rng)
        stem = f"synthetic_{index:05d}"
        cv2.imwrite(str(images_dir / f"{stem}.png"), composite)
        (labels_dir / f"{stem}.txt").write_text(label + "\n", encoding="utf-8")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--background-dir", type=Path, required=True)
    parser.add_argument("--object-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--class-id", type=int, required=True)
    parser.add_argument("--count", type=int, default=100)
    parser.add_argument("--sonar-source", choices=("left", "right"), default="left")
    parser.add_argument("--seed", type=int)
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    create_dataset(**vars(args))
