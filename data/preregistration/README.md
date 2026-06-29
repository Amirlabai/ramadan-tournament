# Preregistration data (debug JSON — not committed)

Production source of truth is Postgres table `form_prereg_entries` (imported via `npm run import:prereg`).

Optional local JSON from `parse:prereg` contains plaintext national IDs — **do not commit** `*.json` in this folder.

From `server/`:

```bash
# Production import (requires DATABASE_URL + PERSONAL_ID_KEY)
npm run import:prereg

# Optional: inspect parse output locally
npm run parse:prereg
```

Input default: `.incoming/ADIGA WORLD CUP 2026 ⚽ (תגובות) - תגובות לטופס 1.csv`

`import:prereg` options: `--csv path`, `--season-id uuid` (default: active boys season).

Debug JSON outputs (from `parse:prereg` only):

- `adiga-form-entries.json` — complete form rows
- `adiga-form-partial.json` — administration-side gaps (ID-only or year-only cells)
- `adiga-form-parse-report.json` — skipped / invalid cells

`email` is **captains only** (team owner). Players/GK have no email. Runtime matching is `personalId` + `birthYear` only; alerts go to the logged-in user's account email.

Deploy: `db:migrate` → `import:prereg` → restart API.
