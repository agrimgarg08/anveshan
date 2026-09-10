# Anveshan (अन्वेषण)

AI-powered automated underwater marine debris and anomaly detection system using side-scan sonar (SSS) imagery.

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
[5] Dashboard             React + Tailwind (app/page.tsx)
```

## Stack

- **Model**: Roboflow-hosted object detector trained on merged SSS datasets
- **Data prep/training**: Roboflow (merge, augment, split, train, deploy)
- **Preprocessing/backend**: Python, OpenCV
- **Dashboard**: Next.js React + Tailwind + React Leaflet
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

Copy `.env.example` to `.env`, then set the deployed Roboflow model ID and
private API key. `.env` is ignored by Git and must never be committed.
For Vercel, set the same variables in the project Environment Variables.

```bash
npm run dev
```

### CSV demo mode

With `DEMO_MODE=true`, the API does not call Roboflow. Rename the five demo
images to match one of these CSV files before uploading them:

- `demo_ghost_pot.png` → `data/demo/demo_ghost_pot.csv`
- `demo_pipe_crossing.png` → `data/demo/demo_pipe_crossing.csv`
- `demo_shipwreck.png` → `data/demo/demo_shipwreck.csv`
- `demo_mixed_field.png` → `data/demo/demo_mixed_field.csv`
- `demo_review_target.png` → `data/demo/demo_review_target.csv`

The extension can be PNG or JPG; only the filename stem must match. Each CSV
contains the fixed classes, confidence values, review flags, bounding boxes,
coordinates, ping numbers, and timestamps returned to the dashboard. Set
`DEMO_MODE=false` to use live Roboflow inference.

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
app/              Next.js React dashboard
api/              FastAPI inference endpoint
reports/         sample JSON/CSV outputs
notebooks/       exploration / training notebooks
```

## Deployment scope

This prototype trains and runs object detection through Roboflow's hosted
service because a local GPU is not currently available. The dashboard performs
preprocessing, confidence filtering, geotagging, and report generation locally.
Local/edge model export is future work and is not claimed for this version.

## Team

Built by Team Unstable
