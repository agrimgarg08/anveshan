# Marine Debris SSS Detection — Combined 7-Day Build Plan
### SIH 2026 | PS 26057 | Locked-in stack: YOLOv8n/s + Roboflow + RTX 3060, 1-week timeline, no-code-first

This merges your uploaded plan with the earlier one, cut down to fit **one week**, and adjusted for the decisions you've already made: YOLOv8 (not Faster R-CNN/U-Net), Roboflow for dataset handling (not hand-written label converters), your RTX 3060 for training, and a preference for automated/low-code tooling over hand-written pipelines wherever a good no-code option exists.

**MVP in one sentence:** *Upload a sonar image → detect debris with bounding boxes + confidence → show it on a map → export CSV/JSON report.*

---

## Day 1 — Setup, Scoping, Domain Familiarity

- [ ] Look at 20-30 real SSS images before writing any code. Notice: the nadir gap (blank stripe down the middle — normal, not a bug), acoustic shadows behind objects (often the strongest detection signal), and speckle noise (grainy static everywhere). Write 5 lines of "domain notes" — you'll reuse this for Q&A prep.
- [ ] Create the GitHub repo now, commit an empty folder structure:
  ```
  marine-debris-sih/
  ├── data/{raw,processed,synthetic}/
  ├── models/weights/
  ├── src/{preprocessing,confidence_filter,geotagging,api}/
  ├── dashboard/
  ├── reports/
  └── notebooks/
  ```
- [ ] Environment (local, using your 3060):
  ```bash
  conda create -n sonar python=3.10 -y
  conda activate sonar
  pip install ultralytics opencv-python numpy pandas matplotlib streamlit folium pillow scikit-image fastapi uvicorn
  ```
  Confirm `ultralytics` sees your GPU: `python -c "import torch; print(torch.cuda.is_available())"` → should print `True`.
- [ ] Sign up for Roboflow (free tier) — this is your data pipeline for tomorrow.

**Deliverable:** repo scaffolded, GPU confirmed working, domain notes written.

---

## Day 2 — Data: Acquire, Merge, Export (no-code via Roboflow)

- [ ] Download the **PING Ecosystem Ghost-Pot dataset** (Hugging Face) — accept terms first, then `load_dataset("PINGEcosystem/sss-crab-pot-detection-ds")`. This is real SSS imagery, already annotated.
- [ ] Also grab **SeabedObjects-KLSG** (Kaggle) for wreck/mine classes your PS explicitly names, and optionally **Marine_PULSE** (Zenodo) for pipes.
- [ ] Upload all of these into one **Roboflow project**. Roboflow auto-detects each dataset's native annotation format — you don't hand-write conversion scripts. Merge into one unified class list, e.g.:
  ```
  0: debris_net_or_pot
  1: pipe_cylinder
  2: shipwreck
  3: unknown_anomaly   (catch-all for the "anomaly" framing in your PS title)
  ```
  Keep it to 3-4 classes max given the timeline.
