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
        
        # 2. Inference
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
            flat_detections.append({
                "image": file.filename,
                "class": d["class"],
                "final_confidence": d["final_confidence"],
                "flagged_for_review": d["flagged_for_review"],
                "bbox": d["bbox"]
            })
            
        # 3. Geotagging
        num_pings = max(10, len(flat_detections))
        ping_metadata = generate_simulated_metadata(num_pings=num_pings)
        
        report_detections = []
        for d in flat_detections:
            report_detections.append({
                "class": d["class"],
                "final_confidence": float(d["final_confidence"]),
                "flagged_for_review": bool(d["flagged_for_review"]),
                "bbox": [int(x) for x in d["bbox"]]
            })
            
        report_entries = build_report(
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
            "report": [asdict(entry) for entry in report_entries]
        })
        
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
