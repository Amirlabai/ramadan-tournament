# Python scripts

Peripheral automation and legacy static-data utilities. Core tournament logic (stats, CSV import, AI news) runs in the Node.js API; these scripts handle scheduled GitHub Actions jobs and optional offline `data/` workflows.

## Setup

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r scripts/requirements.txt
```

Run scripts with the venv interpreter, not system `python`. Scripts resolve paths from the repo root via `_paths.py`, so they work regardless of the current working directory.

## GitHub Actions

| Workflow | Script | Schedule | Secrets / env | Commits |
|----------|--------|----------|---------------|---------|
| [backup-postgres.yml](../.github/workflows/backup-postgres.yml) | `backup_postgres.py` | Daily 05:00 Asia/Jerusalem | `DATABASE_URL` | `archive/postgres/**` |
| [sync-photos.yml](../.github/workflows/sync-photos.yml) | `sync_photos.py` | Daily 05:30 + push to `main` | `DATABASE_URL`, `VITE_API_URL` | `server/uploads/**` |
| [fetch-alarms.yml](../.github/workflows/fetch-alarms.yml) | `fetch_alarms.py` | Every 2 hours | (none) | `data/alarms.*`, `client/public/data/alarms.json` |

All workflows use Python 3.12, install `scripts/requirements.txt`, and run `python scripts/<script>.py` from the repo root.

### backup_postgres.py

Exports production PostgreSQL tables to CSV under `archive/postgres/`. Sensitive columns are omitted (password hashes, verification tokens, encrypted national IDs, invoice code hashes). Refreshes `_manifest.json` on each run. Treat the archive as **sensitive** — it may contain PII.

Local run (requires `DATABASE_URL` in `server/.env` or the environment):

```powershell
.\.venv\Scripts\python.exe scripts/backup_postgres.py
```

### sync_photos.py

Downloads missing team logos, player head photos, and user avatars from the production API into `server/uploads/`. Uses public `/api/teams` and `/api/teams-girls`; optionally queries Postgres for avatar paths when `DATABASE_URL` is set. Skips compress sidecars; re-downloads when remote `Content-Length` is meaningfully smaller than the local file (after server-side compress).

**Recovery note:** if production already 404s the file (ephemeral wipe or mid-compress lock), sync cannot download it. Re-upload after the Render disk is live, or commit the local `server/uploads/...` copy and deploy first.

```powershell
.\.venv\Scripts\python.exe scripts/sync_photos.py
```

### fetch_alarms.py

Fetches rocket-alert data from [yuval-harpaz/alarms](https://github.com/yuval-harpaz/alarms), filters for Kfar Kama and Reihaniya, computes stats and time-of-day bins, and writes:

- `data/alarms.json` and `data/alarms.js` (legacy static site)
- `client/public/data/alarms.json` (Vite / React `AlarmsWidget`)

```powershell
.\.venv\Scripts\python.exe scripts/fetch_alarms.py
```

## Legacy static-data scripts

Used when maintaining the checked-in `data/` JSON tree (bootstrap seed, mock dev, or `deploy.bat`). Not used by production Postgres mode.

| Script | Purpose | Output |
|--------|---------|--------|
| `import_players.py` | CSV → teams | `data/teams.json`, `data/teams.js` |
| `update_stats.py` | Standings, scorers, bracket from matches | `data/standings.json`, `top_scorers.json`, `player_stats.json`, `bracket.json` (+ `.js` siblings) |
| `json_to_js.py` | Regenerate `.js` wrappers from existing JSON | `data/*.js` |

Example offline pipeline:

```powershell
.\.venv\Scripts\python.exe scripts/import_players.py
.\.venv\Scripts\python.exe scripts/update_stats.py
.\.venv\Scripts\python.exe scripts/json_to_js.py
```

Or use [deploy.bat](../deploy.bat), which runs import + stats and commits to git.

### analytics_dashboard.py

Offline HTML dashboard from a Postgres `analytics_events` CSV export (typically after [`backup_postgres.py`](backup_postgres.py)). Complements the live Analytics Explorer (`npm run analytics:explorer`), which needs `DATABASE_URL`.

Writes gitignored outputs under `artifacts/analytics-dashboard/`:

- `index.html` — interactive Plotly dashboard (KPIs, auth health, traffic, funnels)
- `metrics.json` — machine-readable summary for diffs
- `deploy_correlation.json` — only with `--correlate-deploys`

**Chunking:** files ≥5 MiB are streamed in 50k-row chunks (peak memory stays near one chunk). Force with `--chunksize N` or `--force-chunked`.

```powershell
.\.venv\Scripts\python.exe -m pip install -r scripts/requirements.txt
.\.venv\Scripts\python.exe scripts/analytics_dashboard.py
.\.venv\Scripts\python.exe scripts/analytics_dashboard.py --open
.\.venv\Scripts\python.exe scripts/analytics_dashboard.py --correlate-deploys
.\.venv\Scripts\python.exe scripts/analytics_dashboard.py --force-chunked --chunksize 20000
.\.venv\Scripts\python.exe scripts/analytics_dashboard.py --csv archive\postgres\analytics_events.csv --out artifacts\analytics-dashboard
```

## Dependencies

See [requirements.txt](requirements.txt): `requests`, `python-dotenv`, `psycopg2-binary`, `pandas`, `plotly`.

## Layout

```
scripts/
├── README.md              # this file
├── requirements.txt
├── _paths.py              # REPO_ROOT and DATA_DIR
├── backup_postgres.py     # GitHub Actions
├── sync_photos.py         # GitHub Actions
├── fetch_alarms.py        # GitHub Actions
├── analytics_dashboard.py # offline HTML dashboard from CSV
├── analytics_report/      # load / metrics / charts / render
├── import_players.py      # legacy
├── update_stats.py        # legacy
└── json_to_js.py          # legacy
```
