# Current Task Tracker

This file tracks the active sprint state. The complete dependency-aware checklist is in [`tasks.md`](tasks.md).

## Current status

- **Sprint:** 7-day Marine Debris SSS Detection MVP
- **Status:** Not started
- **Current phase:** Day 1 — Scope, repository, and environment
- **Active task:** D1-01 — Review real SSS imagery
- **Overall completion:** 0 / 43 tasks checked
- **Last updated:** 2026-09-06

## Next action

- [ ] Inspect 20–30 real side-scan sonar images.
- [ ] Write at least five domain notes covering the nadir gap, acoustic shadows, speckle noise, seabed clutter, and debris appearance.
- [ ] Save the notes to `reports/domain_notes.md`.

## Progress by phase

| Phase | Scope | Status |
|---|---|---|
| Day 1 | Scope, repository, environment | Not started |
| Day 2 | Dataset acquisition and preparation | Blocked by Day 1 data/project setup |
| Day 3 | Preprocessing and initial training | Blocked by dataset export |
| Day 4 | Final training, evaluation, confidence filtering | Blocked by baseline training |
| Day 5 | Geotagging and report engine | Blocked by detection/filter contracts |
| Day 6 | Streamlit dashboard and optional API | Blocked by pipeline/report outputs |
| Day 7 | Integration, presentation, rehearsal | Blocked by working dashboard |

## Recently completed

- None.

## Blockers and decisions

- No blockers recorded.
- Initial class list: `debris_net_or_pot`, `pipe_cylinder`, `shipwreck`, `unknown_anomaly`.
- Dashboard default: Streamlit with direct pipeline calls; FastAPI remains optional.
- Navigation metadata is simulated unless real image-linked navigation data becomes available.

## Update procedure

After completing a task:

1. Check its box in `docs/tasks.md`.
2. Update **Active task**, **Overall completion**, and the relevant phase status here.
3. Record important decisions, blockers, metric changes, or artifact paths.
4. Move the next dependency-unblocked task into **Next action**.
