"""
Download missing production upload files (team logos, team banners, player photos,
user avatars) to server/uploads/ for local dev or repo backup.

Data sources:
  - GET /api/teams and /api/teams-girls (public)
  - users.avatar_url from Postgres when DATABASE_URL is set

Used by .github/workflows/sync-photos.yml (daily 05:30 + on push to main).

After server-side compress, re-downloads when remote Content-Length is meaningfully
smaller than the local file so git does not keep a superseded heavy copy.
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
BANNERS_DIR = REPO_ROOT / "server" / "uploads" / "banners"

# Remote must be under this fraction of local size to force overwrite (compressed replace).
REPLACE_IF_REMOTE_SMALLER_RATIO = 0.85

COMPRESS_SIDECAR_SUFFIXES = (
    ".compressing",
    ".rt-compress-tmp",
    ".rt-compress-bak",
    ".rt-sync-tmp",
)


def is_compress_sidecar(name: str) -> bool:
    return any(name.endswith(suf) for suf in COMPRESS_SIDECAR_SUFFIXES)


def download_file(url: str, dest: Path) -> bool:
    """Download to `.rt-sync-tmp` then atomic replace onto dest (no partial corrupt)."""
    tmp_path = dest.with_name(dest.name + ".rt-sync-tmp")
    try:
        response = requests.get(url, stream=True, timeout=30, allow_redirects=True)
        if response.status_code != 200:
            print(f"    [FAILED] HTTP {response.status_code} for {url}")
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        total = 0
        with open(tmp_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                total += len(chunk)
        header_len = response.headers.get("Content-Length")
        if header_len is not None and int(header_len) != total:
            print(f"    [FAILED] truncated GET for {url} (got {total}, expected {header_len})")
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                pass
            return False
        if total <= 0:
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                pass
            return False
        tmp_path.replace(dest)
        return True
    except Exception as e:
        print(f"    [ERROR] {e}")
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass
        return False


def probe_and_maybe_stage(
    url: str, local_path: Path
) -> tuple[int | None, Path | None]:
    """
    Measure remote size. Prefer HEAD Content-Length (no body).

    If HEAD has no usable length, GET once and stage the body to
    `{local}.rt-sync-tmp` so replace can rename without a second GET.
    Size is always the bytes written; abort if Content-Length disagrees.
    """
    try:
        response = requests.head(url, timeout=15, allow_redirects=True)
        if response.status_code == 200:
            raw = response.headers.get("Content-Length")
            if raw is not None:
                return int(raw), None
    except Exception:
        pass

    tmp_path = local_path.with_name(local_path.name + ".rt-sync-tmp")
    try:
        response = requests.get(url, stream=True, timeout=30, allow_redirects=True)
        if response.status_code != 200:
            return None, None

        local_path.parent.mkdir(parents=True, exist_ok=True)
        total = 0
        with open(tmp_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                total += len(chunk)

        header_len = response.headers.get("Content-Length")
        if header_len is not None and int(header_len) != total:
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                pass
            return None, None
        if total <= 0:
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                pass
            return None, None
        return total, tmp_path
    except Exception:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass
        return None, None


def should_replace_local(
    local_path: Path, url: str
) -> tuple[bool, Path | None]:
    """
    True when local exists but remote is meaningfully smaller (post-compress).
    Second value is an already-downloaded temp to rename into place (no re-GET).
    """
    if not local_path.exists() or local_path.stat().st_size <= 0:
        return False, None
    remote_len, staged = probe_and_maybe_stage(url, local_path)
    if remote_len is None or remote_len <= 0:
        if staged is not None:
            try:
                staged.unlink(missing_ok=True)
            except OSError:
                pass
        return False, None
    local_len = local_path.stat().st_size
    if remote_len < local_len * REPLACE_IF_REMOTE_SMALLER_RATIO:
        return True, staged
    if staged is not None:
        try:
            staged.unlink(missing_ok=True)
        except OSError:
            pass
    return False, None


def sync_one(url: str, local_path: Path, label: str, name: str) -> str:
    """
    Returns action: 'downloaded' | 'replaced' | 'skipped' | 'failed'
    """
    if is_compress_sidecar(local_path.name):
        return "skipped"

    if local_path.exists() and local_path.stat().st_size > 0:
        replace, staged = should_replace_local(local_path, url)
        if replace:
            print(f"  [{label}] Replacing smaller remote {name}...")
            if staged is not None:
                try:
                    staged.replace(local_path)
                    return "replaced"
                except OSError as e:
                    print(f"    [ERROR] {e}")
                    try:
                        staged.unlink(missing_ok=True)
                    except OSError:
                        pass
                    return "failed"
            if download_file(url, local_path):
                return "replaced"
            return "failed"
        return "skipped"

    print(f"  [{label}] Downloading {name}...")
    if download_file(url, local_path):
        return "downloaded"
    return "failed"


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


def sync_team_assets(
    teams: list[dict], counts: dict[str, int]
) -> None:
    for team in teams:
        logo_path = team.get("logoUrl") or team.get("logo_url")
        if logo_path and str(logo_path).startswith("/uploads/"):
            filename = logo_path.split("/")[-1]
            if not is_compress_sidecar(filename):
                local_path = LOGOS_DIR / filename
                action = sync_one(
                    f"{API_BASE_URL}{logo_path}",
                    local_path,
                    "LOGO",
                    f"{filename} ({team.get('name', '?')})",
                )
                counts[action] = counts.get(action, 0) + 1

        banner_path = team.get("bannerUrl") or team.get("banner_url")
        if banner_path and str(banner_path).startswith("/uploads/"):
            filename = banner_path.split("/")[-1]
            if not is_compress_sidecar(filename):
                local_path = BANNERS_DIR / filename
                action = sync_one(
                    f"{API_BASE_URL}{banner_path}",
                    local_path,
                    "BANNER",
                    f"{filename} ({team.get('name', '?')})",
                )
                counts[action] = counts.get(action, 0) + 1

        for player in team.get("players") or []:
            for field in ("head_photo", "pending_head_photo", "headPhoto", "pendingHeadPhoto"):
                photo_path = player.get(field)
                if not photo_path or not str(photo_path).startswith("/uploads/"):
                    continue
                filename = photo_path.split("/")[-1]
                if is_compress_sidecar(filename):
                    continue
                local_path = PLAYERS_DIR / filename
                action = sync_one(
                    f"{API_BASE_URL}{photo_path}",
                    local_path,
                    "PLAYER",
                    f"{filename} ({team.get('name', '?')})",
                )
                counts[action] = counts.get(action, 0) + 1


def sync_photos() -> None:
    PLAYERS_DIR.mkdir(parents=True, exist_ok=True)
    LOGOS_DIR.mkdir(parents=True, exist_ok=True)
    BANNERS_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Syncing photos to: {PLAYERS_DIR.parent}")
    print(f"Pulling from: {API_BASE_URL}\n")

    counts: dict[str, int] = {
        "downloaded": 0,
        "replaced": 0,
        "skipped": 0,
        "failed": 0,
    }

    for api_path in ("/api/teams", "/api/teams-girls"):
        try:
            teams = fetch_teams(api_path)
            print(f"{api_path}: {len(teams)} teams")
            sync_team_assets(teams, counts)
        except Exception as e:
            print(f"  [WARN] {api_path}: {e}")

    avatar_paths = fetch_user_avatar_paths()
    print(f"\nUser avatars to check: {len(avatar_paths)}")
    for avatar_path in avatar_paths:
        filename = avatar_path.split("/")[-1]
        if is_compress_sidecar(filename):
            continue
        local_path = PLAYERS_DIR / filename
        action = sync_one(
            f"{API_BASE_URL}{avatar_path}",
            local_path,
            "AVATAR",
            filename,
        )
        counts[action] = counts.get(action, 0) + 1

    print("\n--- Sync Complete ---")
    print(f"Downloaded : {counts['downloaded']}")
    print(f"Replaced   : {counts['replaced']}")
    print(f"Already present: {counts['skipped']}")
    print(f"Failed     : {counts['failed']}")


if __name__ == "__main__":
    sync_photos()
