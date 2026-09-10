# Anveshan Implementation Tasks

This is the execution checklist derived from `combined_project_plan.md` and `README.md`.
Tasks are ordered by the seven-day sprint. Every task has a stable ID, a dependency declaration, and a checkable completion condition.

## Dependency conventions

- `None` means the task can start immediately.
- A task may start only after every task listed in `Depends on` is checked off.
- Optional tasks are explicitly marked `Optional`; all other tasks are part of the MVP.
- Keep the class list to 3–4 classes unless the data review proves that more are practical.

## Day 1 — Scope, repository, and environment

- [ ] **D1-01 — Review real SSS imagery.** Inspect 20–30 images and record observations about the nadir gap, acoustic shadows, speckle noise, seabed clutter, and likely debris appearance.  
  **Depends on:** None  
  **Done when:** `reports/domain_notes.md` contains at least five domain notes and the inspected image sources are recorded.

- [ ] **D1-02 — Confirm the MVP and class scope.** Record the MVP flow: upload → preprocess → detect → map → export JSON/CSV. Confirm the initial classes: debris net/pot, pipe/cylinder, shipwreck, and unknown anomaly.  
  **Depends on:** D1-01  
  **Done when:** The selected class list and MVP flow are documented in `reports/domain_notes.md` or an equivalent project note.

- [x] **D1-03 — Create and verify the repository scaffold.** Ensure these directories exist: `data/raw`, `data/processed`, `data/synthetic`, `models/weights`, `src/preprocessing`, `src/confidence_filter`, `src/geotagging`, `src/api`, `dashboard`, `reports`, and `notebooks`.
  **Depends on:** None  
  **Done when:** All directories exist, are represented in version control where appropriate, and generated datasets/weights are excluded by `.gitignore`.

- [ ] **D1-04 — Set up the Python environment.** Create the Python 3.10 environment and install the dependencies from `requirements.txt` plus the stack required by the plan: Ultralytics, OpenCV, NumPy, pandas, Matplotlib, Streamlit, Folium, Pillow, scikit-image, FastAPI, and Uvicorn.  
  **Depends on:** D1-03  
  **Done when:** The environment activates successfully and all required imports complete without errors.

- [x] **D1-05 — Record hosted-training decision.** Record that Roboflow provides training and inference because no local GPU is currently available.
  **Depends on:** D1-04  
  **Done when:** Project documentation identifies Roboflow Hosted API as the prototype inference path and does not claim local GPU/edge deployment.

- [x] **D1-06 — Create Roboflow access.** Create/sign into the Roboflow account and create the project that will contain the merged SSS dataset.
  **Depends on:** D1-02  
  **Done when:** The project exists, its name and workspace are recorded, and the intended class list is configured.

## Day 2 — Dataset acquisition and preparation

- [ ] **D2-01 — Acquire the PING Ecosystem Ghost-Pot dataset.** Accept any required terms and download/load `PINGEcosystem/sss-crab-pot-detection-ds`.  
  **Depends on:** D1-06  
  **Done when:** The dataset is accessible locally or in Roboflow and its license/terms are recorded.

- [ ] **D2-02 — Acquire supporting datasets.** Obtain SeabedObjects-KLSG for wreck/mine coverage and, if available within the sprint, Marine_PULSE for pipes.  
  **Depends on:** D1-06  
  **Done when:** Each selected dataset is available, its source and terms are recorded, and its usable classes are mapped to the project class list.

- [ ] **D2-03 — Upload and merge datasets in Roboflow.** Upload the selected datasets, preserve their annotations, and map them to the unified 3–4 class list.  
  **Depends on:** D2-01, D2-02  
  **Done when:** Roboflow shows one project with the unified classes and no unmapped required annotations.

- [ ] **D2-04 — Create synthetic sonar examples.** Use background-only crops and object crops to make composites with random position/rotation, acoustic shadows, and multiplicative speckle noise.  
  **Depends on:** D2-03  
  **Done when:** Synthetic images and labels are present in the project, and at least one before/after synthetic example is saved for the presentation.

- [ ] **D2-05 — Add hard negatives.** Add rock-only, shadow-only, and other natural-clutter images with zero debris annotations.  
  **Depends on:** D2-03  
  **Done when:** Hard negatives are included in the dataset and their zero-object labels are validated.

- [ ] **D2-06 — Configure augmentation and split.** Apply Roboflow augmentation (flip, rotate, brightness as appropriate) and split data 70% train / 20% validation / 10% test.  
  **Depends on:** D2-04, D2-05  
  **Done when:** The split and augmentation settings are recorded and no source leakage is visible across splits.

