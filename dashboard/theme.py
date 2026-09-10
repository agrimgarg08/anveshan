"""Visual system for the Anveshan sonar-console dashboard."""

from __future__ import annotations

import streamlit as st


THEME_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Space+Grotesk:wght@500;600&display=swap');
:root {
  --abyss: #0B1520;
  --panel: #111F2E;
  --panel-line: #1E3244;
  --scan: #3FC7B0;
  --flag-amber: #E0A445;
  --flag-red: #D45D4E;
  --text-primary: #E8EEF1;
  --text-muted: #7E93A3;
}
html, body, [data-testid="stAppViewContainer"] { background: var(--abyss); }
[data-testid="stHeader"] { background: var(--abyss); }
[data-testid="stSidebar"] { background: #0D1A27; border-right: 1px solid var(--panel-line); }
[data-testid="stSidebar"] > div:first-child { padding-top: 2rem; }
[data-testid="stSidebar"] p, [data-testid="stSidebar"] div { font-family: 'IBM Plex Sans', sans-serif; }
h1, h2, h3, [data-testid="stMetricValue"] { font-family: 'Space Grotesk', sans-serif !important; color: var(--text-primary) !important; }
h1 { letter-spacing: -0.03em; font-size: 2.1rem !important; }
h2, h3 { letter-spacing: -0.015em; }
p, label, .stCaption, [data-testid="stMarkdownContainer"] { font-family: 'IBM Plex Sans', sans-serif; }
[data-testid="stCaptionContainer"] { color: var(--text-muted); }
[data-testid="stFileUploader"] { background: var(--panel); border: 1px solid var(--panel-line); border-radius: 3px; padding: .35rem; }
[data-testid="stFileUploaderDropzone"] { background: transparent; border: 1px dashed var(--panel-line); }
[data-testid="stImage"] { border: 1px solid var(--panel-line); }
.console-panel { background: var(--panel); border: 1px solid var(--panel-line); padding: 1rem 1.15rem; }
.console-label { color: var(--text-muted); font: 500 0.8rem 'IBM Plex Sans', sans-serif; letter-spacing: .02em; }
.console-value { color: var(--text-primary); font: 600 1.65rem 'Space Grotesk', sans-serif; }
.notice { background: var(--panel); border: 1px solid var(--panel-line); color: var(--text-muted); padding: .85rem 1rem; margin: .5rem 0 1rem; }
.notice-error { border-left: 3px solid var(--flag-red); color: #E9B0A9; }
.notice-amber { border-left: 3px solid var(--flag-amber); color: #E9C77F; }
.stage-rail { margin: .8rem 0 1.4rem; }
.stage { display:flex; align-items:center; gap:.65rem; color:var(--text-muted); padding:.44rem 0; font: 400 .9rem 'IBM Plex Sans', sans-serif; }
.stage-dot { width: .56rem; height: .56rem; border: 1px solid var(--text-muted); border-radius: 50%; display:inline-block; }
.stage.done, .stage.active { color: var(--text-primary); }
.stage.done .stage-dot, .stage.active .stage-dot { background:var(--scan); border-color:var(--scan); box-shadow: 0 0 0 3px rgba(63,199,176,.12); }
.stage.active { font-weight: 600; }
@keyframes sonar-pulse { 0%, 100% { box-shadow: 0 0 0 3px rgba(63,199,176,.12); } 50% { box-shadow: 0 0 0 7px rgba(63,199,176,0); } }
.stage.active .stage-dot { animation: sonar-pulse 2.4s ease-in-out infinite; }
.stage, .detection-row, .stDownloadButton button { transition: color .2s ease, border-color .2s ease, background-color .2s ease; }
.rail-title { color:var(--scan); font: 600 1rem 'Space Grotesk', sans-serif; letter-spacing:.12em; }
.detection-row { border-bottom: 1px solid var(--panel-line); padding: .65rem .35rem; display:flex; justify-content:space-between; gap:1rem; }
.detection-row:hover { background: rgba(63,199,176,.06); border-bottom-color: var(--scan); }
.detection-class { color:var(--text-primary); font: 500 .9rem 'IBM Plex Sans', sans-serif; }
.detection-score { color:var(--scan); font: 600 1rem 'Space Grotesk', sans-serif; }
.detection-score.flagged { color:var(--flag-amber); }
.detection-note { color:var(--flag-amber); font: 400 .78rem 'IBM Plex Sans', sans-serif; }
.stDownloadButton button { background: var(--panel) !important; border: 1px solid var(--scan) !important; color: var(--scan) !important; border-radius: 2px !important; font-family:'IBM Plex Sans', sans-serif !important; }
.stDownloadButton button:hover { background: rgba(63,199,176,.12) !important; transform: translateY(-1px); }
[data-testid="stImage"] img { animation: panel-enter .35s ease-out both; }
@keyframes panel-enter { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
</style>
"""


def load_theme() -> None:
    st.markdown(THEME_CSS, unsafe_allow_html=True)


def render_pipeline(completed_stage: int) -> None:
    """Render the single-page pipeline status rail without navigation semantics."""
    stages = ("Upload", "Clean", "Detect", "Filter", "Report")
    rows = []
    for index, name in enumerate(stages):
        state = "done" if index < completed_stage else "active" if index == completed_stage else ""
        rows.append(f'<div class="stage {state}"><span class="stage-dot"></span><span>{name}</span></div>')
    st.sidebar.markdown('<div class="rail-title">ANVESHAN</div><div class="stage-rail">' + "".join(rows) + "</div>", unsafe_allow_html=True)


def notice(message: str, kind: str = "") -> None:
    css_kind = f" notice-{kind}" if kind else ""
    st.markdown(f'<div class="notice{css_kind}">{message}</div>', unsafe_allow_html=True)
