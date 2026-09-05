# Anveshan (अन्वेषण)

AI-powered automated underwater marine debris and anomaly detection system using side-scan sonar (SSS) imagery.

Built for SIH 2026 — Problem Statement 26057 (Ministry of Earth Sciences / NIOT).

## What it does

Upload a sonar image → detect debris (ghost nets, pipes, shipwrecks, anomalies) with bounding boxes + confidence scores → view detections on a map → export a structured JSON/CSV report.

## Pipeline

```
Raw sonar tile
    │
    ▼
[1] Preprocessing        src/preprocessing/clean_sonar.py
    (despeckle, contrast, nadir-gap mask)
    │
    ▼
[2] Detection             YOLOv8 (Ultralytics), models/weights/best.pt
    │
    ▼
[3] Confidence filtering  src/confidence_filter/confidence_filter.py
    (shape-regularity fusion, false-positive suppression)
    │
    ▼
[4] Geotagging + report   src/geotagging/report_generator.py
    (pixel → lat/lon, JSON + CSV output)
    │
    ▼
[5] Dashboard             dashboard/app.py (Streamlit)
```

## Stack

- **Model**: YOLOv8n/s (Ultralytics), fine-tuned on merged SSS datasets
- **Data prep**: Roboflow (merge, augment, YOLO-format export)
- **Preprocessing/backend**: Python, OpenCV
- **Dashboard**: Streamlit + folium (map view)
- **Hardware**: trained locally on an RTX 3060

## Datasets used

- [PING Ecosystem Ghost-Pot SSS dataset](https://huggingface.co/datasets/PINGEcosystem/sss-crab-pot-detection-ds) — real annotated SSS imagery, derelict crab-pot/fishing-gear detection
- SeabedObjects-KLSG (Kaggle) — wrecks, mines
- Marine_PULSE (Zenodo) — pipes, mounds, platforms
- Synthetic augmentation (composited objects + acoustic shadows + speckle noise) to cover classes/scenarios underrepresented in public data

## Setup

```bash
conda create -n anveshan python=3.10 -y
conda activate anveshan
pip install -r requirements.txt
```

Confirm GPU is visible:
```bash
python -c "import torch; print(torch.cuda.is_available())"
```

## Repo layout

```
data/            raw / processed / synthetic sonar imagery
models/          trained weights + training configs
src/
  preprocessing/     noise reduction, contrast, nadir-gap masking
  confidence_filter/ shape-regularity + shadow-consistency scoring
  geotagging/         pixel -> lat/lon mapping, report generation
  api/                FastAPI backend (optional, if not calling pipeline directly from Streamlit)
dashboard/       Streamlit app
reports/         sample JSON/CSV outputs
notebooks/       exploration / training notebooks
```

## Status

🚧 In progress — SIH 2026 build, 1-week sprint.

## Team

Built by [agrimgarg08](https://github.com/agrimgarg08) and team.
