# Anveshan (अन्वेषण)

This repository follows the SIH 2026 template for project submission.

## 1. Project Information

- **Project Title:** Anveshan (अन्वेषण) – AI-Powered Automated Underwater Marine Debris and Anomaly Detection System
- **PS ID:** SIH26057
- **PS Title:** AI-Powered Automated Underwater Marine Debris and Anomaly Detection System using Side-Scan Sonar Imagery
- **Category:** Software
- **Theme:** Disaster Management

## 2. Problem Statement

Detecting marine debris (ghost nets, pipes, shipwrecks, anomalies) manually from Side-Scan Sonar (SSS) imagery is time-consuming and prone to human error. An automated system is needed to quickly and accurately identify underwater objects and hazards to aid in clean-up and navigation.

## 3. Proposed Solution

Anveshan allows users to upload a sonar image which is then preprocessed (despeckle, contrast, nadir-gap mask). The backend processes the image using an AI model to detect debris with bounding boxes and confidence scores. It applies confidence filtering and geotags the detections, ultimately displaying them on an interactive map and allowing the export of a structured JSON/CSV report.

## 4. Key Features

- Sonar image upload and automated preprocessing
- Marine debris detection (ghost nets, pipes, shipwrecks, anomalies)
- Interactive map visualization with React Leaflet
- Bounding boxes and confidence scores filtering
- Geotagging (pixel → lat/lon mapping)
- Export structured JSON/CSV reports
- Demo mode for evaluation

## 5. Technology Stack

- **Frontend:** Next.js (React), Tailwind CSS, React Leaflet
- **Backend:** Python, FastAPI, OpenCV
- **Machine Learning:** Roboflow (training and hosted inference API)
- **Deployment:** Vercel (Next.js + Python serverless)
- **Datasets:** [PING Ecosystem Ghost-Pot SSS dataset](https://huggingface.co/datasets/PINGEcosystem/sss-crab-pot-detection-ds), [SeabedObjects-KLSG](https://www.kaggle.com/datasets/enochkwatehdongbo/seabedobjects-klsg-dataset), [Marine_PULSE](https://doi.org/10.5281/zenodo.7922705), Synthetic augmentations

## 6. Architecture

See [docs/architecture.md](docs/architecture.md).

```text
User
  |
  v
Frontend (Next.js Dashboard)
  |
  v
Backend API (FastAPI)
  |
  +----> [1] Preprocessing (clean_sonar.py)
  |
  v
Roboflow Hosted ML API
  |
  +----> [2] Detection
  |
  v
Backend API (FastAPI)
  |
  +----> [3] Confidence filtering (confidence_filter.py)
  +----> [4] Geotagging & report (report_generator.py)
  |
  v
Frontend (Dashboard Map & Export)
```

## 7. Repository Structure

```text
YOUR-SIH-PROJECT/
├── README.md
├── SUBMISSION_GUIDE.md
├── submission/
│   ├── PRESENTATION.md
│   └── DEMO.md
├── app/                  # Next.js React frontend
├── components/           # React components
├── api/                  # Python FastAPI backend
├── data/demo/            # Demo images and CSV mock responses
├── docs/                 # Architecture documentation
│   └── architecture.md
├── assets/
│   └── screenshots/      # Important screenshots
├── requirements.txt      # Python dependencies
├── package.json          # Node.js dependencies
└── ...
```

## 8. Final Presentation

Keep your final SIH presentation in the repository whenever the file size allows it.

See [submission/PRESENTATION.md](submission/PRESENTATION.md) for the required format.

## 9. Demo Video

Add the YouTube/Google Drive link in [submission/DEMO.md](submission/DEMO.md).

## 10. Screenshots / Prototype Photos

Add important screenshots or hardware/prototype photos to `assets/screenshots/`.

## 11. Installation

**Python Backend:**
```bash
python -m venv .venv
# Activate the virtual environment
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate
```
**Installing python requirements:**
```
pip install -r requirements.txt
```

**Next.js Frontend:**
```bash
npm install
```

**Environment Variables:**
Copy `.env.example` to `.env`, then set:
- Roboflow model ID and private API key (e.g., `dev-manchanda/marine-sonar-debris/1`).
- `NEXT_PUBLIC_CARTO_API_KEY` with the key requested from https://carto.com/basemaps/apikey/ for the map tiles.
*(Note: Do not commit `.env` to Git).*

## 12. Run

```bash
npm run dev
```
*(This starts both the Next.js frontend and the Python serverless functions via Vercel's dev environment).*

**Demo Login Credentials:**
- **Username:** `admin`
- **Password:** `anveshan2026`

## 13. Future Scope

Currently, this prototype trains and runs object detection through Roboflow's hosted service because a local GPU is not currently available. The dashboard performs preprocessing, confidence filtering, geotagging, and report generation locally. Local/edge model export is future work and is not claimed for this version.

---
**Team:** Built by Team Unstable
