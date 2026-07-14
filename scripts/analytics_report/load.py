"""Load and normalize analytics_events CSV exports (chunk-friendly)."""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

import pandas as pd

PROP_KEYS = ("platform", "standalone", "outcome", "method", "surface", "reason")

# Auto-chunk when file is larger than this (today's export ~1.8MB).
DEFAULT_CHUNKSIZE = 50_000
AUTO_CHUNK_BYTES = 5 * 1024 * 1024  # 5 MiB


def _parse_properties(raw: object) -> dict:
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return {}
    text = str(raw).strip()
    if not text:
        return {}
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return {}
    return data if isinstance(data, dict) else {}


def normalize_chunk(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize one CSV chunk (or a full frame) into analytics columns."""
    if df.empty:
        return df

    rename = {c: c.lstrip("\ufeff").strip() for c in df.columns}
    df = df.rename(columns=rename)

    required = {"created_at", "event_name", "category", "source"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"CSV missing required columns: {sorted(missing)}")

    for col in ("id", "session_id", "path", "properties"):
        if col not in df.columns:
            df[col] = ""

    df["created_at"] = pd.to_datetime(
        df["created_at"], format="mixed", errors="coerce"
    )
    df = df.dropna(subset=["created_at"])
    if df.empty:
        return df

    df["event_name"] = df["event_name"].astype(str).str.strip()
    df["category"] = df["category"].astype(str).str.strip()
    df["source"] = df["source"].astype(str).str.strip()
    df["session_id"] = df["session_id"].astype(str).str.strip()
    df["path"] = df["path"].astype(str).str.strip()
    df.loc[df["path"] == "", "path"] = "(empty)"

    props = df["properties"].map(_parse_properties)
    for key in PROP_KEYS:
        df[key] = props.map(lambda p, k=key: p.get(k))

    df["day"] = df["created_at"].dt.strftime("%Y-%m-%d")
    df["hour"] = df["created_at"].dt.hour.astype(int)
    df["hour_bucket"] = df["created_at"].dt.floor("h")
    df["has_session"] = df["session_id"].ne("")

    return df.reset_index(drop=True)


def resolve_chunksize(csv_path: Path, chunksize: int | None) -> int | None:
    """Return chunk size to use, or None to read the file in one shot.

    Explicit ``chunksize`` always wins. Otherwise auto-chunk when the file
    exceeds ``AUTO_CHUNK_BYTES`` so growing exports stay memory-bounded.
    """
    if chunksize is not None:
        return chunksize if chunksize > 0 else None
    try:
        size = csv_path.stat().st_size
    except OSError:
        return None
    if size >= AUTO_CHUNK_BYTES:
        return DEFAULT_CHUNKSIZE
    return None


def iter_event_chunks(
    csv_path: Path,
    *,
    chunksize: int | None = None,
) -> Iterator[pd.DataFrame]:
    """Yield normalized event chunks from a CSV export.

    When ``chunksize`` is None and the file is small, yields a single frame.
    When the file is large (or chunksize is set), yields pandas chunks.
    """
    path = Path(csv_path)
    if not path.is_file():
        raise FileNotFoundError(f"Analytics CSV not found: {path}")

    effective = resolve_chunksize(path, chunksize)
    read_kw = dict(encoding="utf-8-sig", dtype=str, keep_default_na=False)

    if effective is None:
        df = pd.read_csv(path, **read_kw)
        if df.empty:
            raise ValueError(f"Analytics CSV is empty: {path}")
        out = normalize_chunk(df)
        if out.empty:
            raise ValueError("No rows with valid created_at timestamps")
        yield out
        return

    reader = pd.read_csv(path, chunksize=effective, **read_kw)
    yielded = False
    for chunk in reader:
        if chunk.empty:
            continue
        out = normalize_chunk(chunk)
        if out.empty:
            continue
        yielded = True
        yield out

    if not yielded:
        raise ValueError(f"Analytics CSV is empty or had no valid timestamps: {path}")


def load_events(
    csv_path: Path,
    *,
    chunksize: int | None = None,
) -> pd.DataFrame:
    """Read a Postgres analytics_events CSV export into a normalized DataFrame.

    For large files prefer ``iter_event_chunks`` / streaming metrics so peak
    memory stays near one chunk. This helper still concatenates when callers
    need a full frame.
    """
    frames = list(iter_event_chunks(csv_path, chunksize=chunksize))
    if len(frames) == 1:
        return frames[0]
    return pd.concat(frames, ignore_index=True)
