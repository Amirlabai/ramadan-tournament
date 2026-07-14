"""Render self-contained HTML dashboard + metrics.json."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from analytics_report.charts import build_figures
from analytics_report.metrics import DashboardData

KPI_LABELS = [
    ("total_events", "Total events"),
    ("unique_sessions", "Unique sessions"),
    ("day_count", "Active days"),
    ("auth_session_lost", "Session lost"),
    ("lost_per_page_view", "Lost / page view"),
    ("lost_vs_page_view_hourly_corr", "Lost↔traffic corr"),
    ("google_login_success", "Google logins"),
    ("login_success", "Password logins"),
    ("sessions_with_lost", "Sessions w/ lost"),
    ("lost_per_login_success", "Lost / login success"),
]


def _fmt_kpi(key: str, value: object) -> str:
    if isinstance(value, float):
        return f"{value:.2f}"
    if isinstance(value, int):
        return f"{value:,}"
    return str(value)


def _figure_html(fig) -> str:
    return fig.to_html(
        full_html=False,
        include_plotlyjs=False,
        config={"displayModeBar": True, "responsive": True},
    )


SECTION_CHARTS = [
    (
        "Overview",
        "Traffic volume and composition across the export window.",
        ["events_by_day", "events_by_hour", "volume_vs_lost", "categories", "sources"],
    ),
    (
        "Browse & engagement",
        "Where people go and what they interact with.",
        ["top_paths", "top_events", "engagement", "session_depth"],
    ),
    (
        "Auth health",
        "Session restore failures, login funnels, and post-login probes. "
        "auth_session_lost means GET /me returned 401 after a refresh attempt.",
        ["auth_events", "lost_platform", "lost_path", "lost_day", "probe"],
    ),
    (
        "Registration & identity",
        "Identity form and verify-related events.",
        ["identity"],
    ),
]


CSS = """
:root {
  --bg: #f3f6f4;
  --card: #ffffff;
  --ink: #1a1f1c;
  --muted: #5c6b63;
  --accent: #1b7a4e;
  --warn: #b45309;
  --border: #d8e0dc;
  --insight: #eef6f1;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
  background:
    radial-gradient(1200px 600px at 10% -10%, #d8efe3 0%, transparent 55%),
    radial-gradient(900px 500px at 100% 0%, #e8e4d4 0%, transparent 50%),
    var(--bg);
  color: var(--ink);
  line-height: 1.45;
}
header.hero {
  padding: 2rem 1.5rem 1.25rem;
  max-width: 1200px;
  margin: 0 auto;
}
header.hero h1 {
  margin: 0 0 0.35rem;
  font-size: clamp(1.6rem, 3vw, 2.15rem);
  font-weight: 700;
  letter-spacing: -0.02em;
}
header.hero p {
  margin: 0;
  color: var(--muted);
  max-width: 52rem;
}
.meta {
  margin-top: 0.75rem;
  font-size: 0.875rem;
  color: var(--muted);
}
main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem 3rem;
}
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
  margin: 1.25rem 0 1.75rem;
}
.kpi {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.85rem 1rem;
}
.kpi .value {
  font-size: 1.45rem;
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}
.kpi .label {
  font-size: 0.78rem;
  color: var(--muted);
  margin-top: 0.15rem;
}
.insights {
  background: var(--insight);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin-bottom: 2rem;
}
.insights h2 {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
}
.insights ol {
  margin: 0;
  padding-inline-start: 1.25rem;
}
.insights li {
  margin-bottom: 0.55rem;
}
.insights li:last-child { margin-bottom: 0; }
section.block {
  margin-bottom: 2.25rem;
}
section.block h2 {
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
}
section.block .lede {
  margin: 0 0 1rem;
  color: var(--muted);
  font-size: 0.95rem;
}
.chart-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}
@media (min-width: 900px) {
  .chart-grid.two {
    grid-template-columns: 1fr 1fr;
  }
}
.chart-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.5rem 0.5rem 0.25rem;
  overflow: hidden;
}
.chart-card.full { grid-column: 1 / -1; }
footer {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem 2rem;
  color: var(--muted);
  font-size: 0.8rem;
}
"""


def write_dashboard(data: DashboardData, out_dir: Path) -> tuple[Path, Path]:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    figs = build_figures(data)
    # First chart injects plotly.js; others reuse it
    chart_snippets: dict[str, str] = {}
    first = True
    for key, fig in figs.items():
        if first:
            chart_snippets[key] = fig.to_html(
                full_html=False,
                include_plotlyjs=True,
                config={"displayModeBar": True, "responsive": True},
            )
            first = False
        else:
            chart_snippets[key] = _figure_html(fig)

    kpi_html = "".join(
        f'<div class="kpi"><div class="value">{_fmt_kpi(k, data.kpis.get(k, "—"))}</div>'
        f'<div class="label">{label}</div></div>'
        for k, label in KPI_LABELS
        if k in data.kpis
    )

    insights_html = "".join(f"<li>{_escape(t)}</li>" for t in data.insights)

    sections_html: list[str] = []
    for title, lede, keys in SECTION_CHARTS:
        present = [k for k in keys if k in chart_snippets]
        if not present:
            continue
        cards = []
        for i, key in enumerate(present):
            full = " full" if key in ("events_by_day", "volume_vs_lost", "top_events", "auth_events") else ""
            cards.append(f'<div class="chart-card{full}">{chart_snippets[key]}</div>')
        sections_html.append(
            f'<section class="block">'
            f"<h2>{_escape(title)}</h2>"
            f'<p class="lede">{_escape(lede)}</p>'
            f'<div class="chart-grid two">{"".join(cards)}</div>'
            f"</section>"
        )

    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    src = data.generated_from or "(unknown)"
    date_range = f"{data.kpis.get('date_min', '?')} → {data.kpis.get('date_max', '?')}"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ramadan Tournament — Analytics Dashboard</title>
  <style>{CSS}</style>
</head>
<body>
  <header class="hero">
    <h1>Analytics dashboard</h1>
    <p>Offline report from <code>analytics_events</code> export. Interactive Plotly charts — zoom and hover for details.</p>
    <div class="meta">Source: {_escape(src)} · Range: {_escape(date_range)} · Generated: {generated}</div>
  </header>
  <main>
    <div class="kpi-grid">{kpi_html}</div>
    <div class="insights">
      <h2>Key insights</h2>
      <ol>{insights_html}</ol>
    </div>
    {"".join(sections_html)}
  </main>
  <footer>
    Regenerated by <code>scripts/analytics_dashboard.py</code>. Complements the live Analytics Explorer (Postgres).
  </footer>
</body>
</html>
"""

    html_path = out_dir / "index.html"
    html_path.write_text(html, encoding="utf-8")

    payload = data.to_jsonable()
    payload["generated_at"] = generated
    json_path = out_dir / "metrics.json"
    json_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return html_path, json_path


def _escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
