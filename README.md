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
[2] Detection             Roboflow Hosted API, deployed model version
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

- **Model**: Roboflow-hosted object detector trained on merged SSS datasets
- **Data prep/training**: Roboflow (merge, augment, split, train, deploy)
- **Preprocessing/backend**: Python, OpenCV
- **Dashboard**: Streamlit + folium (map view)
- **Hardware**: cloud-hosted training and inference; no local GPU required

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

Create `.streamlit/secrets.toml` from `dashboard/secrets.toml.example`, then
set the deployed Roboflow model ID and your private API key. Do not commit this
file. Alternatively, set `ROBOFLOW_API_KEY` and `ROBOFLOW_MODEL_ID` as
environment variables.

```bash
streamlit run dashboard/app.py
```

The model ID may be the deployed Roboflow model in
`<workspace>/<project>/<version>` form, for example
`dev-manchanda/marine-sonar-debris/1`.

## Repo layout

```
data/            raw / processed / synthetic sonar imagery
models/          trained weights + training configs
src/
  preprocessing/     noise reduction, contrast, nadir-gap masking
  confidence_filter/ shape-regularity + shadow-consistency scoring
  geotagging/         pixel -> lat/lon mapping, report generation
  inference/          Roboflow Hosted API adapter
dashboard/       Streamlit app
reports/         sample JSON/CSV outputs
notebooks/       exploration / training notebooks
```

## Status

🚧 In progress — SIH 2026 build, 1-week sprint.

## Deployment scope

This prototype trains and runs object detection through Roboflow's hosted
service because a local GPU is not currently available. The dashboard performs
preprocessing, confidence filtering, geotagging, and report generation locally.
Local/edge model export is future work and is not claimed for this version.

## Team

Built by [agrimgarg08](https://github.com/agrimgarg08) and team.
