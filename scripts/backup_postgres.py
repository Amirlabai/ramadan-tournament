"""
Export production PostgreSQL tables to CSV files under archive/postgres/.

Sensitive columns (password hashes, verification tokens) are omitted from the
users export. JSON/JSONB fields are serialized as JSON text in CSV cells.

Used by .github/workflows/backup-postgres.yml (daily 05:00 Asia/Jerusalem).
"""

from __future__ import annotations

import io
import json
import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

from _paths import REPO_ROOT

try:
    import psycopg2
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Install psycopg2-binary: pip install psycopg2-binary") from exc

OUTPUT_DIR = REPO_ROOT / "archive" / "postgres"
JERUSALEM = ZoneInfo("Asia/Jerusalem")

env_path = REPO_ROOT / "server" / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# (filename stem, SQL query) — queries must be read-only SELECTs.
TABLE_EXPORTS: list[tuple[str, str]] = [
    ("seasons", "SELECT * FROM seasons ORDER BY year_month, division"),
    (
        "users",
        """
        SELECT
            id,
            username,
            email,
            google_id,
            display_name,
            avatar_url,
            google_picture_url,
            role,
            active_division,
            is_verified,
            mapped_player_info,
            player_profile,
            pending_team_request,
            created_at,
            updated_at
        FROM users
        ORDER BY created_at
        """,
    ),
    (
        "season_registrations",
        "SELECT * FROM season_registrations ORDER BY created_at",
    ),
    ("invoice_codes", """
        SELECT
            id,
            season_id,
            assigned_user_id,
            created_by_id,
            redeemed_at,
            created_at
        FROM invoice_codes
        ORDER BY created_at
    """),
    ("teams", "SELECT * FROM teams ORDER BY season_id, id"),
    (
        "players",
        """
        SELECT
            member_id,
            team_id,
            season_id,
            user_id,
            first_name,
            last_name,
            nickname,
            number,
            position,
            squad_role,
            is_captain,
            head_photo,
            pending_head_photo,
            bio,
            birth_year,
            active,
            created_at
        FROM players
        ORDER BY season_id, team_id, number
        """,
    ),
    ("matches", "SELECT * FROM matches ORDER BY season_id, date, id"),
    ("goals", "SELECT * FROM goals ORDER BY season_id, match_id, member_id"),
    (
        "bracket_slots",
        "SELECT * FROM bracket_slots ORDER BY season_id, slot_order",
    ),
    ("news", "SELECT * FROM news ORDER BY season_id, date DESC"),
    ("comments", "SELECT * FROM comments ORDER BY season_id, match_id, created_at"),
    ("votes", "SELECT * FROM votes ORDER BY season_id, category, user_id"),
    (
        "stats_snapshots",
        "SELECT * FROM stats_snapshots ORDER BY season_id, saved_at",
    ),
    (
        "season_archives",
        "SELECT * FROM season_archives ORDER BY year_month, division",
    ),
    (
        "point_entries",
        "SELECT * FROM point_entries ORDER BY season_id, recorded_at",
    ),
    (
        "team_creation_requests",
        "SELECT * FROM team_creation_requests ORDER BY created_at",
    ),
    (
        "team_join_requests",
        "SELECT * FROM team_join_requests ORDER BY created_at",
    ),
    (
        "team_transfer_requests",
        "SELECT * FROM team_transfer_requests ORDER BY created_at",
    ),
    ("banned_words", "SELECT * FROM banned_words ORDER BY language, word"),
    (
        "analytics_events",
        """
        SELECT
            id,
            created_at,
            event_name,
            category,
            source,
            session_id,
            path,
            properties
        FROM analytics_events
        ORDER BY created_at
        """,
    ),
]


def export_table_bytes(cur, query: str) -> tuple[bytes, int]:
    buffer = io.StringIO()
    copy_command = f"COPY ({query.strip()}) TO STDOUT WITH (FORMAT CSV, HEADER TRUE)"
    cur.copy_expert(copy_command, buffer)
    text = buffer.getvalue()
    row_count = max(len(text.splitlines()) - 1, 0)
    return text.encode("utf-8"), row_count


def write_if_changed(dest: Path, content: bytes) -> bool:
    if dest.exists() and dest.read_bytes() == content:
        return False
    dest.write_bytes(content)
    return True


def backup_postgres() -> None:
    if not DATABASE_URL:
        print("Error: DATABASE_URL not set (server/.env or GitHub secret)")
        raise SystemExit(1)

    exported_at = datetime.now(JERUSALEM).isoformat(timespec="seconds")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Backing up PostgreSQL to: {OUTPUT_DIR}")
    print(f"Export time (Asia/Jerusalem): {exported_at}\n")

    manifest_tables: dict[str, dict[str, int | str]] = {}
    changed_files: list[str] = []

    conn = psycopg2.connect(DATABASE_URL)
    try:
        conn.set_session(readonly=True, autocommit=True)
        with conn.cursor() as cur:
            for stem, query in TABLE_EXPORTS:
                dest = OUTPUT_DIR / f"{stem}.csv"
                print(f"  [{stem}] -> {dest.name}")
                try:
                    content, rows = export_table_bytes(cur, query)
                    if write_if_changed(dest, content):
                        changed_files.append(dest.name)
                        print(f"           {rows} rows (changed)")
                    else:
                        print(f"           {rows} rows (unchanged)")
                    manifest_tables[stem] = {"rows": rows, "file": dest.name}
                except Exception as exc:
                    print(f"           [FAILED] {exc}")
                    manifest_tables[stem] = {"rows": 0, "file": dest.name, "error": str(exc)}
    finally:
        conn.close()

    manifest_path = OUTPUT_DIR / "_manifest.json"
    manifest = {
        "exported_at": exported_at,
        "timezone": "Asia/Jerusalem",
        "changed_files": changed_files,
        "tables": manifest_tables,
        "notes": [
            "users.csv omits password and verification_token columns",
            "users.csv still includes mapped_player_info and player_profile (PII)",
            "invoice_codes.csv omits code_hash and code_normalized (no plaintext payment codes)",
            "players.csv omits personal_id_enc (national ID ciphertext)",
            "analytics_events.csv contains behavioral events (session_id, path, properties JSON) — pseudonymous, no account linkage or PII by design",
            "personal_id_enc is encrypted; restore requires PERSONAL_ID_KEY",
            "archive/postgres/ is sensitive — do not publish or share publicly",
        ],
    }
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    if not changed_files:
        print("\nNo data changes since last backup — CSV files left as-is.")
        print(f"Refreshed manifest: {manifest_path}")
        print("--- Backup complete (unchanged) ---")
        return

    print(f"\nUpdated {len(changed_files)} file(s): {', '.join(changed_files)}")
    print(f"Wrote manifest: {manifest_path}")
    print("--- Backup complete ---")


if __name__ == "__main__":
    backup_postgres()
