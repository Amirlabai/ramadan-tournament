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
    # Fallback for environments where .env is not in the expected path (like some CI)
    load_dotenv()

MONGODB_URI = os.getenv('MONGODB_URI')
# Base URL for photos - remove '/api' if it's there
# Priority: VITE_API_URL > Default Production URL
API_BASE_URL = os.getenv('VITE_API_URL', 'https://ramadan-tournament-api.onrender.com').replace('/api', '')

# Local directory where photos should be stored
LOCAL_UPLOADS_DIR = Path(__file__).parent / 'server' / 'uploads' / 'players'

def sync_photos():
    if not MONGODB_URI:
        print("Error: MONGODB_URI not found in .env")
        return

    # Ensure local directory exists
    LOCAL_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Checking photos in: {LOCAL_UPLOADS_DIR}")

    try:
        client = MongoClient(MONGODB_URI)
        db = client.get_default_database()
        teams_collection = db['teams']

        teams = list(teams_collection.find({}))
        print(f"Found {len(teams)} teams.")

        total_downloaded = 0
        total_skipped = 0

        for team in teams:
            team_name = team.get('name', 'Unknown')
            players = team.get('players', [])
            
            for player in players:
                # Fields to check for photos
                photo_fields = ['head_photo', 'pending_head_photo']
                
                for field in photo_fields:
                    photo_path = player.get(field)
                    
                    if not photo_path or not photo_path.startswith('/uploads/players/'):
                        continue
                    
                    # Extract filename (e.g., player_104_12345.jpg)
                    filename = photo_path.split('/')[-1]
                    local_file_path = LOCAL_UPLOADS_DIR / filename
                    
                    if local_file_path.exists():
                        # print(f"  [SKIPPED] {filename} already exists.")
                        total_skipped += 1
                        continue
                    
                    # Download missing photo
                    download_url = f"{API_BASE_URL}{photo_path}"
                    print(f"  [DOWNLOADING] {filename} from {team_name}...")
                    
                    try:
                        response = requests.get(download_url, stream=True)
                        if response.status_code == 200:
                            with open(local_file_path, 'wb') as f:
                                for chunk in response.iter_content(chunk_size=8192):
                                    f.write(chunk)
                            print(f"    [DONE] Saved to {local_file_path}")
                            total_downloaded += 1
                        else:
                            print(f"    [FAILED] HTTP {response.status_code} for {download_url}")
                    except Exception as e:
                        print(f"    [ERROR] Could not download {filename}: {e}")

        print("\n--- Sync Complete ---")
        print(f"Successfully downloaded: {total_downloaded}")
        print(f"Already present: {total_skipped}")

    except Exception as e:
        print(f"Database error: {e}")

if __name__ == "__main__":
    sync_photos()
