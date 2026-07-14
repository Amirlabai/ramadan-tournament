"""Build Plotly figures for the analytics dashboard."""

from __future__ import annotations

import plotly.graph_objects as go
from plotly.subplots import make_subplots

from analytics_report.metrics import DashboardData

# Calm green/slate palette (avoids purple-on-white AI default look)
COLORS = {
    "primary": "#1B7A4E",
    "secondary": "#C9A227",
    "accent": "#2C3E50",
    "muted": "#6B7C85",
    "warn": "#B45309",
    "danger": "#B91C1C",
    "bar": "#2D8F5F",
    "bar2": "#3B82A0",
    "bar3": "#D4A017",
}

LAYOUT_BASE = dict(
    template="plotly_white",
    font=dict(family="IBM Plex Sans, Segoe UI, sans-serif", size=13, color="#1a1a1a"),
    margin=dict(l=48, r=24, t=48, b=48),
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(248,250,249,0.9)",
)


def _bar(
    rows: list[dict],
    *,
    title: str,
    orientation: str = "v",
    color: str = COLORS["bar"],
    height: int = 360,
) -> go.Figure:
    names = [r["name"] for r in rows]
    counts = [r["count"] for r in rows]
    if orientation == "h":
        # reverse so top item is first visually
        names = list(reversed(names))
        counts = list(reversed(counts))
        fig = go.Figure(
            go.Bar(
                y=names,
                x=counts,
                orientation="h",
                marker_color=color,
                text=counts,
                textposition="auto",
            )
        )
    else:
        fig = go.Figure(
            go.Bar(
                x=names,
                y=counts,
                marker_color=color,
                text=counts,
                textposition="auto",
            )
        )
    fig.update_layout(**LAYOUT_BASE, title=title, height=height)
    fig.update_xaxes(showgrid=False)
    fig.update_yaxes(showgrid=True, gridcolor="#E5E7EB")
    return fig


def _pie(rows: list[dict], *, title: str) -> go.Figure:
    fig = go.Figure(
        go.Pie(
            labels=[r["name"] for r in rows],
            values=[r["count"] for r in rows],
            hole=0.45,
            marker=dict(
                colors=[
                    COLORS["primary"],
                    COLORS["bar2"],
                    COLORS["secondary"],
                    COLORS["warn"],
                    COLORS["muted"],
                    COLORS["accent"],
                ]
            ),
            textinfo="label+percent",
        )
    )
    fig.update_layout(**LAYOUT_BASE, title=title, height=380)
    return fig


def build_figures(data: DashboardData) -> dict[str, go.Figure]:
    figs: dict[str, go.Figure] = {}

    figs["events_by_day"] = _bar(
        data.events_by_day, title="Events per day", color=COLORS["primary"]
    )
    figs["events_by_hour"] = _bar(
        data.events_by_hour, title="Events by hour of day", color=COLORS["bar2"]
    )
    figs["top_events"] = _bar(
        data.events_by_name[:15],
        title="Top event names",
        orientation="h",
        color=COLORS["bar"],
        height=440,
    )
    figs["top_paths"] = _bar(
        data.top_paths,
        title="Top paths",
        orientation="h",
        color=COLORS["bar2"],
        height=420,
    )
    figs["categories"] = _pie(data.events_by_category, title="Events by category")
    figs["sources"] = _pie(data.sources, title="Client vs server source")

    figs["auth_events"] = _bar(
        [r for r in data.auth_events if r["count"] > 0],
        title="Auth event counts",
        orientation="h",
        color=COLORS["warn"],
        height=420,
    )
    figs["lost_platform"] = _pie(
        data.session_lost_by_platform, title="auth_session_lost by platform"
    )
    figs["lost_path"] = _bar(
        data.session_lost_by_path,
        title="auth_session_lost by path",
        orientation="h",
        color=COLORS["danger"],
        height=400,
    )
    if data.session_lost_by_day:
        figs["lost_day"] = _bar(
            data.session_lost_by_day,
            title="auth_session_lost per day",
            color=COLORS["danger"],
        )

    if data.probe_outcomes:
        figs["probe"] = _pie(data.probe_outcomes, title="auth_session_probe outcomes")

    if any(r["count"] for r in data.identity_funnel):
        figs["identity"] = _bar(
            [r for r in data.identity_funnel if r["count"] > 0],
            title="Identity funnel",
            orientation="h",
            color=COLORS["secondary"],
            height=360,
        )

    if any(r["count"] for r in data.engagement):
        figs["engagement"] = _bar(
            [r for r in data.engagement if r["count"] > 0],
            title="Engagement events",
            orientation="h",
            color=COLORS["primary"],
            height=400,
        )

    if data.events_per_session_hist:
        figs["session_depth"] = _bar(
            data.events_per_session_hist,
            title="Events per session (binned)",
            color=COLORS["accent"],
        )

    # Combined auth overview dual axis style — lost vs successes over days
    if data.events_by_day and data.session_lost_by_day:
        day_map = {r["name"]: r["count"] for r in data.events_by_day}
        lost_map = {r["name"]: r["count"] for r in data.session_lost_by_day}
        days = sorted(day_map.keys())
        fig = make_subplots(specs=[[{"secondary_y": True}]])
        fig.add_trace(
            go.Bar(
                x=days,
                y=[day_map[d] for d in days],
                name="All events",
                marker_color=COLORS["primary"],
                opacity=0.75,
            ),
            secondary_y=False,
        )
        fig.add_trace(
            go.Scatter(
                x=days,
                y=[lost_map.get(d, 0) for d in days],
                name="session_lost",
                mode="lines+markers",
                line=dict(color=COLORS["danger"], width=2),
            ),
            secondary_y=True,
        )
        fig.update_layout(**LAYOUT_BASE, title="Daily volume vs session_lost", height=380)
        fig.update_yaxes(title_text="Events", secondary_y=False)
        fig.update_yaxes(title_text="session_lost", secondary_y=True)
        figs["volume_vs_lost"] = fig

    return figs
