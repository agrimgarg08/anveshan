"""Anveshan Streamlit dashboard using Roboflow Hosted API inference.

Run from the repository root:
    streamlit run dashboard/app.py

Set `ROBOFLOW_API_KEY` and `ROBOFLOW_MODEL_ID` (for example,
`marine-sonar-debris/1`) as environment variables or Streamlit secrets.
"""

from __future__ import annotations

import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import cv2
import folium
import numpy as np
import streamlit as st
from PIL import Image
from streamlit_folium import st_folium

from confidence_filter.confidence_filter import refine_detections
from geotagging.report_generator import build_report, generate_simulated_metadata
from inference.roboflow_client import RoboflowClient, RoboflowConfigurationError, RoboflowInferenceError
from preprocessing.clean_sonar import clean


def setting(name: str) -> str:
    """Read a deployment setting without exposing secret values in the UI."""
    value = os.getenv(name)
    if value:
        return value
    try:
        return str(st.secrets.get(name, ""))
    except (FileNotFoundError, KeyError):
        return ""


def draw_detections(image: np.ndarray, detections: list[dict]) -> np.ndarray:
    """Draw reviewed detections using green/flagged-red markers."""
    display = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    for detection in detections:
        x, y, width, height = [int(value) for value in detection["bbox"]]
        color = (0, 0, 220) if detection["flagged_for_review"] else (0, 180, 0)
        cv2.rectangle(display, (x, y), (x + width, y + height), color, 2)
        label = f"{detection['class']} {detection['final_confidence']:.0f}%"
        cv2.putText(display, label, (x, max(y - 6, 12)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
    return display


st.set_page_config(page_title="Anveshan", layout="wide")
st.title("Anveshan — Marine Debris Detection (Side-Scan Sonar)")
st.caption("SIH 2026 · PS 26057 · Roboflow-hosted detection with simulated navigation metadata")

uploaded = st.file_uploader("Upload a sonar image", type=["png", "jpg", "jpeg"])
if uploaded is None:
    st.info("Upload a sonar image to begin.")
    st.stop()

raw_image = np.array(Image.open(uploaded).convert("L"))
cleaned_image = clean(raw_image)
original_column, processed_column = st.columns(2)
with original_column:
    st.subheader("Original")
    st.image(raw_image, use_container_width=True)
with processed_column:
    st.subheader("Preprocessed")
    st.image(cleaned_image, use_container_width=True)

st.divider()
st.subheader("Detections")
try:
    client = RoboflowClient(api_key=setting("ROBOFLOW_API_KEY"), model_id=setting("ROBOFLOW_MODEL_ID"))
except RoboflowConfigurationError:
    st.warning(
        "Hosted inference is not configured. Set `ROBOFLOW_API_KEY` and "
        "`ROBOFLOW_MODEL_ID` in Streamlit secrets or environment variables."
    )
    st.stop()

try:
    started_at = time.perf_counter()
    detections = client.predict(cleaned_image)
    inference_ms = (time.perf_counter() - started_at) * 1000
except RoboflowInferenceError as error:
    st.error(f"Roboflow inference could not complete: {error}")
    st.stop()

st.caption(f"Roboflow hosted-inference latency: {inference_ms:.0f} ms")
refined = refine_detections(cleaned_image, detections)
st.image(cv2.cvtColor(draw_detections(cleaned_image, refined), cv2.COLOR_BGR2RGB), use_container_width=True)

if not refined:
    st.info("Roboflow returned no detections at the configured confidence threshold.")
    st.stop()

st.subheader("Map")
metadata = generate_simulated_metadata(num_pings=max(10, len(refined)))
report = build_report(refined, metadata, image_width_px=cleaned_image.shape[1], image_height_px=cleaned_image.shape[0])
first_entry = report.entries[0]
map_view = folium.Map(location=[first_entry.latitude, first_entry.longitude], zoom_start=15)
for entry in report.entries:
    marker_color = "red" if entry.flagged_for_review else "green"
    folium.Marker(
        [entry.latitude, entry.longitude],
        popup=f"{entry.image_class} ({entry.confidence:.0f}%)",
        icon=folium.Icon(color=marker_color),
    ).add_to(map_view)
st_folium(map_view, width=900, height=400)

st.subheader("Report")
st.caption("Coordinates and timestamps are simulated for this prototype.")
st.download_button("Download JSON report", report.to_json_text(), file_name="anveshan_report.json")
st.download_button("Download CSV report", report.to_csv_text(), file_name="anveshan_report.csv")
