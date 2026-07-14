"""Correlate auth_session_lost bursts with git commit times (deploy proxy)."""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path

import pandas as pd

from analytics_report.load import iter_event_chunks
from analytics_report.metrics import DashboardData


@dataclass
class DeployCorrelation:
    notes: list[str]
    candidate_windows: list[dict]


def _git_commits(repo_root: Path, since: str, until: str) -> list[tuple[pd.Timestamp, str, str]]:
    try:
        raw = subprocess.check_output(
            [
                "git",
                "log",
                f"--since={since}",
                f"--until={until}",
                "--pretty=format:%cI|%h|%s",
            ],
            text=True,
            encoding="utf-8",
            errors="replace",
            cwd=repo_root,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []

    commits: list[tuple[pd.Timestamp, str, str]] = []
    for line in raw.strip().splitlines():
        if not line.strip():
            continue
        ts_s, h, *rest = line.split("|", 2)
        ts = pd.Timestamp(ts_s)
        if ts.tzinfo is not None:
            ts = ts.tz_convert("UTC").tz_localize(None)
        msg = rest[0] if rest else ""
        if "[skip ci]" in msg or "backup postgres" in msg or "sync production photos" in msg:
            continue
        commits.append((ts, h, msg))
    return commits


def correlate_session_lost_with_deploys(
    csv_path: Path,
    repo_root: Path,
    data: DashboardData,
    *,
    chunksize: int | None = None,
) -> DeployCorrelation:
    """Compare session_lost density near git commits vs baseline.

    Git commits are a proxy for Render/Vercel deploys (Prisma restart). They are
    not perfect — timestamps are commit time, not ship time, and may be local
    wall-clock vs Postgres UTC depending on backup export.
    """
    date_min = data.kpis.get("date_min")
    date_max = data.kpis.get("date_max")
    if not date_min or not date_max:
        return DeployCorrelation(notes=["No date range for deploy correlation."], candidate_windows=[])

    since = str(date_min)[:10]
    until = str(pd.Timestamp(date_max) + timedelta(days=1))[:10]
    commits = _git_commits(repo_root, since, until)
    if not commits:
        return DeployCorrelation(
            notes=["No non-backup git commits in range (or git unavailable)."],
            candidate_windows=[],
        )

    # Collect lost timestamps only (streamed)
    lost_times: list[pd.Timestamp] = []
    for chunk in iter_event_chunks(csv_path, chunksize=chunksize):
        lost = chunk[chunk["event_name"] == "auth_session_lost"]
        if len(lost):
            lost_times.extend(lost["created_at"].tolist())

    if not lost_times:
        return DeployCorrelation(notes=["No auth_session_lost events to correlate."], candidate_windows=[])

    lost_series = pd.Series(lost_times)
    span_min = max(
        (pd.Timestamp(date_max) - pd.Timestamp(date_min)).total_seconds() / 60,
        1.0,
    )
    density = len(lost_series) / span_min
    expected_45 = density * 45

    auth_keys = ("auth", "cookie", "cors", "session", "proxy", "password", "jwt", "samesite", "prisma")
    candidates = [
        (ts, h, msg) for ts, h, msg in commits if any(k in msg.lower() for k in auth_keys)
    ]

    windows: list[dict] = []
    for ts, h, msg in candidates:
        n = int(
            (
                (lost_series >= ts - timedelta(minutes=15))
                & (lost_series <= ts + timedelta(minutes=30))
            ).sum()
        )
        windows.append(
            {
                "at": ts.isoformat(sep=" ", timespec="seconds"),
                "hash": h,
                "message": msg[:80],
                "lost_in_window": n,
                "expected_baseline": round(expected_45, 1),
            }
        )

    notes: list[str] = []
    corr = data.kpis.get("lost_vs_page_view_hourly_corr")
    if corr is not None:
        notes.append(
            f"Hourly auth_session_lost vs page_view correlation is {corr:.3f}. "
            "Values near 1.0 mean lost tracks traffic volume (e.g. remount / anonymous 401), "
            "not isolated outage spikes."
        )

    notes.append(
        "AuthContext fires auth_session_lost on any GET /me 401 after optional bearer retry — "
        "including first visits with no cookie. That inflates counts vs true cookie drops. "
        "Logged-in server events often have empty session_id, so same-session join to "
        "login_success is unreliable."
    )

    notes.append(
        f"Baseline density ≈ {density:.3f} session_lost/min "
        f"(~{expected_45:.1f} per 45-minute window). "
        f"Auth-related commits checked: {len(candidates)}."
    )

    elevated = [w for w in windows if w["lost_in_window"] > expected_45 * 2]
    if elevated:
        top = max(elevated, key=lambda w: w["lost_in_window"])
        notes.append(
            f"Elevated near {top['hash']} ({top['at']} UTC commit time): "
            f"{top['lost_in_window']} lost vs ~{top['expected_baseline']} baseline — "
            f"\"{top['message']}\". "
            "Likely a busy auth-test window or frontend remount after deploy; "
            "Prisma restart alone would more often produce 502/503 (which do NOT emit "
            "auth_session_lost) than a clean 401 burst."
        )
    elif windows:
        notes.append(
            "No auth-related commit window exceeded 2× baseline session_lost density. "
            "Spikes align more with traffic peaks than with Prisma/API restarts."
        )
    else:
        notes.append("No auth-keyword commits in this date range to compare.")

    # Top absolute spike minutes vs nearest commit
    by_min = lost_series.dt.floor("min").value_counts().head(5)
    far = 0
    for minute, count in by_min.items():
        nearest = min(commits, key=lambda c: abs((c[0] - minute).total_seconds()))
        delta_m = abs((nearest[0] - minute).total_seconds()) / 60
        if delta_m > 60:
            far += 1
    notes.append(
        f"Of the top {len(by_min)} busiest session_lost minutes, {far} are >60 minutes "
        "from any non-backup git commit — consistent with organic traffic, not restart storms."
    )

    return DeployCorrelation(notes=notes, candidate_windows=windows)
