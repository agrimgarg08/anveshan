# Anveshan (अन्वेषण)

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
- **Machine Learning:** Local PC Tunnel (inference API)
- **Deployment:** Vercel (Next.js + Python serverless)
- **Datasets:** [PING Ecosystem Ghost-Pot SSS dataset](https://huggingface.co/datasets/PINGEcosystem/sss-crab-pot-detection-ds), [SeabedObjects-KLSG](https://www.kaggle.com/datasets/enochkwatehdongbo/seabedobjects-klsg-dataset), [Marine_PULSE](https://doi.org/10.5281/zenodo.7922705), Synthetic augmentations

## 6. Architecture

See [docs/architecture.md](docs/architecture.md) for detailed architecture diagrams and explanation.

## 7. Repository Structure

```text
anveshan/
├── README.md
├── submission/
│   ├── PRESENTATION.md
│   └── DEMO.md
├── src/                  # Next.js React frontend
│   ├── app/              # Next.js App Router
│   └── components/       # React components
├── api/                  # Vercel serverless functions entry point
├── backend/              # Python backend and Machine Learning
│   ├── src/              # Python FastAPI backend & ML logic
│   ├── models/           # ML weights and training configs
│   ├── data/             # Demo images and CSV mock responses
│   └── tests/            # Python tests
├── docs/                 # Architecture documentation
│   └── architecture.md
├── assets/
│   └── screenshots/      # Important screenshots
├── scripts/              # Utility scripts for tunneling/inference
├── requirements.txt      # Python dependencies
├── package.json          # Node.js dependencies
└── ...
```

## 8. Final Presentation

You can view our final SIH presentation here:
[Final Presentation (Google Slides)](https://docs.google.com/presentation/d/1ynVbKB8ut9x5ZKoR_NL1yw7DKevzT_QI/edit?usp=sharing&ouid=104635454528691631841&rtpof=true&sd=true)

## 9. Demo Video

You can watch the full demo of our project here:
[Demo Video (Google Drive)](https://drive.google.com/file/d/1TayU_LuoYKk8IZuOyDH-MOXz0vyDdqnf/view?usp=drivesdk)

## 10. Screenshots / Prototype Photos

Screenshots and prototype photos can be found in the `assets/screenshots/` directory.

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
- `INFERENCE_API_URL` with your local inference tunnel URL ending in `/detect`.
- Set `DEMO_MODE=false` to use live inference. Start the local inference API with `uvicorn backend.src.api.main:app --port 8001`. Install its dependencies with `pip install -r requirements-api.txt` in the inference virtual environment. The inference server uses the local YOLO checkpoint at `backend/models/weights/best.pt` (`MODEL_PATH` can override this).
- `NEXT_PUBLIC_CARTO_API_KEY` with the key requested from https://carto.com/basemaps/apikey/ for the map tiles.
*(Note: Do not commit `.env` to Git).*

## 12. Run

**1. Start the FastAPI Backend:**
```bash
uvicorn api.index:app --reload --port 8000
```

**2. Start the Next.js Frontend:**
```bash
npm run dev
```
*(This starts the Next.js frontend on `localhost:3000`).*

**Demo Login Credentials:**
- **Username:** `admin`
- **Password:** `anveshan2026`

## 13. Future Scope

Currently, this prototype routes object detection through a local PC tunnel. The dashboard performs preprocessing, confidence filtering, geotagging, and report generation locally.

---
## Team Information

- **Team Name**: \_Unstable\_
- **Team ID**: 180239
- **College**: Netaji Subhas University of Technology
