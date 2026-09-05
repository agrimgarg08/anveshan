"""
clean_sonar.py

Preprocessing pipeline for raw side-scan sonar (SSS) tiles.

Handles the core acoustic-imagery challenges called out in the problem
statement: high speckle noise, varying resolutions, and data dropouts
(the blank nadir-gap stripe down the middle of most SSS tiles).

Usage:
    from clean_sonar import clean
    cleaned = clean(raw_image)

Or run standalone to preview before/after on a sample image:
    python clean_sonar.py path/to/sample.png
"""

import cv2
import numpy as np


def reduce_speckle(image: np.ndarray, method: str = "median") -> np.ndarray:
    """Reduce speckle (grainy acoustic) noise.

    method: "median" (fast, good baseline) or "nlm" (slower, higher quality).
    """
    if method == "nlm":
        return cv2.fastNlMeansDenoising(image, h=10)
    return cv2.medianBlur(image, 5)


def enhance_contrast(image: np.ndarray) -> np.ndarray:
    """CLAHE contrast enhancement — sonar returns are often low-contrast,
    this makes weak/faint returns visible without blowing out strong ones."""
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(image)


def mask_nadir_gap(image: np.ndarray, variance_threshold: float = 5.0) -> np.ndarray:
    """Detect and mask the blank nadir-gap stripe (directly under the tow
    path, where SSS has no return). Identified as a low-variance vertical
    band near image center. Masked to mid-gray so the model doesn't learn
    it as a feature, rather than leaving it as a hard black stripe.
    """
    h, w = image.shape[:2]
    col_variance = image.astype(np.float64).var(axis=0)
    low_var_cols = np.where(col_variance < variance_threshold)[0]

    out = image.copy()
    if len(low_var_cols) > 0:
        # only mask if it's a contiguous-ish band near the center, not scattered noise
        center = w // 2
        near_center = low_var_cols[np.abs(low_var_cols - center) < w * 0.15]
        if len(near_center) > 0:
            out[:, near_center] = 128  # neutral gray, not a hard edge
    return out


def resize_normalize(image: np.ndarray, size: int = 640) -> np.ndarray:
    """Resize to a consistent input size for YOLO. If you have slant-range
    metadata available later, replace this with a pixel-per-meter resample
    instead of a flat resize."""
    return cv2.resize(image, (size, size), interpolation=cv2.INTER_AREA)


def clean(image: np.ndarray, target_size: int = 640) -> np.ndarray:
    """Full preprocessing pipeline: despeckle -> contrast -> nadir mask -> resize.

    Expects a grayscale image (single channel). If you load a color image,
    convert first: cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    """
    if len(image.shape) == 3:
        image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    out = reduce_speckle(image)
    out = enhance_contrast(out)
    out = mask_nadir_gap(out)
    out = resize_normalize(out, target_size)
    return out


if __name__ == "__main__":
    import sys
    import os

    if len(sys.argv) < 2:
        print("Usage: python clean_sonar.py path/to/sample_image.png")
        sys.exit(1)

    path = sys.argv[1]
    img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        print(f"Could not read image at {path}")
        sys.exit(1)

    cleaned = clean(img)

    out_dir = "data/processed/preview"
    os.makedirs(out_dir, exist_ok=True)
    base = os.path.splitext(os.path.basename(path))[0]

    cv2.imwrite(f"{out_dir}/{base}_before.png", img)
    cv2.imwrite(f"{out_dir}/{base}_after.png", cleaned)
    print(f"Saved before/after to {out_dir}/ — use these for your slides.")
