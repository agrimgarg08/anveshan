from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import numpy as np
import cv2
import sys
import os
import io
import base64
from pathlib import Path
from PIL import Image
from dataclasses import asdict
import requests

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from preprocessing.clean_sonar import clean
from inference.roboflow_client import predict
from confidence_filter.confidence_filter import refine_detections
from geotagging.report_generator import generate_simulated_metadata, build_report
from demo.csv_results import expected_demo_filenames, load_demo_results

app = FastAPI()

def numpy_to_base64(img_arr: np.ndarray) -> str:
    _, buffer = cv2.imencode('.png', img_arr)
    return base64.b64encode(buffer).decode('utf-8')

@app.post("/api/process")
async def process_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("L")
        raw_image = np.array(image)
        
        # 1. Preprocess
        cleaned_image = clean(raw_image)
        
        # 2. Inference or filename-matched demo results
        demo_mode = os.getenv("DEMO_MODE", "true").strip().lower() in {"1", "true", "yes", "on"}
        demo_scenario = None
        if demo_mode:
            demo_result = load_demo_results(file.filename or "")
            if demo_result is None:
                expected = ", ".join(f"{name}.png/jpg" for name in expected_demo_filenames())
                raise HTTPException(
                    status_code=400,
                    detail=f"Demo mode requires one of these filenames: {expected}",
                )
            demo_scenario, refined = demo_result
        else:
            api_key = os.getenv("ROBOFLOW_API_KEY", "").strip()
            model_id = os.getenv("ROBOFLOW_MODEL_ID", "").strip()
            if not api_key or not model_id:
                raise HTTPException(
                    status_code=503,
                    detail="Roboflow is not configured. Set ROBOFLOW_API_KEY and ROBOFLOW_MODEL_ID in .env or your deployment environment.",
                )

            try:
                detections = predict(cleaned_image, api_key, model_id)
                refined = refine_detections(cleaned_image, detections)
            except (ValueError, RuntimeError, requests.RequestException) as e:
                raise HTTPException(status_code=502, detail=f"Roboflow inference failed: {e}") from e
        
        # Format detections
        flat_detections = []
        for d in refined:
            flat_detection = {
                "image": file.filename,
                "class": d["class"],
                "final_confidence": d["final_confidence"],
                "flagged_for_review": d["flagged_for_review"],
                "bbox": d["bbox"],
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
        ping_metadata = generate_simulated_metadata(num_pings=num_pings)
        
        report_detections = []
        for d in flat_detections:
            report_detections.append({
                "class": d["class"],
                "final_confidence": float(d["final_confidence"]),
                "flagged_for_review": bool(d["flagged_for_review"]),
                "bbox": [int(x) for x in d["bbox"]],
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
        })
        
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
