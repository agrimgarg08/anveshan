"""Remote inference with a local YOLO fallback."""

from contextlib import asynccontextmanager
from io import BytesIO
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
from threading import Lock
from tempfile import gettempdir
from time import perf_counter
from uuid import uuid4

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

from .detection_with_fallback import (
    DEFAULT_REMOTE_MODEL, detect_remote, fallback_reason, remote_error_summary,
)

CLASSES = {0: "marine_anomaly"}
ROOT = Path(__file__).resolve().parents[2]
MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 16_000_000
INFERENCE_REVISION = '2026-10-23.5'
logger = logging.getLogger("uvicorn.error")


def load_model(path):
    from ultralytics import YOLO

    return YOLO(str(path))


def create_app(model_loader=load_model):
    @asynccontextmanager
    async def lifespan(app):
        path = Path(os.getenv("MODEL_PATH", str(ROOT / "models/weights/best.pt")))
        if not path.is_file():
            raise RuntimeError(f"Missing trained weights: {path}. Train and copy best.pt first.")
        app.state.model_path = path
        app.state.model_loader = model_loader
        app.state.model = None
        app.state.device = os.getenv("YOLO_DEVICE", "cpu")
        app.state.lock = Lock()
        diagnostics = logging.Logger('anveshan.inference.diagnostics', logging.WARNING)
        diagnostics.addHandler(logging.NullHandler())
        handler = None
        try:
            log_path = Path(os.getenv('INFERENCE_ERROR_LOG',
                                     str(Path(gettempdir()) / 'anveshan-inference-errors.log')))
            handler = RotatingFileHandler(log_path, maxBytes=256_000, backupCount=1,
                                          encoding='utf-8')
            handler.setFormatter(logging.Formatter('%(asctime)s %(message)s'))
            diagnostics.addHandler(handler)
        except OSError:
            logger.warning('Local diagnostic file is unavailable; using terminal logging.')
        app.state.diagnostics = diagnostics
        try:
            yield
        finally:
            app.state.model = None
            if handler is not None:
                handler.close()

    app = FastAPI(title="Anveshan inference", lifespan=lifespan)
    origins = [value.strip() for value in os.getenv("CORS_ORIGINS", "").split(",") if value.strip()]
    if origins:
        app.add_middleware(
            CORSMiddleware, allow_origins=origins,
            allow_methods=["POST", "GET"], allow_headers=["Content-Type"],
        )

    @app.get("/health")
    def health():
        return {"status": "ok", "classes": list(CLASSES.values()),
                "revision": INFERENCE_REVISION}

    @app.post("/detect")
    def detect(file: UploadFile = File(...), original: UploadFile | None = File(None)):
        """Return boxes in the original image's pixel coordinates when supplied."""
        started = perf_counter()
        request_id = uuid4().hex[:12]
        content = file.file.read(MAX_BYTES + 1)
        if len(content) > MAX_BYTES:
            raise HTTPException(413, "Image exceeds 10 MiB")
        try:
            with Image.open(BytesIO(content)) as image:
                if image.format not in {"JPEG", "PNG"}:
                    raise HTTPException(415, "Use a PNG or JPEG image")
                width, height = image.size
                if width * height > MAX_PIXELS:
                    raise HTTPException(413, "Image exceeds 16 million pixels")
                processed = image.convert("RGB")
        except Image.DecompressionBombError:
            raise HTTPException(413, "Image is too large") from None
        except (UnidentifiedImageError, OSError, ValueError):
            raise HTTPException(400, "Invalid or corrupt image") from None

        remote_image = processed
        if original is not None:
            original_content = original.file.read(MAX_BYTES + 1)
            if len(original_content) > MAX_BYTES:
                raise HTTPException(413, "Original image exceeds 10 MiB")
            try:
                with Image.open(BytesIO(original_content)) as image:
                    if image.format not in {"JPEG", "PNG"}:
                        raise HTTPException(415, "Use a PNG or JPEG original image")
                    if image.width * image.height > MAX_PIXELS:
                        raise HTTPException(413, "Original image exceeds 16 million pixels")
                    remote_image = image.convert("RGB")
            except Image.DecompressionBombError:
                raise HTTPException(413, "Original image is too large") from None
            except (UnidentifiedImageError, OSError, ValueError):
                raise HTTPException(400, "Invalid or corrupt original image") from None

        output_width, output_height = remote_image.size
        fallback = None
        try:
            detections = detect_remote(remote_image, (output_width, output_height))
            if detections:
                payload = {
                    "detections": detections,
                    "image": {"width": output_width, "height": output_height},
                    "source": "remote_vision", "fallback_reason": None,
                    "request_id": request_id,
                }
                logger.info(
                    "inference request_id=%s source=remote_vision detections=%d elapsed_ms=%d input=%dx%d",
                    request_id, len(detections), int((perf_counter() - started) * 1000),
                    remote_image.width, remote_image.height,
                )
                return payload
            fallback = "remote_empty"
        except Exception as error:
            fallback = fallback_reason(error)
            if fallback != 'missing_api_key':
                # Redacted upstream details stay in local diagnostics, never in
                # the public response, dashboard, or exported reports.
                summary = remote_error_summary(error)
                logger.warning('inference request_id=%s remote_error=%s',
                               request_id, summary)
                model_name = os.getenv('GEMINI_MODEL', DEFAULT_REMOTE_MODEL)
                # Keep internal model configuration in private diagnostics.
                if not all(char.isalnum() or char in '-._' for char in model_name):
                    model_name = 'custom_model'
                app.state.diagnostics.warning('request_id=%s remote_model=%s remote_error=%s',
                                              request_id, model_name[:100], summary)

        # Ultralytics predictors hold mutable state; serialize loading and inference.
        with app.state.lock:
            if app.state.model is None:
                model = app.state.model_loader(app.state.model_path)
                if model.names != CLASSES:
                    raise HTTPException(503, f"Model classes must be exactly {CLASSES}; got {model.names}")
                app.state.model = model
            # Inference on the same unaltered pixels sent to the remote detector
            # avoids losing structure through the contrast/resize preprocessing.
            bgr = np.array(remote_image)[:, :, ::-1].copy()
            result = app.state.model.predict(
                source=bgr, device=app.state.device, conf=0.25, iou=0.7,
                imgsz=640, max_det=300, verbose=False,
            )[0]
            detections = []
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append({
                    "class": CLASSES[int(box.cls[0])],
                    "confidence": float(box.conf[0]),
                    "bbox": [x1, y1, x2 - x1, y2 - y1],
                })
        payload = {
            "detections": detections,
            "image": {"width": output_width, "height": output_height},
            "source": "local_yolo", "fallback_reason": fallback,
            "request_id": request_id,
        }
        logger.info(
            "inference request_id=%s source=local_yolo fallback=%s detections=%d elapsed_ms=%d input=%dx%d",
            request_id, fallback, len(detections), int((perf_counter() - started) * 1000),
            remote_image.width, remote_image.height,
        )
        return payload

    return app


app = create_app()
