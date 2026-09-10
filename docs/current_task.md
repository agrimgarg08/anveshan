# Current Task Tracker

This file tracks the active sprint state. The complete dependency-aware checklist is in [`tasks.md`](tasks.md).

## Current status

- **Sprint:** 7-day Marine Debris SSS Detection MVP
- **Status:** Integration-ready; awaiting live Roboflow credential verification
- **Current phase:** Day 1 — Scope, repository, and hosted environment
- **Active task:** D7-01 — Run the full held-out integration test
- **Overall completion:** 3 / 43 tasks checked
- **Last updated:** 2026-09-06

## Next action

- [ ] Inspect 20–30 real side-scan sonar images.
- [ ] Write at least five domain notes covering the nadir gap, acoustic shadows, speckle noise, seabed clutter, and debris appearance.
- [ ] Save the notes to `reports/domain_notes.md`.

## Progress by phase

| Phase | Scope | Status |
|---|---|---|
| Day 1 | Scope, repository, hosted environment | Partially complete |
| Day 2 | Dataset acquisition and preparation | Blocked by Day 1 data/project setup |
| Day 3 | Preprocessing and initial training | Blocked by dataset export |
| Day 4 | Final training, evaluation, confidence filtering | Blocked by baseline training |
| Day 5 | Geotagging and report engine | Blocked by detection/filter contracts |
| Day 6 | Streamlit dashboard and hosted API | Smoke-tested; live inference pending |
| Day 7 | Integration, presentation, rehearsal | Blocked by working dashboard |

## Recently completed

- **D1-03 — Repository scaffold verified (2026-09-06).** Required directories exist; `.gitkeep` files preserve empty data/model/report/notebook directories in version control, and `.gitignore` excludes generated datasets, weights, and training runs.
- **D1-06 — Roboflow project created (2026-09-10).** Workspace/project: `dev-manchanda/marine-sonar-debris`. Dataset merging and class mapping are in progress.
- **D1-05 — Hosted-training path selected (2026-09-10).** Roboflow will train and host inference; local GPU and ONNX deployment are out of scope for this prototype.
- **Integration smoke test (2026-09-10).** Streamlit starts successfully on the Python 3.10 `anveshan` environment and `/_stcore/health` returns `ok`; five mocked Roboflow-client tests pass. No live inference request was made.

## Blockers and decisions

- Training and inference decision: use Roboflow hosted object detection because no local GPU is currently available. The Streamlit dashboard calls the deployed Hosted API; local/edge ONNX deployment is explicitly future work.
- Current deployed model: `dev-manchanda/marine-sonar-debris/1`.
- Current class list: `debris_net_or_pot`, `pipe_cylinder`, `shipwreck`.
- Scope decision (2026-09-10): skip dataset expansion/retraining for today's submission; document it as a known limitation and next iteration.
- Dashboard default: Streamlit with direct pipeline calls; FastAPI remains optional.
- Navigation metadata is simulated unless real image-linked navigation data becomes available.

## Update procedure

After completing a task:

1. Check its box in `docs/tasks.md`.
2. Update **Active task**, **Overall completion**, and the relevant phase status here.
3. Record important decisions, blockers, metric changes, or artifact paths.
4. Move the next dependency-unblocked task into **Next action**.
