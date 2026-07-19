# Uploaded assets

Team logos (`logos/`), player head photos and avatars (`players/`).

- **Git / deploy:** durable copies synced by `scripts/sync_photos.py` (prefer these when serving).
- **Render disk:** new uploads land on `UPLOADS_DISK_PATH` until the next sync + deploy.
- **Do not commit empty or placeholder files** — a zero-byte repo file would shadow a good disk copy.
- **Compress:** new uploads are resized on the API (short edge max 1080px) before the public path is written. Backfill existing files with `npm run uploads:compress --workspace=server`. While a file has a sibling `.compressing` lock, `/uploads/...` returns 404 so sync does not pull mid-job. Sync re-downloads when the remote file is meaningfully smaller than the local copy.

Public URLs: `/uploads/logos/...`, `/uploads/players/...`.
