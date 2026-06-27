"""
Download missing production upload files (team logos, player photos, user avatars)
to server/uploads/ for local dev or repo backup.

Data sources:
  - GET /api/teams and /api/teams-girls (public)
  - users.avatar_url from Postgres when DATABASE_URL is set

Used by .github/workflows/sync-photos.yml (daily 05:30 + on push to main).
"""

from __future__ import annotations

import os
from pathlib import Path

import requests
from dotenv import load_dotenv

from _paths import REPO_ROOT

env_path = REPO_ROOT / "server" / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

API_BASE_URL = (os.getenv("VITE_API_URL") or "https://ramadan-tournament-api.onrender.com").rstrip("/")
if API_BASE_URL.endswith("/api"):
    API_BASE_URL = API_BASE_URL[:-4]

DATABASE_URL = os.getenv("DATABASE_URL")

PLAYERS_DIR = REPO_ROOT / "server" / "uploads" / "players"
LOGOS_DIR = REPO_ROOT / "server" / "uploads" / "logos"


def download_file(url: str, dest: Path) -> bool:
    try:
        response = requests.get(url, stream=True, timeout=15)
        if response.status_code == 200:
            dest.parent.mkdir(parents=True, exist_ok=True)
            with open(dest, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            return True
        print(f"    [FAILED] HTTP {response.status_code} for {url}")
        return False
    except Exception as e:
        print(f"    [ERROR] {e}")
        return False


def fetch_teams(path: str) -> list[dict]:
    url = f"{API_BASE_URL}{path}"
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    data = response.json()
    return data if isinstance(data, list) else []


def fetch_user_avatar_paths() -> list[str]:
    if not DATABASE_URL:
        print("DATABASE_URL not set — skipping user avatar sync")
        return []
    try:
        import psycopg2
    except ImportError:
        print("psycopg2-binary not installed — skipping user avatar sync")
        return []

    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT avatar_url FROM users WHERE avatar_url LIKE '/uploads/%'"
            )
            return [row[0] for row in cur.fetchall() if row[0]]
    finally:
        conn.close()


def sync_team_assets(teams: list[dict], total_downloaded: int, total_skipped: int) -> tuple[int, int]:
    for team in teams:
        logo_path = team.get("logoUrl") or team.get("logo_url")
        if logo_path and str(logo_path).startswith("/uploads/"):
            filename = logo_path.split("/")[-1]
            local_path = LOGOS_DIR / filename
            if local_path.exists():
                total_skipped += 1
            else:
                print(f"  [LOGO]   Downloading {filename} ({team.get('name', '?')})...")
                if download_file(f"{API_BASE_URL}{logo_path}", local_path):
                    total_downloaded += 1

        for player in team.get("players") or []:
            for field in ("head_photo", "pending_head_photo", "headPhoto", "pendingHeadPhoto"):
                photo_path = player.get(field)
                if not photo_path or not str(photo_path).startswith("/uploads/"):
                    continue
                filename = photo_path.split("/")[-1]
                local_path = PLAYERS_DIR / filename
                if local_path.exists():
                    total_skipped += 1
                    continue
                print(f"  [PLAYER] Downloading {filename} ({team.get('name', '?')})...")
                if download_file(f"{API_BASE_URL}{photo_path}", local_path):
                    total_downloaded += 1
    return total_downloaded, total_skipped


def sync_photos() -> None:
    PLAYERS_DIR.mkdir(parents=True, exist_ok=True)
    LOGOS_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Syncing photos to: {PLAYERS_DIR.parent}")
    print(f"Pulling from: {API_BASE_URL}\n")

    total_downloaded = 0
    total_skipped = 0

    for api_path in ("/api/teams", "/api/teams-girls"):
        try:
            teams = fetch_teams(api_path)
            print(f"{api_path}: {len(teams)} teams")
            total_downloaded, total_skipped = sync_team_assets(
                teams, total_downloaded, total_skipped
            )
        except Exception as e:
            print(f"  [WARN] {api_path}: {e}")

    avatar_paths = fetch_user_avatar_paths()
    print(f"\nUser avatars to check: {len(avatar_paths)}")
    for avatar_path in avatar_paths:
        filename = avatar_path.split("/")[-1]
        local_path = PLAYERS_DIR / filename
        if local_path.exists():
            total_skipped += 1
            continue
        print(f"  [AVATAR] Downloading {filename}...")
        if download_file(f"{API_BASE_URL}{avatar_path}", local_path):
            total_downloaded += 1

    print("\n--- Sync Complete ---")
    print(f"Downloaded : {total_downloaded}")
    print(f"Already present: {total_skipped}")


if __name__ == "__main__":
    sync_photos()
