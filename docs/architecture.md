# Architecture

The system is designed with a modern decoupled architecture using a Next.js frontend and a FastAPI backend. Machine learning inference is handled through a local tunnel to run compute-heavy detection models.

## Architecture Diagram

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
Local PC Inference Tunnel
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

## Components and Data Flow

### 1. Frontend (Next.js Dashboard)
- **Role**: Provides the user interface for uploading sonar imagery, viewing results, and downloading reports.
- **Tech Stack**: Next.js (React), Tailwind CSS, React Leaflet.
- **Functionality**: Communicates directly with the FastAPI backend. Displays the interactive map with bounding boxes and geotagged results.

### 2. Backend API (FastAPI)
- **Role**: Serves as the central orchestrator handling HTTP requests from the frontend and coordinating with the ML tunnel.
- **Tech Stack**: Python, FastAPI.
- **Processing Steps**:
  - **Preprocessing**: Cleans the uploaded sonar image using `clean_sonar.py` (despeckling, contrast enhancement, and nadir-gap masking).
  - **Postprocessing**: Filters bounding boxes based on AI confidence scores using `confidence_filter.py`, then generates geolocation tags using `report_generator.py`.

### 3. Local PC Inference Tunnel
- **Role**: Handles the core machine learning inference for object detection.
- **Tech Stack**: Python, OpenCV, Tunneling software (e.g., ngrok/localtunnel).
- **Functionality**: Receives the preprocessed image from the backend, runs the AI model (detecting ghost nets, pipes, shipwrecks, and anomalies), and returns bounding boxes and confidence scores to the FastAPI backend.

### 4. Storage & Export
- Generated reports containing structured data (JSON/CSV) of the detections are provided to the user via the Next.js frontend.