- [ ] **D2-07 — Generate a Roboflow dataset version.** Create a version containing the selected augmentations and 70/20/10 split for hosted training.
  **Depends on:** D2-06  
  **Done when:** The Roboflow version records valid class mappings, augmentation settings, and train/validation/test counts.

- [ ] **D2-08 — Validate dataset integrity.** Check image/label pairing, bounding-box ranges, class IDs, empty hard-negative labels, and representative samples.  
  **Depends on:** D2-07  
  **Done when:** At least a few hundred usable images are available after augmentation, and a validation note records zero blocking format errors.

## Day 3 — Preprocessing and hosted-training baseline

- [ ] **D3-01 — Implement `clean(image)`.** Create `src/preprocessing/clean_sonar.py` with median blur or Lee filtering, CLAHE contrast enhancement, 640×640 normalization, and nadir-gap detection/masking.  
  **Depends on:** D2-08  
  **Done when:** `clean(image)` returns a valid image of the expected size for representative inputs and has no side effects on the original input.

- [ ] **D3-02 — Validate preprocessing visually.** Generate before/after samples and test normal images, noisy images, and images with a center stripe.  
  **Depends on:** D3-01  
  **Done when:** Samples are saved under `reports/` and show noise/contrast improvement without masking target objects.

- [ ] **D3-03 — Document preprocessing scope.** Document that raw XTF heave/pitch/roll correction is out of scope and that robustness is tested with geometrically distorted synthetic images instead.  
  **Depends on:** D3-02  
  **Done when:** The scope decision appears in project documentation/presentation notes.

- [ ] **D3-04 — Run the Roboflow hosted-training sanity check.** Start object-detection training from the generated Roboflow dataset version.
  **Depends on:** D1-05, D2-08  
  **Done when:** A Roboflow run completes, its model/version and learning metrics are recorded, and at least one validation image produces a plausible detection.

- [ ] **D3-05 — Record the training baseline.** Record the Roboflow project/version, model type, hosted-training configuration, and initial metrics.
  **Depends on:** D3-04  
  **Done when:** A baseline note exists under `reports/` and identifies the candidate weights for Day 4.

## Day 4 — Final training, evaluation, and confidence filtering

- [ ] **D4-01 — Run the selected hosted-training iteration.** Retrain from Roboflow after confirming the initial run is learning or after data improvements.
  **Depends on:** D3-05  
  **Done when:** The selected Roboflow model version is deployed and its project/version identifier is documented.

- [ ] **D4-02 — Evaluate on held-out data.** Measure mAP50, precision, and recall overall and per class; inspect prediction images for rock/shadow false positives and missed debris.  
  **Depends on:** D4-01  
  **Done when:** `reports/evaluation.md` contains metrics, dataset/model identifiers, and representative good/bad prediction examples.

- [ ] **D4-03 — Iterate on false positives.** If natural clutter causes unacceptable false positives, add more hard negatives and retrain/evaluate.  
  **Depends on:** D4-02  
  **Done when:** Either a retraining iteration is completed with comparison metrics, or the decision not to retrain is documented with evidence.

- [ ] **D4-04 — Configure hosted deployment.** Deploy the selected Roboflow model and record its `<project>/<version>` identifier.
  **Depends on:** D4-02  
  **Done when:** The hosted endpoint returns a valid prediction using protected credentials.

- [ ] **D4-05 — Implement the confidence filter.** Create `src/confidence_filter/confidence_filter.py` with YOLO confidence, shape regularity using contours/aspect ratio/edge straightness, and the formula `0.7*yolo_conf + 0.3*shape_score`.  
  **Depends on:** D4-02  
  **Done when:** The module accepts detections and image data and returns a final score plus review status.

- [ ] **D4-06 — Tune and test review flagging.** Tune weights/thresholds empirically and flag scores below approximately 0.40 as `flagged_for_review: true` instead of silently discarding them.  
  **Depends on:** D4-03, D4-05  
  **Done when:** Unit or fixture tests cover high-confidence, low-confidence, and flagged detections, and the chosen threshold is documented.

## Day 5 — Geotagging and reports

- [ ] **D5-01 — Define simulated navigation metadata.** Create a metadata format containing `ping_number`, `timestamp`, `latitude`, `longitude`, and `heading` for tiles along a plausible tow path.  
  **Depends on:** D2-08  
  **Done when:** A sample metadata CSV exists and is explicitly labeled simulated when it is not tied to real navigation data.

- [ ] **D5-02 — Define the pixel-to-geo mapping.** Document row-to-ping/timestamp/position mapping and column-to-cross-track distance using swath width.  
  **Depends on:** D5-01  
  **Done when:** The mapping equations, units, assumptions, and swath-width input are documented and tested on sample coordinates.

