# Anveshan — Frontend Spec

This describes exactly what data the frontend receives from the pipeline and what it needs to render. Written for whoever's building the UI (Codex or otherwise) so the frontend is built against real output shapes, not guesses.

---

## Data shapes (these are final — pulled directly from existing backend code)

### A single detection (before geotagging)
Comes from `confidence_filter.refine_detections()`:

```json
{
  "class": "pipe_cylinder",
  "confidence": 0.82,
  "bbox": [100, 100, 60, 40],
  "shape_regularity_score": 70.0,
  "final_confidence": 78.4,
  "flagged_for_review": false
}
```

- `bbox` is `[x, y, width, height]` in **pixel coordinates**, relative to the (preprocessed, resized) image the model ran on — not the original upload's raw dimensions. Frontend needs to know the processed image's actual displayed size to draw boxes correctly.
- `confidence` is YOLO's raw score, 0.0–1.0. **Don't show this alone** — `final_confidence` is the one to display, it's the fused score.
- `final_confidence` is 0–100 (already a percentage, not 0–1).
- `flagged_for_review` — anything under ~40% final confidence. Treat this as a distinct visual state, not just "low confidence" — the PS explicitly wants human review for borderline cases, so this should read as "needs a second look" rather than "wrong."
- `class` is one of the three trained classes: `"debris_net_or_pot"`, `"pipe_cylinder"`, `"shipwreck"` (note: `unknown_anomaly` was dropped as a trained class — anything low-confidence across any class becomes `flagged_for_review` instead).

### A full report entry (after geotagging)
Comes from `report_generator.build_report()` → `Report.entries`, this is what actually lands in the downloadable JSON/CSV:

```json
{
  "detection_id": "D000",
  "ping_number": 0,
  "image_class": "pipe_cylinder",
  "confidence": 78.4,
  "flagged_for_review": false,
  "bbox_px": [100, 100, 60, 40],
  "latitude": 13.082794,
  "longitude": 80.270603,
  "timestamp": "2026-09-05T10:22:00Z"
}
```

- `detection_id` — unique per detection in the report, format `D` + zero-padded index (`D000`, `D001`, ...).
- `latitude`/`longitude` — **simulated for this prototype** (no real navigation metadata exists in the source datasets). The UI must visibly label these as simulated/demo coordinates somewhere near the map — don't present them as real GPS without a caveat, this is an intentional, disclosed scope decision, not a bug.
- `timestamp` — ISO 8601 string, ties to the simulated tow-path ping, not the actual upload time.

### The report file itself
`reports/latest_report.json` — a flat JSON array of the objects above, one per detection. `reports/latest_report.csv` — the same fields flattened to CSV columns. Both regenerate on every new upload (single-image workflow — see below).

---

## Screens (single-image workflow — confirmed scope for this week)

### 1. Upload
- Single sonar image upload (PNG/JPG). No batch/multi-image upload this week — explicitly out of scope for now (may be mentioned as future work in the pitch, not built).
- Accept grayscale or color (backend converts to grayscale internally).

### 2. Processing / before-after view
- Show original upload next to the preprocessed version (despeckled, contrast-enhanced, nadir-gap masked) side by side.
- This view exists specifically to demonstrate the noise-filtering module the PS asks for — don't collapse it into a loading spinner, it's a visible pipeline stage judges should see.

### 3. Detection view
- The preprocessed image with bounding boxes overlaid.
- Box color should map to state, not just be decorative:
  - Confident detection (`flagged_for_review: false`) → one color (e.g. green)
  - Flagged for review (`flagged_for_review: true`) → a distinct second color (e.g. red/amber) — visually different enough to scan at a glance
- Label each box with `class` + `final_confidence` (e.g. `"pipe_cylinder 78%"`).
- A hover/click on a box could show the full detection JSON for that box (nice-to-have, not required this week).

### 4. Map view
- One pin per detection, placed at `latitude`/`longitude`.
- Pin color again reflects `flagged_for_review` state, consistent with the box colors above — same visual language across both views.
- Popup/label on click: `class` + `confidence`.
- Include a small, persistent caption near the map: something like *"Coordinates simulated for this prototype — real deployment would use sonar navigation metadata."* This is a required disclosure per the geotagging decision made earlier, not optional styling.

### 5. Report download
- Two buttons: download JSON, download CSV — both pull directly from the two report files described above.
- No in-browser table/preview is required this week, though a simple read-only table of the report rows would be a nice addition if time allows (not required).

---

## States to design for

- **No model yet** — `models/weights/best.pt` doesn't exist. Screens 1-2 (upload, preprocessing) still work; screens 3-5 should show a clear placeholder/message instead of erroring (e.g. "Detection model not yet trained — showing preprocessing only").
- **Zero detections** — model ran but found nothing above threshold. Show an explicit "no detections found on this image" state, not a blank map/empty report silently.
- **All detections flagged** — possible on a noisy image; the UI shouldn't visually imply failure here, just show everything in the "needs review" color.

---

## Visual/tone notes

- This is a disaster-management / ocean-conservation tool — keep the tone serious and utilitarian, not playful. Avoid gamified visual language (no badges, no "score!" framing) — `final_confidence` is a decision-support number for a marine survey operator, not a game score.
- Simulated data (coordinates) must be visibly and honestly labeled wherever it appears — this is a recurring requirement across map view, and worth a one-line footer disclosure on the report download too if convenient.
- Color-coding for "confident vs. flagged" should be colorblind-considerate if possible (don't rely on red/green alone — pair with a shape/label difference too, e.g. solid vs. dashed border).

---

## What's out of scope this week (don't build)

- Multi-image / batch / full sonar-log upload
- Real navigation-metadata CSV upload (may be added later; simulated-only for now)
- User accounts, auth, persistence across sessions
- Editing/correcting detections in the UI
- Any deployment beyond local (or optionally Streamlit Community Cloud) — no mobile app, no native packaging
