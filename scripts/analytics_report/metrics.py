"""Compute dashboard metrics from a normalized analytics events DataFrame."""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd

from analytics_report.load import iter_event_chunks

AUTH_LOGIN_EVENTS = {
    "google_login_click",
    "google_login_success",
    "google_login_failed",
    "login_submit",
    "login_success",
    "login_failed",
    "logout",
    "auth_session_probe",
    "auth_session_lost",
    "register_submit",
    "register_success",
    "verify_success",
    "verify_failed",
}

IDENTITY_EVENTS = {
    "identity_form_open",
    "identity_submit_click",
    "identity_submitted",
    "identity_mismatch",
    "identity_rate_limited",
    "identity_validation_failed",
    "identity_submit_failed",
}

ENGAGEMENT_EVENTS = {
    "page_view",
    "nav_click",
    "team_expand",
    "vote_submit",
    "comment_submit",
    "claim_banner_click",
    "claim_banner_dismiss",
    "join_request_click",
    "join_request_submitted",
    "team_creation_submitted",
}

HIST_BINS = [1, 2, 3, 5, 10, 20, 50, 100, 10_000]


@dataclass
class DashboardData:
    """All tables and KPIs needed for HTML + metrics.json."""

    kpis: dict[str, Any]
    events_by_day: list[dict[str, Any]]
    events_by_hour: list[dict[str, Any]]
    events_by_name: list[dict[str, Any]]
    events_by_category: list[dict[str, Any]]
    top_paths: list[dict[str, Any]]
    sources: list[dict[str, Any]]
    auth_events: list[dict[str, Any]]
    session_lost_by_platform: list[dict[str, Any]]
    session_lost_by_path: list[dict[str, Any]]
    session_lost_by_day: list[dict[str, Any]]
    probe_outcomes: list[dict[str, Any]]
    identity_funnel: list[dict[str, Any]]
    engagement: list[dict[str, Any]]
    session_stats: dict[str, Any]
    events_per_session_hist: list[dict[str, Any]]
    generated_from: str = ""
    insights: list[str] = field(default_factory=list)
    load_mode: str = "full"
    chunksize: int | None = None

    def to_jsonable(self) -> dict[str, Any]:
        return asdict(self)


def _top_counter(counter: Counter, *, limit: int | None = None) -> list[dict[str, Any]]:
    items = counter.most_common(limit)
    return [{"name": str(k), "count": int(v)} for k, v in items]


def _ordered_counts(counter: Counter, names: set[str]) -> list[dict[str, Any]]:
    return [{"name": n, "count": int(counter.get(n, 0))} for n in names if counter.get(n, 0)]


def _bin_session_counts(session_counts: Counter) -> tuple[list[dict[str, Any]], dict[str, float]]:
    if not session_counts:
        return [], {"median_events": 0.0, "mean_events": 0.0, "p90_events": 0.0}

    series = pd.Series(list(session_counts.values()), dtype="int64")
    cats = pd.cut(series, bins=[0] + HIST_BINS, right=True, include_lowest=True)
    hist = [
        {"name": str(label), "count": int(count)}
        for label, count in cats.value_counts(sort=False).items()
    ]
    stats = {
        "median_events": round(float(series.median()), 2),
        "mean_events": round(float(series.mean()), 2),
        "p90_events": round(float(series.quantile(0.9)), 2),
    }
    return hist, stats


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 3:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = sum((x - mx) ** 2 for x in xs) ** 0.5
    dy = sum((y - my) ** 2 for y in ys) ** 0.5
    if dx == 0 or dy == 0:
        return None
    return round(num / (dx * dy), 3)


