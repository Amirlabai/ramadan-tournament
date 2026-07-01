# Preregistration — local debug JSON only

**Do not confuse this folder with Postgres.**

| Layer | What it is | How it is updated |
|-------|------------|-------------------|
| **Postgres (production)** | `form_prereg_entries`, `teams`, `players` on Render/local DB | `import:prereg`, `import:roster` — **fill-only** (see below) |
| **`.incoming/*.csv`** | Google Form export (source file) | You drop updated sheets here |
| **`data/preregistration/*.json`** | Optional local parse dump | `parse:prereg` only — **never** read by the API |
| **`.incoming/parsed-teams-review.md`** | Masked CSV preview | Parses CSV directly — not Postgres state |

## Fill-only contract

CSV import **never replaces** Postgres. It only inserts what is missing:

- Existing teams → unchanged (no rename, no owner swap)
- Existing players → unchanged (including linked users)
- Existing prereg rows → unchanged
- New teams/players/rows from CSV → inserted if no match in DB

The API uses **Postgres only** (`PreregistrationLookupService` → `form_prereg_entries`).

From `server/`:

```bash
# Optional: local debug JSON (does NOT touch the database)
npm run parse:prereg

# Fill Postgres gaps (requires DATABASE_URL + PERSONAL_ID_KEY)
npm run import:prereg -- --yes
npm run import:prereg -- --json --yes
npm run import:roster -- --dry-run
npm run import:roster
```

Default CSV: `.incoming/ADIGA WORLD CUP 2026 ⚽ (תגובות) - תגובות לטופס 1(1).csv`

`--replace` is not supported on `import:prereg` (removed).

Deploy: `db:migrate` → `import:prereg` → `import:roster` → restart API.
