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
        bbox = detection["bbox"]
        if isinstance(bbox, str):
            try:
                bbox = ast.literal_eval(bbox)
            except Exception:
                continue
        
        try:
            x, y, width, height = [int(value) for value in bbox]
        except Exception:
            continue
            
        color = (0, 0, 220) if detection["flagged_for_review"] else (0, 180, 0)
        cv2.rectangle(display, (x, y), (x + width, y + height), color, 2)
        label = f"{detection['class']} {float(detection['final_confidence']):.0f}%"
        if detection["flagged_for_review"]:
            label += " [FLAGGED]"
        cv2.putText(display, label, (x, max(y - 6, 12)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
    return display


st.set_page_config(page_title="Anveshan", layout="wide")

# User Authentication
if "logged_in" not in st.session_state:
    st.session_state.logged_in = False

if not st.session_state.logged_in:
    st.title("Anveshan — Login")
    st.info("Please log in to access the marine debris detection dashboard.")
    
    col1, col2 = st.columns([1, 2])
    with col1:
        username = st.text_input("Username", value="admin")
        password = st.text_input("Password", type="password")
        if st.button("Login"):
            if username == "admin" and password == "anveshan2026":
                st.session_state.logged_in = True
                st.rerun()
            else:
                st.error("Invalid credentials (use admin / anveshan2026)")
    st.stop()

st.sidebar.title(f"Welcome, admin")
if st.sidebar.button("Logout"):
    st.session_state.logged_in = False
    st.rerun()
st.sidebar.divider()

st.title("Anveshan — Marine Debris Detection (Side-Scan Sonar)")
st.caption("SIH 2026 · PS 26057 · Roboflow-hosted detection with multi-image support")

st.sidebar.header("Data Upload")
uploaded_images = st.sidebar.file_uploader("Upload sonar image(s)", type=["png", "jpg", "jpeg"], accept_multiple_files=True)
uploaded_csv = st.sidebar.file_uploader("Upload navigation metadata (CSV) - Optional", type=["csv"])

if not uploaded_images:
    st.info("Upload one or more sonar images in the sidebar to begin.")
    st.stop()

# Initialize session state for processing
current_files = [f.name for f in uploaded_images]
if "processed_files" not in st.session_state or st.session_state.processed_files != current_files:
    st.session_state.processed_files = current_files
    st.session_state.images = {}
    flat_detections = []
    
    client = None
    try:
        client = RoboflowClient(api_key=setting("ROBOFLOW_API_KEY"), model_id=setting("ROBOFLOW_MODEL_ID"))
    except RoboflowConfigurationError:
        st.sidebar.info("Detection model not yet configured — showing preprocessing only.")
    
    with st.spinner("Processing images..."):
        for uploaded in uploaded_images:
            raw_image = np.array(Image.open(uploaded).convert("L"))
            cleaned_image = clean(raw_image)
            
            refined = []
            if client:
                try:
                    detections = client.predict(cleaned_image)
                    refined = refine_detections(cleaned_image, detections)
                except Exception as e:
                    st.error(f"Inference error on {uploaded.name}: {e}")
            
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
    st.info("No detections found.")

# Draw boxes for the selected image
if not edited_df.empty:
    selected_detections = edited_df[edited_df["image"] == selected_image_name]
    display_img = draw_detections(img_data["cleaned"], selected_detections)
    st.image(cv2.cvtColor(display_img, cv2.COLOR_BGR2RGB), caption=f"Detections for {selected_image_name}", use_container_width=True)

st.divider()
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
        bbox = row["bbox"]
        if isinstance(bbox, str):
            try:
                bbox = ast.literal_eval(bbox)
            except Exception:
                bbox = [0, 0, 0, 0]
        report_detections.append({
            "class": row["class"],
            "final_confidence": float(row["final_confidence"]),
            "flagged_for_review": bool(row["flagged_for_review"]),
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
        marker_color = "red" if entry.flagged_for_review else "green"
        icon_name = "warning-sign" if entry.flagged_for_review else "ok-sign"
        folium.Marker(
            [entry.latitude, entry.longitude],
            popup=f"{entry.image_class} ({entry.confidence:.0f}%)",
            icon=folium.Icon(color=marker_color, icon=icon_name),
        ).add_to(map_view)
    st_folium(map_view, width=900, height=400)
    
    st.subheader("Report")
    if not uploaded_csv:
        st.caption("Coordinates and timestamps are simulated for this prototype.")
    st.dataframe([entry.__dict__ for entry in report.entries], use_container_width=True)
    st.download_button("Download JSON report", report.to_json_text(), file_name="anveshan_report.json")
    st.download_button("Download CSV report", report.to_csv_text(), file_name="anveshan_report.csv")
else:
    st.info("No detections available to map or report.")