- [ ] **Supplement with synthetic data right away** (do this even with real data — it's a real strength, not a fallback):
  - Take background-only crops (rock/sand/seagrass, no objects).
  - Composite in object crops at random positions/rotation.
  - Add a dark elongated **acoustic shadow** on the side away from the sonar source — this single detail is the most sonar-realistic thing you can add and is worth explicitly calling out in your pitch.
  - Add speckle noise (multiplicative Gaussian) so composites don't look "pasted."
  - This directly answers the PS's "complex background, shadows, speckle noise" line — say so in your slides.
- [ ] In Roboflow: apply the train/val/test split (70/20/10), apply built-in augmentation (flip, rotate, brightness — a couple of clicks), then **export in YOLOv8 format**. You get an `images/`, `labels/`, and `data.yaml` folder ready for Ultralytics — no manual formatting.
- [ ] **Add hard negatives.** Include some rock/shadow-only images with zero debris labeled. This is one of the highest-leverage things you can do to cut false positives later — cheap to do now, expensive to fix after training.

**Deliverable:** exported YOLOv8-format dataset folder + `data.yaml`, at least a few hundred images after augmentation.

---

## Day 3 — Preprocessing Script + Kick Off Training (parallel)

Do these two at the same time — preprocessing doesn't need the GPU, so write it while training runs in the background.

**3a. Preprocessing module** (`src/preprocessing/clean_sonar.py`) — build as one function `clean(image) -> cleaned_image`, used both as a demo-visible step and optionally as a pre-training transform:
- Speckle reduction: `cv2.medianBlur` (fast) or a Lee filter (classic despeckling, more "sonar-correct" if you have time to implement it)
- Contrast enhancement: `cv2.createCLAHE` — sonar returns are often low-contrast, CLAHE makes weak returns visible
- Resolution normalization: resize to a consistent size (640×640 to match YOLO input)
- Nadir gap handling: detect the blank center stripe (low-variance columns) and mask it out so the model never learns it as a feature
- Note in your slides: full heave/pitch/roll correction normally happens at the raw XTF signal level before image formation — you're not rebuilding that; you're demonstrating robustness by testing on slightly geometrically-distorted synthetic images instead. This is an honest, defensible scope cut.

**3b. Start training** on your 3060:
```bash
yolo detect train data=data.yaml model=yolov8n.pt epochs=50 imgsz=640 batch=16
```
Start with 50 epochs as a sanity check (not 100) — on a 3060 with a dataset in the hundreds-to-low-thousands of images, this should run in well under an hour. Once you confirm it's learning (loss decreasing, some real detections appearing), extend to 100 epochs for a final run tomorrow.

**Deliverable:** working `clean_sonar.py` with a before/after sample image saved for slides; a first training run completed and sanity-checked.

---

## Day 4 — Finish Training, Evaluate, Iterate + Confidence Filter

- [ ] Run the extended training (100 epochs) if the sanity check looked good. Try `yolov8s.pt` instead of nano if you have time and want a small accuracy bump — still fast on a 3060.
- [ ] Evaluate: check `mAP50`, precision/recall per class from Ultralytics' output. Look at actual prediction images in `runs/detect/predict` — specifically hunt for false positives on rocks/shadows, since that's the exact failure mode the PS calls out.
- [ ] If false positives on natural clutter are high: add more hard-negative rock/shadow images (from Day 2) and retrain — this single fix often does more than architecture changes.
- [ ] Export for lightweight deployment: `yolo export model=best.pt format=onnx` — this backs your "edge deployment" claim in the pitch.
- [ ] Build `src/confidence_filter/confidence_filter.py`:
  - Base score = YOLO's raw confidence
  - Shape-regularity check: `cv2.findContours` + aspect-ratio/edge-straightness scoring — man-made objects tend to have straighter, more regular silhouettes than rock clusters
  - Shadow-consistency check (optional, if time allows): compare shadow length/darkness next to the detection against what's expected for its apparent size/range
  - Combine: `final_confidence = 0.7*yolo_conf + 0.3*shape_score` (tune weights empirically, document that you did)
  - Anything under ~40% → flag as `flagged_for_review: true` rather than silently dropped — defensible design choice for a safety-relevant system, worth mentioning explicitly

**Deliverable:** `best.pt`/`best.onnx` model, an eval report (mAP/precision/recall + example good/bad predictions), and a working `confidence_filter.py`.

---

## Day 5 — Geotagging + Report Engine

- [ ] Define/simulate a metadata format — a CSV of `{ping_number, timestamp, latitude, longitude, heading}` per tile along a plausible tow path. Be explicit in your slides that this is simulated for demo purposes if you don't have real navigation data tied to your images — judges respect this far more than an unexplained "real" coordinate.
- [ ] Write the pixel-to-geo mapping: row → ping/timestamp/position (along-track), column → cross-track distance from tow path using known swath width. Keep the math simple — this doesn't need to be survey-grade for a hackathon demo.
- [ ] Build `report_generator.py` outputting both:
  - JSON: `{id, class, confidence, lat, lon, bbox_px, timestamp, flagged_for_review}`
  - CSV: same fields, flattened
- [ ] Test on a couple of full simulated "logs" (sequences of tiles), not just single images, to make sure the report aggregates correctly across a tow path.

**Deliverable:** `report_generator.py` + sample `report.json`/`report.csv` you can show live.

---

## Day 6 — Dashboard (Streamlit, given your no-code-first preference and 1-week crunch)

Streamlit over a full Next.js build here — it gets you a clean, working, demoable UI in far less time, which matters more than polish given your timeline. (If you want a fancier Next.js dashboard later for a longer/final round, that's a good post-week upgrade, not a Day 6 goal.)

One page, top-to-bottom flow:
1. **Upload panel** — drag-and-drop a sonar image or log
2. **Processing view** — before/after preprocessing shown side by side
3. **Detection view** — YOLO boxes overlaid, color-coded by confidence (green/yellow/flagged-red)
4. **Map view** — `folium` or `plotly.express.scatter_mapbox`, pins at detection lat/lon
5. **Report download** — buttons for JSON/CSV

Wire it to a simple FastAPI backend (or just call your pipeline functions directly from Streamlit if you want to skip the API layer entirely for the demo — one less moving part, and nothing in the PS requires a separate backend service for a prototype).

**Deliverable:** `app.py` running locally end-to-end: upload → see detections → see map → download report.

---

## Day 7 — Integration Test, Timing, PPT, Rehearsal

- [ ] Run your **held-out test set** through the full pipeline (clean → detect → filter → geotag → display) — your one true check nothing was overfit or hacked together.
- [ ] Time it per image — even a rough "~X ms per tile, runs on a laptop, no cloud GPU needed" stat is a strong talking point for the PS's edge-deployment requirement.
- [ ] Fix obvious breakage only — freeze new features today, bug fixes only.
- [ ] Build the PPT (~10 slides): problem → approach → architecture diagram → data strategy (be upfront about real vs. synthetic) → model metrics → novelty (confidence fusion, synthetic shadow augmentation, ONNX edge export) → live demo → future work.
- [ ] Rehearse the exact demo click-path, and record a backup screen-capture in case of live failure.
- [ ] Prep one-liners for likely questions: *"How do you handle speckle noise?"* / *"What's your false positive rate?"* / *"Why YOLO over Faster R-CNN/U-Net?"* / *"Where's your real dataset from?"* (answer: PING Ecosystem + KLSG + Marine_PULSE, real public SSS data is genuinely scarce — cite the REMARO/OpenSonarDatasets survey paper — supplemented with synthetic augmentation, a legitimate approach given the known data-scarcity problem in this research area).

**Deliverable:** stable working prototype, rehearsed demo, backup recording, PPT done.

---

## One-Page Summary

| Day | Focus |
|-----|-------|
| 1 | Domain familiarity, repo, environment, GPU check |
| 2 | Data via Roboflow (merge + synthetic + hard negatives), export YOLOv8 format |
| 3 | Preprocessing script + first training run (parallel) |
| 4 | Finish training, evaluate, fix false positives, build confidence filter |
| 5 | Geotagging + report engine |
| 6 | Streamlit dashboard |
| 7 | Integration test, timing, PPT, rehearsal |

Next step once your repo exists: come back and I'll write the actual `clean_sonar.py`, `confidence_filter.py`, and `report_generator.py` as ready-to-run files, and the `data.yaml` + training command tuned to whatever class list you land on in Roboflow.
