from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import numpy as np
import cv2
import sys
import os
import io
import base64
from pathlib import Path
from PIL import Image, ExifTags
from dataclasses import asdict
import requests

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)

# Add backend/src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend", "src"))

from preprocessing.clean_sonar import clean
from inference.tunnel_client import predict
from confidence_filter.confidence_filter import refine_detections
from geotagging.report_generator import generate_simulated_metadata, build_report
from demo.csv_results import expected_demo_filenames, load_demo_results

app = FastAPI()

def numpy_to_base64(img_arr: np.ndarray) -> str:
    _, buffer = cv2.imencode('.png', img_arr)
    return base64.b64encode(buffer).decode('utf-8')

def _convert_to_degrees(value):
    def to_float(x):
        if hasattr(x, 'numerator') and hasattr(x, 'denominator'):
            return float(x.numerator) / float(x.denominator)
        if isinstance(x, (tuple, list)) and len(x) == 2:
            return float(x[0]) / float(x[1])
        return float(x)
        
    try:
        d = to_float(value[0])
        m = to_float(value[1])
        s = to_float(value[2])
        return d + (m / 60.0) + (s / 3600.0)
    except Exception:
        return 0.0

def get_exif_location(image: Image.Image):
    try:
        exif = image.getexif()
        if not exif:
            return None, None
            
        # 34853 is the tag for GPSInfo
        gps_info = exif.get_ifd(34853)
        if not gps_info:
            return None, None
            
        # 1: GPSLatitudeRef, 2: GPSLatitude, 3: GPSLongitudeRef, 4: GPSLongitude
        gps_latitude = gps_info.get(2)
        gps_latitude_ref = gps_info.get(1)
        gps_longitude = gps_info.get(4)
        gps_longitude_ref = gps_info.get(3)
        
        if gps_latitude and gps_latitude_ref and gps_longitude and gps_longitude_ref:
            lat = _convert_to_degrees(gps_latitude)
            if gps_latitude_ref != "N":                     
                lat = 0 - lat

            lon = _convert_to_degrees(gps_longitude)
            if gps_longitude_ref != "E":
                lon = 0 - lon

            return lat, lon
    except Exception as e:
        print(f"Error parsing EXIF: {e}")
    return None, None

@app.post("/api/process")
async def process_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Attempt to extract EXIF data before converting to Grayscale
        exif_lat, exif_lon = get_exif_location(image)
        is_real_location = (exif_lat is not None and exif_lon is not None)
        
        original_rgb = image.convert("RGB")
        image = original_rgb.convert("L")
        raw_image = np.array(image)
        
        # 1. Preprocess
        cleaned_image = clean(raw_image)
        
        # 2. Inference or filename-matched demo results
        env_demo_mode = os.getenv("DEMO_MODE", "false").strip().lower() in {"1", "true", "yes", "on"}
        demo_result = load_demo_results(file.filename or "")
        demo_mode = env_demo_mode or (demo_result is not None)
        
        demo_scenario = None
        detection_source = 'demo' if demo_mode else None
        fallback_reason = None
        if demo_mode:
            if demo_result is None:
                expected = ", ".join(f"{name}.png/jpg" for name in expected_demo_filenames())
                raise HTTPException(
                    status_code=400,
                    detail=f"Demo mode requires one of these filenames: {expected}",
                )
            demo_scenario, refined = demo_result
        else:
            api_url = os.getenv("INFERENCE_API_URL", "").strip()
            if not api_url:
                raise HTTPException(
                    status_code=503,
                    detail="Inference tunnel is not configured. Set INFERENCE_API_URL in .env.",
                )

            try:
                inference = predict(cleaned_image, api_url, np.array(original_rgb)[:, :, ::-1].copy())
                detection_source = inference['source']
                fallback_reason = inference['fallback_reason']
                detections = inference['detections']
                if detection_source == 'gemini':
                    # Gemini's high/medium/low words are not numeric probabilities.
                    refined = [{**d, 'final_confidence': None, 'flagged_for_review': True}
                               for d in detections]
                else:
                    refined = refine_detections(cleaned_image, detections)
            except (ValueError, RuntimeError, requests.RequestException) as e:
                raise HTTPException(status_code=502, detail=f"Tunnel inference failed: {e}") from e
        
        # Format detections
        flat_detections = []
        for d in refined:
            flat_detection = {
                "image": file.filename,
                "class": d["class"],
                "final_confidence": d["final_confidence"],
                "flagged_for_review": d["flagged_for_review"],
                "bbox": d["bbox"],
                "source": detection_source,
                "confidence_label": d.get("confidence_label"),
            }
            if demo_mode:
                flat_detection.update({
                    "ping_number": d["ping_number"],
                    "latitude": d["latitude"],
                    "longitude": d["longitude"],
                    "timestamp": d["timestamp"],
                })
            flat_detections.append(flat_detection)
            
        # 3. Geotagging
        num_pings = max(10, len(flat_detections))
        
        if is_real_location:
            ping_metadata = generate_simulated_metadata(num_pings=num_pings, start_lat=exif_lat, start_lon=exif_lon)
        else:
            ping_metadata = generate_simulated_metadata(num_pings=num_pings)
        
        report_detections = []
        for d in flat_detections:
            report_detections.append({
                "class": d["class"],
                "final_confidence": (float(d["final_confidence"])
                                     if d["final_confidence"] is not None else None),
                "flagged_for_review": bool(d["flagged_for_review"]),
                "bbox": [int(x) for x in d["bbox"]],
                "source": detection_source,
                "confidence_label": d.get("confidence_label"),
                **({
                    "ping_number": d["ping_number"],
                    "latitude": d["latitude"],
                    "longitude": d["longitude"],
                    "timestamp": d["timestamp"],
                } if demo_mode else {}),
            })
            
        report = build_report(
            report_detections,
            ping_metadata,
            image_width_px=cleaned_image.shape[1],
            image_height_px=cleaned_image.shape[0]
        )
        
        return JSONResponse({
            "cleaned_image": numpy_to_base64(cleaned_image),
            "width": cleaned_image.shape[1],
            "height": cleaned_image.shape[0],
            "detections": report_detections,
            "report": [asdict(entry) for entry in report],
            "demo_mode": demo_mode,
            "demo_scenario": demo_scenario,
            "is_real_location": is_real_location,
            "source": detection_source,
            "fallback_reason": fallback_reason,
        })
        
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