- [ ] **D5-03 — Implement report generation.** Create `src/geotagging/report_generator.py` producing JSON and CSV fields: `id`, `class`, `confidence`, `lat`, `lon`, `bbox_px`, `timestamp`, and `flagged_for_review`.  
  **Depends on:** D4-06, D5-02  
  **Done when:** The module generates schema-valid JSON and CSV for one tile and preserves the review flag.

- [ ] **D5-04 — Test multi-tile aggregation.** Run the report engine on at least two complete simulated logs/sequences and verify ordering, coordinates, IDs, and aggregation.  
  **Depends on:** D5-03  
  **Done when:** `reports/report.json` and `reports/report.csv` are generated and their contents are cross-checked.

## Day 6 — Dashboard and optional API

- [ ] **D6-01 — Build the Streamlit application shell.** Create `dashboard/app.py` with an upload panel and the end-to-end state flow.  
  **Depends on:** D3-02, D4-06, D5-04  
  **Done when:** The app starts locally and accepts a sonar image or supported log input.

- [ ] **D6-02 — Add preprocessing display.** Show the original and cleaned image side by side.  
  **Depends on:** D6-01  
  **Done when:** Uploading a sample image produces both views without an exception.

- [ ] **D6-03 — Add detection display.** Overlay YOLO boxes and use green/yellow/red styling for confidence/review status.  
  **Depends on:** D6-02  
  **Done when:** The displayed detections match the filter output and flagged detections are visibly distinguishable.

- [ ] **D6-04 — Add map visualization.** Display detection latitude/longitude with Folium or Plotly.  
  **Depends on:** D5-04, D6-03  
  **Done when:** A sample report produces a map with correctly placed detection pins.

- [ ] **D6-05 — Add report downloads.** Provide JSON and CSV download controls.  
  **Depends on:** D5-04, D6-04  
  **Done when:** Downloaded files open successfully and match the generated report contents.

- [ ] **D6-06 — Decide on the API boundary.** Use direct pipeline calls for the prototype, or add a thin FastAPI/Uvicorn service if it materially helps the demo.  
  **Depends on:** D6-01  
  **Done when:** The choice is documented and, if selected, the API has one tested inference/report endpoint.

## Day 7 — Integration, presentation, and rehearsal

- [ ] **D7-01 — Run the full held-out integration test.** Run clean → detect → filter → geotag → display on held-out images/logs never used for iteration.  
  **Depends on:** D6-05  
  **Done when:** The complete flow succeeds and results are saved as an integration test note.

- [ ] **D7-02 — Measure performance.** Time inference and the complete pipeline per image/tile and record hardware and configuration.  
  **Depends on:** D7-01  
  **Done when:** A reproducible approximate latency and throughput figure is documented.

- [ ] **D7-03 — Freeze scope and fix only obvious breakage.** Stop new feature work and resolve blocking integration/demo bugs.  
  **Depends on:** D7-01  
  **Done when:** The final MVP path passes twice consecutively and known limitations are recorded.

- [ ] **D7-04 — Build the presentation.** Prepare approximately 10 slides covering problem, approach, architecture, real/synthetic data strategy, metrics, novelty, demo, and future work.  
  **Depends on:** D4-02, D4-04, D7-02  
  **Done when:** The deck is complete and all numerical claims link to project evidence.

- [ ] **D7-05 — Prepare demo and backup recording.** Rehearse the exact click path and record a backup screen capture.  
  **Depends on:** D7-03, D7-04  
  **Done when:** The live demo can be run end-to-end and the backup recording is playable.

- [ ] **D7-06 — Prepare Q&A answers.** Prepare concise answers about speckle handling, false-positive rate, hosted Roboflow deployment, data provenance, scarcity, synthetic augmentation, and confidence fusion.
  **Depends on:** D3-03, D4-02, D4-04, D7-04  
  **Done when:** A Q&A note contains evidence-based answers and cites the relevant dataset/research sources.

## MVP completion gate

- [ ] **MVP-01 — Confirm the core user journey.** Upload a sonar image or log, show preprocessing, show detections with confidence/review status, show mapped detections, and download JSON/CSV.  
  **Depends on:** D7-01, D7-03  
  **Done when:** A teammate can follow the flow without developer intervention.

- [ ] **MVP-02 — Confirm reproducibility.** Record setup instructions, model/data version, run commands, known limitations, and the final demo asset locations.  
  **Depends on:** MVP-01  
  **Done when:** A clean environment can be prepared from the repository documentation and the final status is updated in `docs/current_task.md`.