class _Accumulator:
    def __init__(self) -> None:
        self.total = 0
        self.date_min: pd.Timestamp | None = None
        self.date_max: pd.Timestamp | None = None
        self.by_day: Counter = Counter()
        self.by_hour: Counter = Counter()
        self.by_name: Counter = Counter()
        self.by_category: Counter = Counter()
        self.by_path: Counter = Counter()
        self.by_source: Counter = Counter()
        self.session_events: Counter = Counter()
        self.sessions: set[str] = set()
        self.lost_platform: Counter = Counter()
        self.lost_path: Counter = Counter()
        self.lost_day: Counter = Counter()
        self.lost_sessions: Counter = Counter()
        self.probe_outcomes: Counter = Counter()
        self.page_view_by_hour: Counter = Counter()
        self.lost_by_hour: Counter = Counter()
        self.client_events = 0
        self.server_events = 0

    def ingest(self, df: pd.DataFrame) -> None:
        if df.empty:
            return
        self.total += len(df)
        cmin = df["created_at"].min()
        cmax = df["created_at"].max()
        self.date_min = cmin if self.date_min is None else min(self.date_min, cmin)
        self.date_max = cmax if self.date_max is None else max(self.date_max, cmax)

        self.by_day.update(df["day"].tolist())
        self.by_hour.update(df["hour"].tolist())
        self.by_name.update(df["event_name"].tolist())
        self.by_category.update(df["category"].tolist())
        self.by_path.update(df["path"].tolist())
        self.by_source.update(df["source"].tolist())

        self.client_events += int((df["source"] == "client").sum())
        self.server_events += int((df["source"] == "server").sum())

        with_sess = df.loc[df["has_session"], "session_id"]
        if len(with_sess):
            self.sessions.update(with_sess.tolist())
            self.session_events.update(with_sess.tolist())

        lost = df[df["event_name"] == "auth_session_lost"]
        if len(lost):
            plat = lost["platform"].fillna("unknown").replace("", "unknown")
            self.lost_platform.update(plat.tolist())
            self.lost_path.update(lost["path"].tolist())
            self.lost_day.update(lost["day"].tolist())
            lost_sess = lost.loc[lost["session_id"].ne(""), "session_id"]
            self.lost_sessions.update(lost_sess.tolist())
            self.lost_by_hour.update(lost["hour_bucket"].tolist())

        probe = df[df["event_name"] == "auth_session_probe"]
        if len(probe):
            outcomes = probe["outcome"].fillna("unknown").replace("", "unknown")
            self.probe_outcomes.update(outcomes.tolist())

        pv = df[df["event_name"] == "page_view"]
        if len(pv):
            self.page_view_by_hour.update(pv["hour_bucket"].tolist())

    def to_dashboard(
        self,
        *,
        source_label: str,
        load_mode: str,
        chunksize: int | None,
    ) -> DashboardData:
        lost_count = int(self.by_name.get("auth_session_lost", 0))
        google_ok = int(self.by_name.get("google_login_success", 0))
        login_ok = int(self.by_name.get("login_success", 0))
        login_fail = int(self.by_name.get("login_failed", 0))
        sessions_with_lost = len(self.lost_sessions)
        multi_lost = sum(1 for _, n in self.lost_sessions.items() if n >= 2)

        hist, sess_stats = _bin_session_counts(self.session_events)

        peak_day = None
        peak_day_count = 0
        if self.by_day:
            peak_day, peak_day_count = self.by_day.most_common(1)[0]

        hours = sorted(set(self.page_view_by_hour) | set(self.lost_by_hour))
        corr = _pearson(
            [float(self.lost_by_hour.get(h, 0)) for h in hours],
            [float(self.page_view_by_hour.get(h, 0)) for h in hours],
        )
        page_views = int(self.by_name.get("page_view", 0))

        kpis = {
            "total_events": self.total,
            "unique_sessions": len(self.sessions),
            "date_min": (
                self.date_min.isoformat(sep=" ", timespec="seconds")
                if self.date_min is not None
                else None
            ),
            "date_max": (
                self.date_max.isoformat(sep=" ", timespec="seconds")
                if self.date_max is not None
                else None
            ),
            "day_count": len(self.by_day),
            "peak_day": peak_day,
            "peak_day_count": int(peak_day_count),
            "client_events": self.client_events,
            "server_events": self.server_events,
            "auth_session_lost": lost_count,
            "google_login_success": google_ok,
            "login_success": login_ok,
            "login_failed": login_fail,
            "sessions_with_lost": sessions_with_lost,
            "sessions_multi_lost": multi_lost,
            "lost_per_login_success": round(lost_count / max(google_ok + login_ok, 1), 2),
            "page_views": page_views,
            "lost_per_page_view": round(lost_count / max(page_views, 1), 3),
            "lost_vs_page_view_hourly_corr": corr,
        }

        by_hour_list = [
            {"name": str(h), "count": int(self.by_hour.get(h, 0))} for h in range(24)
        ]

        return DashboardData(
            kpis=kpis,
            events_by_day=[
                {"name": str(k), "count": int(v)} for k, v in sorted(self.by_day.items())
            ],
            events_by_hour=by_hour_list,
            events_by_name=_top_counter(self.by_name, limit=25),
            events_by_category=_top_counter(self.by_category),
            top_paths=_top_counter(self.by_path, limit=15),
            sources=_top_counter(self.by_source),
            auth_events=_ordered_counts(self.by_name, AUTH_LOGIN_EVENTS),
            session_lost_by_platform=_top_counter(self.lost_platform),
            session_lost_by_path=_top_counter(self.lost_path, limit=12),
            session_lost_by_day=[
                {"name": str(k), "count": int(v)} for k, v in sorted(self.lost_day.items())
            ],
            probe_outcomes=_top_counter(self.probe_outcomes),
            identity_funnel=_ordered_counts(self.by_name, IDENTITY_EVENTS),
            engagement=_ordered_counts(self.by_name, ENGAGEMENT_EVENTS),
            session_stats={
                **sess_stats,
                "sessions_with_lost": sessions_with_lost,
                "sessions_multi_lost": multi_lost,
                "lost_event_count": lost_count,
            },
            events_per_session_hist=hist,
            generated_from=source_label,
            load_mode=load_mode,
            chunksize=chunksize,
        )


