# Model setup and local evaluation

The inference server expects a checkpoint at `backend/models/weights/best.pt`. `MODEL_PATH` can override this location. Model files and training data remain outside the normal Git commit; the existing ignore rules do not need to change.

## Publish the checkpoint

Use a GitHub Release to share the selected checkpoint alongside a version of the application:

1. Select the checkpoint you actually want evaluated. `best.pt` in the runtime folder may differ from the best checkpoint in a recent training run.
2. On the repository's GitHub page, open **Releases → Draft a new release**.
3. Choose a version tag, targeting the application commit that works with that checkpoint. The current model release uses `v.0.1.0`.
4. Attach the selected checkpoint as `best.pt`.
5. In the release notes, record the class mapping, training input size, supported targets, held-out evaluation results, and SHA-256 checksum. Include applicable dataset attribution and redistribution terms.
6. Publish the release, then add its actual download link to this page and the README.

GitHub supports binary attachments to releases. See [Managing releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).

**Model download:** [best.pt (release v.0.1.0)](https://github.com/agrimgarg08/anveshan/releases/download/v.0.1.0/best.pt).

### Current runtime checkpoint

These values were read from the local runtime checkpoint on October 5, 2026. They describe this file, not every training run in the project.

| Field | Value |
| --- | --- |
| File | `backend/models/weights/best.pt` |
| Training run | `ghostpots_finetune` |
| Size | 6,249,706 bytes |
| Class mapping | `0: marine_anomaly` |
| Task | Object detection |
| Training input size | 640 |
| Recorded training epochs | 50 |
| Checkpoint date | September 30, 2026 |
| SHA-256 | `b21677f5743dac8b8d54b7a76c7dbf3cefcdb6af981c68d54e2c9378c5ce9bad` |

The runtime checkpoint was selected for its stronger crab-pot performance. The earlier held-out crab-pot test reported mAP50 of 0.374, versus 0.306 for the combined checkpoint. These scores do not establish performance on other marine object categories. The previous baseline is retained locally as `backend/models/weights/best-baseline-20260929.pt`.

Update this table if you publish a different checkpoint. The local inference API currently requires the class mapping to be exactly `{0: "marine_anomaly"}`. A checkpoint with different class names needs a corresponding API change before release. This checkpoint does not separately classify every object category described in the project proposal.

## Run the model directly

From the repository root in PowerShell, create an inference environment:

```powershell
py -3.11 -m venv .venv-inference
.\.venv-inference\Scripts\python.exe -m pip install -r requirements-api.txt
New-Item -ItemType Directory -Force backend\models\weights
```

Download the published checkpoint into `backend/models/weights/`:

```powershell
Invoke-WebRequest -Uri "https://github.com/agrimgarg08/anveshan/releases/download/v.0.1.0/best.pt" -OutFile "backend/models/weights/best.pt"
```

This command replaces any existing `best.pt` at that location. Check its checksum against the table above:

```powershell
Get-FileHash backend\models\weights\best.pt -Algorithm SHA256
```

Run an image through the checkpoint directly:

```powershell
.\.venv-inference\Scripts\yolo.exe detect predict model="backend/models/weights/best.pt" source="assets/test_images/sonar_scan_2.png" device=cpu imgsz=640 conf=0.25 save=True save_txt=True save_conf=True project="runs" name="judge_preview"
```

Annotated images and detection labels are written to the output directory printed by the command. Empty labels or no boxes mean that no candidates passed the threshold; they are not a startup failure. After dependencies and weights have been downloaded, this direct model command runs offline.

## Run the dashboard locally

Start the inference service in one terminal:

```powershell
.\.venv-inference\Scripts\python.exe -m uvicorn backend.src.api.main:app --host 127.0.0.1 --port 8001
```

In `.env`, set:

```dotenv
DEMO_MODE=false
INFERENCE_API_URL=http://127.0.0.1:8001/detect
```

Start the dashboard backend in a second terminal:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn api.index:app --host 127.0.0.1 --port 8000
```

Start the frontend in a third terminal:

```powershell
npm ci
npm run dev
```

Open `http://localhost:3000` and sign in with the demo credentials in the README. A local dashboard does not need a public tunnel. Keep all three terminals running.

**Demo filename behavior:** The dashboard serves prepared results for `sonar_scan_1` and `sonar_scan_2` filenames even when `DEMO_MODE=false`. To exercise live inference, upload an image with a different filename. Use the direct model command above when evaluating the checkpoint itself.

Geographic positions may be simulated when suitable metadata is unavailable. Review candidate boxes against labeled examples; confidence scores alone do not measure accuracy.
