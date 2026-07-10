# Uploaded assets

Team logos (`logos/`), player head photos and avatars (`players/`).

- **Git / deploy:** durable copies synced by `scripts/sync_photos.py` (prefer these when serving).
- **Render disk:** new uploads land on `UPLOADS_DISK_PATH` until the next sync + deploy.
- **Do not commit empty or placeholder files** — a zero-byte repo file would shadow a good disk copy.

Public URLs: `/uploads/logos/...`, `/uploads/players/...`.
