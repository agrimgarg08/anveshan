"""
app.py — Anveshan dashboard (Streamlit)

Full pipeline: upload -> preprocess -> detect (YOLO) -> confidence filter
-> geotag -> display + download.

Run from repo root:
    streamlit run dashboard/app.py

NOTE: expects a trained model at models/weights/best.pt. Until you have
one, this will still run in "preprocessing preview" mode so you can test
the UI shell before training finishes.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import streamlit as st
import numpy as np
import cv2
from PIL import Image
import folium
from streamlit_folium import st_folium

from preprocessing.clean_sonar import clean
from confidence_filter.confidence_filter import refine_detections
from geotagging.report_generator import generate_simulated_metadata, build_report

MODEL_PATH = "models/weights/best.pt"

st.set_page_config(page_title="Anveshan", layout="wide")
st.title("Anveshan — Marine Debris Detection (Side-Scan Sonar)")
st.caption("SIH 2026 · PS 26057 · Ministry of Earth Sciences / NIOT")

uploaded = st.file_uploader("Upload a sonar image", type=["png", "jpg", "jpeg"])

if uploaded is not None:
    raw_pil = Image.open(uploaded).convert("L")
    raw_np = np.array(raw_pil)

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Original")
        st.image(raw_np, use_container_width=True)

    cleaned = clean(raw_np)
    with col2:
        st.subheader("Preprocessed (despeckled, contrast-enhanced, nadir masked)")
        st.image(cleaned, use_container_width=True)

    st.divider()
    st.subheader("Detections")

    model = None
    if os.path.exists(MODEL_PATH):
        from ultralytics import YOLO
        model = YOLO(MODEL_PATH)
    else:
        st.warning(
            f"No trained model found at `{MODEL_PATH}` yet — showing preprocessing "
            "only. Train a model and drop `best.pt` there to see live detections."
        )

    if model is not None:
        cleaned_bgr = cv2.cvtColor(cleaned, cv2.COLOR_GRAY2BGR)
        results = model(cleaned_bgr)[0]

        detections = []
        for box in results.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            cls_name = model.names[cls_id]
            detections.append({
                "class": cls_name,
                "confidence": conf,
                "bbox": (x1, y1, x2 - x1, y2 - y1),
            })

        refined = refine_detections(cleaned_bgr, detections)

        # draw boxes
        display_img = cleaned_bgr.copy()
        for det in refined:
            x, y, w, h = [int(v) for v in det["bbox"]]
            color = (0, 200, 0) if not det["flagged_for_review"] else (0, 0, 200)
            cv2.rectangle(display_img, (x, y), (x + w, y + h), color, 2)
            label = f"{det['class']} {det['final_confidence']:.0f}%"
            cv2.putText(display_img, label, (x, max(y - 5, 10)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

        st.image(cv2.cvtColor(display_img, cv2.COLOR_BGR2RGB), use_container_width=True)

        if refined:
            st.subheader("Map")
            meta = generate_simulated_metadata(num_pings=max(10, len(refined)))
            report = build_report(refined, meta, image_width_px=cleaned.shape[1],
                                   image_height_px=cleaned.shape[0])

            first_lat = report.entries[0].latitude
            first_lon = report.entries[0].longitude
            fmap = folium.Map(location=[first_lat, first_lon], zoom_start=15)
            for e in report.entries:
                color = "red" if e.flagged_for_review else "green"
                folium.Marker(
                    [e.latitude, e.longitude],
                    popup=f"{e.image_class} ({e.confidence:.0f}%)",
                    icon=folium.Icon(color=color),
                ).add_to(fmap)
            st_folium(fmap, width=900, height=400)

            st.subheader("Report")
            os.makedirs("reports", exist_ok=True)
            report.to_json("reports/latest_report.json")
            report.to_csv("reports/latest_report.csv")

            with open("reports/latest_report.json") as f:
                st.download_button("Download JSON report", f.read(),
                                    file_name="anveshan_report.json")
            with open("reports/latest_report.csv") as f:
                st.download_button("Download CSV report", f.read(),
                                    file_name="anveshan_report.csv")
        else:
            st.info("No detections above threshold on this image.")
else:
    st.info("Upload a sonar image to begin.")
