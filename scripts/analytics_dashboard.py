#!/usr/bin/env python3
"""Build an offline analytics HTML dashboard from analytics_events.csv.

Default input: archive/postgres/analytics_events.csv (Postgres backup export).
Default output: artifacts/analytics-dashboard/index.html (+ metrics.json).

Large CSVs auto-chunk (≥5 MiB) so metrics stay memory-bounded. Force with --chunksize.

Usage (from repo root, with venv):

  .\\.venv\\Scripts\\python.exe scripts/analytics_dashboard.py
  .\\.venv\\Scripts\\python.exe scripts/analytics_dashboard.py --open
  .\\.venv\\Scripts\\python.exe scripts/analytics_dashboard.py --correlate-deploys
  .\\.venv\\Scripts\\python.exe scripts/analytics_dashboard.py --chunksize 20000
"""

from __future__ import annotations

import argparse
import json
import sys
import webbrowser
from pathlib import Path

# Allow `python scripts/analytics_dashboard.py` without installing as a package.
_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from _paths import REPO_ROOT  # noqa: E402
from analytics_report.deploy_correlate import (  # noqa: E402
    correlate_session_lost_with_deploys,
)
from analytics_report.insights import build_insights  # noqa: E402
from analytics_report.metrics import compute_metrics_from_csv  # noqa: E402
from analytics_report.render import write_dashboard  # noqa: E402

DEFAULT_CSV = REPO_ROOT / "archive" / "postgres" / "analytics_events.csv"
DEFAULT_OUT = REPO_ROOT / "artifacts" / "analytics-dashboard"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Generate an interactive HTML analytics dashboard from a CSV export."
    )
    p.add_argument(
        "--csv",
        type=Path,
        default=DEFAULT_CSV,
        help=f"Path to analytics_events CSV (default: {DEFAULT_CSV})",
    )
    p.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Output directory (default: {DEFAULT_OUT})",
    )
    p.add_argument(
        "--chunksize",
        type=int,
        default=None,
        help="Force pandas read chunk size (rows). Auto-enabled for files ≥5 MiB.",
    )
    p.add_argument(
        "--force-chunked",
        action="store_true",
        help="Always stream in chunks (even for small CSVs).",
    )
    p.add_argument(
        "--correlate-deploys",
        action="store_true",
        help="Append insights correlating auth_session_lost with git commits (deploy proxy).",
    )
    p.add_argument(
        "--open",
        action="store_true",
        help="Open index.html in the default browser after writing.",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    csv_path = args.csv if args.csv.is_absolute() else REPO_ROOT / args.csv
    out_dir = args.out if args.out.is_absolute() else REPO_ROOT / args.out

    try:
        relative = csv_path.relative_to(REPO_ROOT).as_posix()
    except ValueError:
        relative = str(csv_path)

    try:
        data = compute_metrics_from_csv(
            csv_path,
            source_label=relative,
            chunksize=args.chunksize,
            force_chunked=args.force_chunked,
        )
    except FileNotFoundError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    extra: list[str] = []
    deploy_payload = None
    if args.correlate_deploys:
        corr = correlate_session_lost_with_deploys(
            csv_path,
            REPO_ROOT,
            data,
            chunksize=args.chunksize if args.force_chunked or args.chunksize else None,
        )
        extra.extend(corr.notes)
        deploy_payload = {
            "notes": corr.notes,
            "candidate_windows": corr.candidate_windows,
        }

    data.insights = build_insights(data, extra=extra)
    html_path, json_path = write_dashboard(data, out_dir)

    if deploy_payload is not None:
        deploy_path = out_dir / "deploy_correlation.json"
        deploy_path.write_text(
            json.dumps(deploy_payload, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"Wrote {deploy_path}")

    print(f"Wrote {html_path}")
    print(f"Wrote {json_path}")
    print(
        f"{data.kpis['total_events']:,} events | "
        f"{data.kpis['unique_sessions']:,} sessions | "
        f"{data.kpis['auth_session_lost']:,} session_lost | "
        f"mode={data.load_mode}"
    )

    if args.open:
        webbrowser.open(html_path.resolve().as_uri())

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
