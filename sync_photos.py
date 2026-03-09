import os
import requests
from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent / 'server' / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

MONGODB_URI = os.getenv('MONGODB_URI')
# Always pull from production — that's where uploaded files live
API_BASE_URL = os.getenv('VITE_API_URL', 'https://ramadan-tournament-api.onrender.com').replace('/api', '')

# All uploads (player photos + user avatars) go here
PLAYERS_DIR = Path(__file__).parent / 'server' / 'uploads' / 'players'
LOGOS_DIR = Path(__file__).parent / 'server' / 'uploads' / 'logos'


def download_file(url: str, dest: Path) -> bool:
    """Download a single file. Returns True on success."""
    try:
        response = requests.get(url, stream=True, timeout=15)
        if response.status_code == 200:
            dest.parent.mkdir(parents=True, exist_ok=True)
            with open(dest, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            return True
        else:
            print(f"    [FAILED] HTTP {response.status_code} for {url}")
            return False
    except Exception as e:
        print(f"    [ERROR] {e}")
        return False


def sync_photos():
    if not MONGODB_URI:
        print("Error: MONGODB_URI not found in .env")
        return

    PLAYERS_DIR.mkdir(parents=True, exist_ok=True)
    LOGOS_DIR.mkdir(parents=True, exist_ok=True)
    
    print(f"Syncing photos to: {PLAYERS_DIR.parent}")
    print(f"Pulling from: {API_BASE_URL}\n")

    try:
        client = MongoClient(MONGODB_URI)
        db = client.get_default_database()

        total_downloaded = 0
        total_skipped = 0

        # ── Team Logos ───────────────────────────────────────────────────────
        teams_collection = db['teams']
        teams = list(teams_collection.find({}))
        print(f"Found {len(teams)} teams.")

        for team in teams:
            logo_path = team.get('logoUrl')
            if logo_path and logo_path.startswith('/uploads/'):
                filename = logo_path.split('/')[-1]
                local_path = LOGOS_DIR / filename

                if local_path.exists():
                    total_skipped += 1
                else:
                    print(f"  [LOGO]   Downloading {filename} ({team.get('name')})...")
                    if download_file(f"{API_BASE_URL}{logo_path}", local_path):
                        total_downloaded += 1

        # ── Player photos (head_photo + pending_head_photo) ──────────────────
        for team in teams:
            team_name = team.get('name', 'Unknown')
            for player in team.get('players', []):
                for field in ('head_photo', 'pending_head_photo'):
                    photo_path = player.get(field)
                    if not photo_path or not photo_path.startswith('/uploads/'):
                        continue

                    filename = photo_path.split('/')[-1]
                    # Player photos might be in /uploads/players/ already or just /uploads/
                    local_path = PLAYERS_DIR / filename

                    if local_path.exists():
                        total_skipped += 1
                        continue

                    print(f"  [PLAYER] Downloading {filename} ({team_name})...")
                    if download_file(f"{API_BASE_URL}{photo_path}", local_path):
                        total_downloaded += 1

        # ── User avatars ─────────────────────────────────────────────────────
        users_collection = db['users']
        users = list(users_collection.find({'avatarUrl': {'$regex': '^/uploads/'}}))
        print(f"\nFound {len(users)} users with local avatars.")

        for user in users:
            avatar_path = user.get('avatarUrl', '')
            if not avatar_path.startswith('/uploads/'):
                continue

            filename = avatar_path.split('/')[-1]
            local_path = PLAYERS_DIR / filename

            if local_path.exists():
                total_skipped += 1
                continue

            display = user.get('displayName', str(user.get('_id', '?')))
            print(f"  [AVATAR]  Downloading {filename} ({display})...")
            if download_file(f"{API_BASE_URL}{avatar_path}", local_path):
                total_downloaded += 1

        print("\n--- Sync Complete ---")
        print(f"Downloaded : {total_downloaded}")
        print(f"Already present: {total_skipped}")

    except Exception as e:
        print(f"Database error: {e}")
    finally:
        client.close()


if __name__ == "__main__":
    sync_photos()
