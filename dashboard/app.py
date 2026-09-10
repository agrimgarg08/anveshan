"""Anveshan Streamlit dashboard using Roboflow Hosted API inference.

Run from the repository root:
    streamlit run dashboard/app.py
"""

from __future__ import annotations

import ast
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import cv2
import folium
import numpy as np
import pandas as pd
import streamlit as st
from PIL import Image
from streamlit_folium import st_folium

from confidence_filter.confidence_filter import refine_detections
from geotagging.report_generator import build_report, generate_simulated_metadata
from inference.roboflow_client import RoboflowClient, RoboflowConfigurationError, RoboflowInferenceError
from preprocessing.clean_sonar import clean
from theme import load_theme, notice, render_pipeline


def setting(name: str) -> str:
    """Read a deployment setting without exposing secret values in the UI."""
    value = os.getenv(name)
    if value:
        return value
    try:
        return str(st.secrets.get(name, ""))
    except (FileNotFoundError, KeyError):
        return ""


def draw_detections(image: np.ndarray, detections_df: pd.DataFrame) -> np.ndarray:
    """Draw reviewed detections using green/flagged-red markers."""
    display = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    for _, detection in detections_df.iterrows():
        bbox = detection.get("bbox", [0, 0, 0, 0])
        if pd.isna(bbox):
            bbox = [0, 0, 0, 0]
        elif isinstance(bbox, str):
            try:
                bbox = ast.literal_eval(bbox)
            except Exception:
                bbox = [0, 0, 0, 0]
        
        try:
            x, y, width, height = [int(value) for value in bbox]
        except Exception:
            x, y, width, height = 0, 0, 0, 0
            
        flagged = detection.get("flagged_for_review", False)
        color = (0, 165, 220) if flagged else (0, 180, 0)
        if flagged:
            for offset in range(0, max(width, height), 12):
                if offset < width:
                    cv2.line(display, (x + offset, y), (min(x + offset + 7, x + width), y), color, 2)
                    cv2.line(display, (x + offset, y + height), (min(x + offset + 7, x + width), y + height), color, 2)
                if offset < height:
                    cv2.line(display, (x, y + offset), (x, min(y + offset + 7, y + height)), color, 2)
                    cv2.line(display, (x + width, y + offset), (x + width, min(y + offset + 7, y + height)), color, 2)
        else:
            cv2.rectangle(display, (x, y), (x + width, y + height), color, 2)
        
        try:
            conf = float(detection.get('final_confidence', 0.0))
        except (ValueError, TypeError):
            conf = 0.0
            
        cls_name = str(detection.get('class', 'unknown'))
        label = f"{cls_name} {conf:.0f}%"
        if detection.get("flagged_for_review", False):
            label += " [FLAGGED]"
        cv2.putText(display, label, (x, max(y - 6, 12)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
    return display


st.set_page_config(page_title="Anveshan", layout="wide")
load_theme()

# User Authentication
if "logged_in" not in st.session_state:
    st.session_state.logged_in = False

if not st.session_state.logged_in:
    st.title("Anveshan — Login")
    notice("Please log in to access the marine debris detection dashboard.")
    
    col1, col2 = st.columns([1, 2])
    with col1:
        username = st.text_input("Username", value="admin")
        password = st.text_input("Password", type="password")
        if st.button("Login"):
            if username == "admin" and password == "anveshan2026":
                st.session_state.logged_in = True
                st.rerun()
            else:
                notice("Invalid credentials. Use the configured dashboard account.", "error")
    st.stop()

st.sidebar.title(f"Welcome, admin")
if st.sidebar.button("Logout"):
    st.session_state.logged_in = False
    st.rerun()
st.sidebar.divider()

api_key = setting("ROBOFLOW_API_KEY")
model_id = setting("ROBOFLOW_MODEL_ID")
if api_key and model_id:
    st.sidebar.success(f"Roboflow configuration loaded · {model_id}")
else:
    st.sidebar.markdown('<div class="notice notice-amber">Roboflow configuration is incomplete</div>', unsafe_allow_html=True)
render_pipeline(0)

st.title("Anveshan — Marine Debris Detection (Side-Scan Sonar)")
st.caption("SIH 2026 · PS 26057 · Roboflow-hosted detection with multi-image support")

st.sidebar.header("Data Upload")
uploaded_images = st.sidebar.file_uploader("Upload sonar image(s)", type=["png", "jpg", "jpeg"], accept_multiple_files=True)
uploaded_csv = st.sidebar.file_uploader("Upload navigation metadata (CSV) - Optional", type=["csv"])

if not uploaded_images:
    notice("Upload one or more sonar images in the sidebar to begin.")
    st.stop()

# Initialize session state for processing
current_files = [f.name for f in uploaded_images]
render_pipeline(1)
if "processed_files" not in st.session_state or st.session_state.processed_files != current_files:
    st.session_state.processed_files = current_files
    st.session_state.images = {}
    flat_detections = []
    
    client = None
    try:
        client = RoboflowClient(api_key=api_key, model_id=model_id)
    except RoboflowConfigurationError:
        st.sidebar.info("Detection model not yet configured — showing preprocessing only.")
    
    with st.spinner("Processing images..."):
        for uploaded in uploaded_images:
            raw_image = np.array(Image.open(uploaded).convert("L"))
            cleaned_image = clean(raw_image)
            render_pipeline(2)
            
            refined = []
            if client:
                try:
                    detections = client.predict(cleaned_image)
                    refined = refine_detections(cleaned_image, detections)
                except Exception as e:
                    notice(f"Inference error on {uploaded.name}: {e}", "error")
            
            st.session_state.images[uploaded.name] = {
                "raw": raw_image,
                "cleaned": cleaned_image,
                "width": cleaned_image.shape[1],
                "height": cleaned_image.shape[0]
            }
            
            for d in refined:
                flat_detections.append({
                    "image": uploaded.name,
                    "class": d["class"],
                    "final_confidence": d["final_confidence"],
                    "flagged_for_review": d["flagged_for_review"],
                    "bbox": d["bbox"]
                })
    
    st.session_state.detections_df = pd.DataFrame(flat_detections) if flat_detections else pd.DataFrame(columns=["image", "class", "final_confidence", "flagged_for_review", "bbox"])

render_pipeline(3)
st.subheader("Image Viewer")
selected_image_name = st.selectbox("Select image to view", current_files)
img_data = st.session_state.images[selected_image_name]

original_column, processed_column = st.columns(2)
with original_column:
    st.image(img_data["raw"], caption="Original", use_container_width=True)
with processed_column:
    st.image(img_data["cleaned"], caption="Preprocessed", use_container_width=True)

st.divider()
st.subheader("Detections & Review")

# Editable Dataframe
edited_df = st.session_state.detections_df
if not edited_df.empty:
    st.caption("Review and edit detections across all images. Changes will be reflected in the map and final report.")
    edited_df = st.data_editor(
        st.session_state.detections_df,
        num_rows="dynamic",
        use_container_width=True,
        column_config={
            "bbox": st.column_config.Column(disabled=True),
            "image": st.column_config.Column(disabled=True)
        }
    )
    st.session_state.detections_df = edited_df
else:
    notice("No detections above threshold on these images.")

# Draw boxes for the selected image
if not edited_df.empty:
    selected_detections = edited_df[edited_df["image"] == selected_image_name]
    display_img = draw_detections(img_data["cleaned"], selected_detections)
    st.image(cv2.cvtColor(display_img, cv2.COLOR_BGR2RGB), caption=f"Detections for {selected_image_name}", use_container_width=True)

st.divider()
render_pipeline(4)
st.subheader("Map")

if uploaded_csv:
    ping_metadata = pd.read_csv(uploaded_csv)
    st.caption("Using uploaded navigation metadata.")
else:
    num_pings = max(10, len(edited_df))
    ping_metadata = generate_simulated_metadata(num_pings=num_pings)
    st.caption("Coordinates simulated for this prototype — real deployment would use sonar navigation metadata.")

if not edited_df.empty:
    # Convert dataframe back to list of dicts for build_report
    report_detections = []
    for _, row in edited_df.iterrows():
        bbox = row.get("bbox", [0, 0, 0, 0])
        if pd.isna(bbox):
            bbox = [0, 0, 0, 0]
        elif isinstance(bbox, str):
            try:
                bbox = ast.literal_eval(bbox)
            except Exception:
                bbox = [0, 0, 0, 0]
                
        try:
            conf = float(row.get("final_confidence", 0.0))
        except (ValueError, TypeError):
            conf = 0.0
            
        report_detections.append({
            "class": str(row.get("class", "unknown")),
            "final_confidence": conf,
            "flagged_for_review": bool(row.get("flagged_for_review", False)),
            "bbox": bbox
        })
    
    # We use the width/height of the first processed image as an approximation for the report
    report = build_report(
        report_detections, 
        ping_metadata, 
        image_width_px=img_data["width"], 
        image_height_px=img_data["height"]
    )
    
    os.makedirs("reports", exist_ok=True)
    report.to_json("reports/latest_report.json")
    report.to_csv("reports/latest_report.csv")
    
    first_entry = report.entries[0]
    map_view = folium.Map(location=[first_entry.latitude, first_entry.longitude], zoom_start=15)
    for entry in report.entries:
        marker_color = "orange" if entry.flagged_for_review else "green"
        icon_name = "warning-sign" if entry.flagged_for_review else "ok-sign"
        folium.Marker(
            [entry.latitude, entry.longitude],
            popup=f"{entry.image_class} ({entry.confidence:.0f}%)",
            icon=folium.Icon(color=marker_color, icon=icon_name),
        ).add_to(map_view)
    map_column, list_column = st.columns([1.35, 0.65])
    with map_column:
        st_folium(map_view, width=None, height=400)
        st.caption("Coordinates simulated for this prototype.")
    with list_column:
        st.markdown("**Detection list**")
        for entry in report.entries:
            score_class = " flagged" if entry.flagged_for_review else ""
            review = " · needs review" if entry.flagged_for_review else ""
            st.markdown(
                f'<div class="detection-row"><span class="detection-class">{entry.image_class}{review}</span>'
                f'<span class="detection-score{score_class}">{entry.confidence:.0f}%</span></div>',
                unsafe_allow_html=True,
            )
    
    st.subheader("Report")
    if not uploaded_csv:
        st.caption("Coordinates and timestamps are simulated for this prototype.")
    st.dataframe([entry.__dict__ for entry in report.entries], use_container_width=True)
    st.download_button("Download JSON report", report.to_json_text(), file_name="anveshan_report.json")
    st.download_button("Download CSV report", report.to_csv_text(), file_name="anveshan_report.csv")
else:
    notice("No detections available to map or report.")