def compute_metrics_from_chunks(
    chunks: Iterable[pd.DataFrame],
    *,
    source_label: str = "",
    load_mode: str = "chunked",
    chunksize: int | None = None,
) -> DashboardData:
    acc = _Accumulator()
    for chunk in chunks:
        acc.ingest(chunk)
    if acc.total == 0:
        raise ValueError("No rows with valid created_at timestamps")
    return acc.to_dashboard(
        source_label=source_label, load_mode=load_mode, chunksize=chunksize
    )


def compute_metrics_from_csv(
    csv_path: Path,
    *,
    source_label: str = "",
    chunksize: int | None = None,
    force_chunked: bool = False,
) -> DashboardData:
    """Stream CSV → metrics. Auto-chunks large files; use force_chunked for tests."""
    from analytics_report.load import resolve_chunksize

    path = Path(csv_path)
    effective = resolve_chunksize(path, chunksize)
    if force_chunked and effective is None:
        effective = 50_000 if chunksize is None else chunksize

    mode = "chunked" if effective else "full"
    chunks = iter_event_chunks(path, chunksize=effective if mode == "chunked" else None)
    # When full mode, iter yields one frame — still uses accumulator (one pass).
    if mode == "full":
        # Still one-shot read inside iter when effective is None
        pass
    return compute_metrics_from_chunks(
        chunks,
        source_label=source_label,
        load_mode=mode,
        chunksize=effective,
    )


def compute_metrics(df: pd.DataFrame, *, source_label: str = "") -> DashboardData:
    """Compute metrics from an in-memory normalized DataFrame."""
    return compute_metrics_from_chunks(
        [df], source_label=source_label, load_mode="full", chunksize=None
    )
